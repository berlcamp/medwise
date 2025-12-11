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

  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
  });

  const fetchData = async () => {
    if (!isAdmin) return;
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);
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
      .gte("created_at", range[0].startDate?.toISOString())
      .lte("created_at", range[0].endDate?.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load data");
      console.error(error);
      setLoading(false);
      return;
    }

    const transactionsData = transactions || [];
    setReportData(transactionsData);

    // Calculate summary
    let totalRevenue = 0;
    let totalCost = 0;

    transactionsData.forEach((t: any) => {
      t.transaction_items.forEach((item: any) => {
        const revenue = Number(item.total) || 0;
        const costPrice = Number(
          item.stock?.purchase_price || item.product?.purchase_price || 0
        );
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

  const exportExcel = () => {
    const rows: any[] = [];

    reportData.forEach((t) =>
      t.transaction_items.forEach((item: any) => {
        const costPrice = Number(
          item.stock?.purchase_price || item.product?.purchase_price || 0
        );
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
  }, [isAdmin, selectedBranchId, mode, range]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {reportData.length > 0 && (
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
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
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
                  <p className="text-sm text-gray-500">Total Cost</p>
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
                  <p className="text-sm text-gray-500">Total Profit</p>
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No records found</p>
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
                        item.stock?.purchase_price ||
                          item.product?.purchase_price ||
                          0
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
