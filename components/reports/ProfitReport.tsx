/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Notfoundpage from "@/components/Notfoundpage";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { format, parseISO, subMonths } from "date-fns";
import {
  DollarSign,
  Download,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export const ProfitReport = () => {
  const user = useAppSelector((state) => state.user.user);
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );
  const isAdmin = user?.type === "admin" || user?.type === "super admin";

  // All hooks must be called before any conditional returns

  const today = new Date();
  const [range, setRange] = useState([
    {
      startDate: subMonths(today, 1),
      endDate: today,
      key: "selection",
    },
  ]);
  const [mode, setMode] = useState("monthly"); // daily / weekly / monthly / custom
  const [basis, setBasis] = useState("all"); // all (sales) | collected (payments received)

  const [reportData, setReportData] = useState<any[]>([]);
  const [collectedRows, setCollectedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
  });

  // Which dataset drives the table/summary for the active basis.
  const hasData =
    basis === "collected" ? collectedRows.length > 0 : reportData.length > 0;

  const fetchData = async () => {
    if (!isAdmin) return;
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);

    // Format dates in local timezone to avoid UTC conversion issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const start = formatLocalDate(range[0].startDate);
    const end = formatLocalDate(range[0].endDate);

    // "Collected (payments received)" view is a different query shape.
    if (basis === "collected") {
      await fetchCollected(start, end);
      return;
    }

    // === "All sales" (accrual) view: recognize revenue/profit at sale time ===
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(
        `
        *,
        transaction_items:transaction_items(
          *,
          product:product_id(name),
          stock:product_stock_id(purchase_price)
        )
      `
      )
      .eq("branch_id", selectedBranchId)
      // Exclude consignment hand-off transactions: these represent goods
      // handed to a consignee (goods on loan), not actual sales. Counting
      // them overstates revenue/profit and double-counts once the goods
      // later sell via a `consignment_sale` transaction.
      .neq("transaction_type", "consignment_add")
      .gte("created_at", `${start} 00:00:00`)
      .lte("created_at", `${end} 23:59:59`)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load data");
      console.error(error);
      setLoading(false);
      return;
    }

    const transactionsData = transactions || [];
    setCollectedRows([]);
    setReportData(transactionsData);

    // Calculate summary
    let totalRevenue = 0;
    let totalCost = 0;

    transactionsData.forEach((t: any) => {
      t.transaction_items.forEach((item: any) => {
        const revenue = Number(item.total) || 0;
        const costPrice = Number(item.stock?.purchase_price || 0);
        const cost = costPrice * (item.quantity || 0);

        totalRevenue += revenue;
        totalCost += cost;
      });
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setSummary({
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
    });

    setLoading(false);
  };

  // "Collected (payments received)" view: sum the actual payments recorded
  // through the managed-payments modal, dated by payment_date. Cost/profit are
  // allocated to each payment in proportion to its transaction's margin, so a
  // partial (term) payment recognizes a proportional slice of cost and profit.
  const fetchCollected = async (start: string, end: string) => {
    // 1️⃣ Payments actually received within the date range.
    const { data: payments, error: pErr } = await supabase
      .from("transaction_payments")
      .select("id, amount, payment_date, payment_method, transaction_id")
      .gte("payment_date", `${start} 00:00:00`)
      .lte("payment_date", `${end} 23:59:59`)
      .order("payment_date", { ascending: true });

    if (pErr) {
      toast.error("Failed to load payments");
      console.error(pErr);
      setLoading(false);
      return;
    }

    const paymentsData = payments || [];
    const txnIds = Array.from(
      new Set(paymentsData.map((p: any) => p.transaction_id).filter(Boolean))
    );

    // 2️⃣ Load the parent transactions (branch-scoped, excluding consignment
    //    hand-offs) so each payment can be attached to its transaction's margin.
    const txnMap = new Map<number, any>();
    if (txnIds.length > 0) {
      const { data: txns, error: tErr } = await supabase
        .from("transactions")
        .select(
          `
          id,
          transaction_number,
          transaction_type,
          transaction_items:transaction_items(
            quantity,
            total,
            stock:product_stock_id(purchase_price)
          )
        `
        )
        .in("id", txnIds)
        .eq("branch_id", selectedBranchId)
        .neq("transaction_type", "consignment_add");

      if (tErr) {
        toast.error("Failed to load data");
        console.error(tErr);
        setLoading(false);
        return;
      }

      (txns || []).forEach((t: any) => {
        const revenue = t.transaction_items.reduce(
          (s: number, i: any) => s + (Number(i.total) || 0),
          0
        );
        const cost = t.transaction_items.reduce(
          (s: number, i: any) =>
            s + Number(i.stock?.purchase_price || 0) * (i.quantity || 0),
          0
        );
        txnMap.set(t.id, {
          transaction_number: t.transaction_number,
          marginRatio: revenue > 0 ? cost / revenue : 0,
        });
      });
    }

    // 3️⃣ Build one row per payment, allocating cost proportionally.
    const rows: any[] = [];
    let totalRevenue = 0;
    let totalCost = 0;

    paymentsData.forEach((p: any) => {
      const t = txnMap.get(p.transaction_id);
      // Skip payments whose transaction is in another branch or is a
      // consignment hand-off (filtered out above).
      if (!t) return;

      const amount = Number(p.amount) || 0;
      const cost = amount * t.marginRatio;
      const profit = amount - cost;

      totalRevenue += amount;
      totalCost += cost;

      rows.push({
        id: p.id,
        payment_date: p.payment_date,
        transaction_number: t.transaction_number,
        payment_method: p.payment_method,
        amount,
        cost,
        profit,
        margin: amount > 0 ? (profit / amount) * 100 : 0,
      });
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setReportData([]);
    setCollectedRows(rows);
    setSummary({ totalRevenue, totalCost, totalProfit, profitMargin });
    setLoading(false);
  };

  const exportExcel = () => {
    const rows: any[] = [];

    if (basis === "collected") {
      collectedRows.forEach((r) => {
        rows.push({
          "Payment Date": format(parseISO(r.payment_date), "yyyy-MM-dd HH:mm"),
          "Transaction Number": r.transaction_number,
          "Payment Method": r.payment_method,
          "Amount Collected": r.amount,
          "Est. Cost": r.cost,
          "Est. Profit": r.profit,
          "Margin %": r.amount > 0 ? ((r.profit / r.amount) * 100).toFixed(2) : 0,
        });
      });
    } else {
      reportData.forEach((t) =>
        t.transaction_items.forEach((item: any) => {
          const costPrice = Number(item.stock?.purchase_price || 0);
          const cost = costPrice * (item.quantity || 0);
          const profit = Number(item.total) - cost;

          rows.push({
            Date: format(parseISO(t.created_at), "yyyy-MM-dd HH:mm"),
            "Transaction Number": t.transaction_number,
            Product: item.product?.name,
            Quantity: item.quantity,
            "Selling Price": item.price,
            "Line Total": item.total,
            "Cost Price": costPrice,
            "Total Cost": cost,
            Profit: profit,
            "Profit Margin %":
              item.total > 0 ? ((profit / item.total) * 100).toFixed(2) : 0,
          });
        })
      );
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profit Report");
    XLSX.writeFile(
      wb,
      `Profit_Report_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`
    );
  };

  // 🚀 Auto-update date range on mode change
  useEffect(() => {
    const today = new Date();
    let start: Date = new Date();
    let end: Date = new Date();

    if (mode === "daily") {
      start = today;
      end = today;
    }

    if (mode === "weekly") {
      const weekStart = new Date();
      weekStart.setDate(today.getDate() - 6);
      start = weekStart;
      end = today;
    }

    if (mode === "monthly") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    }

    if (mode !== "custom")
      setRange([{ startDate: start, endDate: end, key: "selection" }]);
  }, [mode]);

  useEffect(() => {
    if (isAdmin && selectedBranchId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedBranchId, mode, range, basis]);

  // Restrict access to admin only - must be after all hooks
  if (!isAdmin) return <Notfoundpage />;

  return (
    <div className="space-y-6">
      {/* FILTERS */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Date Range
              </label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder="Select date range"
                    className="truncate"
                  />
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="daily" className="truncate">
                    Today
                  </SelectItem>
                  <SelectItem value="weekly" className="truncate">
                    This Week
                  </SelectItem>
                  <SelectItem value="monthly" className="truncate">
                    This Month
                  </SelectItem>
                  <SelectItem value="custom" className="truncate">
                    Custom Range
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Basis
              </label>
              <Select value={basis} onValueChange={setBasis}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder="Select basis"
                    className="truncate"
                  />
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="all" className="truncate">
                    All Sales
                  </SelectItem>
                  <SelectItem value="collected" className="truncate">
                    Payments Received
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button
                  onClick={fetchData}
                  variant="blue"
                  size="sm"
                  disabled={loading}
                  className="flex-1 md:flex-initial"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
                {hasData && (
                  <Button onClick={exportExcel} variant="green" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* DATE PICKER FOR CUSTOM */}
          {mode === "custom" && (
            <div className="mt-2 pt-4 border-t">
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Select Custom Date Range
              </label>
              <div className="flex justify-center">
                <DateRangePicker
                  onChange={(item) =>
                    setRange([
                      {
                        startDate: item.selection.startDate ?? new Date(),
                        endDate: item.selection.endDate ?? new Date(),
                        key: "selection",
                      },
                    ])
                  }
                  moveRangeOnFirstSelection={false}
                  ranges={range}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {basis === "collected" ? "Total Collected" : "Total Revenue"}
                  </p>
                  <p className="text-2xl font-bold">
                    ₱
                    {summary.totalRevenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {basis === "collected" ? "Est. Cost" : "Total Cost"}
                  </p>
                  <p className="text-2xl font-bold">
                    ₱
                    {summary.totalCost.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {basis === "collected" ? "Est. Profit" : "Total Profit"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    ₱
                    {summary.totalProfit.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Profit Margin</p>
                  <p
                    className={`text-2xl font-bold ${summary.profitMargin >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {summary.profitMargin.toFixed(2)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit Report</CardTitle>
          {basis === "collected" && (
            <p className="text-sm text-gray-500">
              Based on payments received (by payment date). Cost and profit are
              estimated per payment in proportion to each transaction&apos;s
              margin.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !hasData ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No records found</p>
            </div>
          ) : basis === "collected" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 text-left font-semibold">Payment Date</th>
                    <th className="p-3 text-left font-semibold">
                      Transaction #
                    </th>
                    <th className="p-3 text-left font-semibold">Method</th>
                    <th className="p-3 text-right font-semibold">
                      Amount Collected
                    </th>
                    <th className="p-3 text-right font-semibold">Est. Cost</th>
                    <th className="p-3 text-right font-semibold">Est. Profit</th>
                    <th className="p-3 text-right font-semibold">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {collectedRows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        {format(parseISO(r.payment_date), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="p-3 font-medium">
                        {r.transaction_number}
                      </td>
                      <td className="p-3">{r.payment_method || "-"}</td>
                      <td className="p-3 text-right font-semibold">
                        ₱
                        {r.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right">
                        ₱
                        {r.cost.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`p-3 text-right font-semibold ${r.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        ₱
                        {r.profit.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`p-3 text-right font-semibold ${r.margin >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {r.margin.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 text-left font-semibold">Date</th>
                    <th className="p-3 text-left font-semibold">
                      Transaction #
                    </th>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-right font-semibold">Qty</th>
                    <th className="p-3 text-right font-semibold">
                      Selling Price
                    </th>
                    <th className="p-3 text-right font-semibold">Cost Price</th>
                    <th className="p-3 text-right font-semibold">Line Total</th>
                    <th className="p-3 text-right font-semibold">Profit</th>
                    <th className="p-3 text-right font-semibold">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((t) =>
                    t.transaction_items.map((item: any, idx: number) => {
                      const costPrice = Number(
                        item.stock?.purchase_price || 0
                      );
                      const cost = costPrice * (item.quantity || 0);
                      const profit = Number(item.total) - cost;
                      const margin =
                        Number(item.total) > 0
                          ? (profit / Number(item.total)) * 100
                          : 0;

                      return (
                        <tr
                          key={t.id + "-" + idx}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-3">
                            {format(
                              parseISO(t.created_at),
                              "MMM dd, yyyy HH:mm"
                            )}
                          </td>
                          <td className="p-3 font-medium">
                            {t.transaction_number}
                          </td>
                          <td className="p-3">{item.product?.name || "-"}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">
                            ₱
                            {Number(item.price).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3 text-right">
                            ₱
                            {costPrice.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            ₱
                            {Number(item.total).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`p-3 text-right font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            ₱
                            {profit.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`p-3 text-right font-semibold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {margin.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
