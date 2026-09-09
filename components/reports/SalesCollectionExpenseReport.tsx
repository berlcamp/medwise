/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { REPORTABLE_SALE_TYPES } from "@/lib/constants";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { exportReportPdf } from "@/lib/utils/reportPdf";
import { fetchConsignmentCollections } from "@/lib/utils/consignmentPayments";
import {
  addDays,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import {
  Banknote,
  Download,
  Loader2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CardInfo } from "./CardInfo";

const money = (n: any) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Local YYYY-MM-DD so a date never shifts a day through UTC conversion.
const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type GroupBy = "day" | "week" | "month";

interface PeriodRow {
  key: string;
  label: string;
  sortKey: string;
  sales: number;
  collection: number;
  expenses: number;
}

// One date → the bucket it belongs to, for the selected grouping.
const bucketOf = (date: Date, groupBy: GroupBy) => {
  if (groupBy === "month") {
    const start = startOfMonth(date);
    return {
      key: format(start, "yyyy-MM"),
      label: format(start, "MMM yyyy"),
      sortKey: format(start, "yyyy-MM-dd"),
    };
  }
  if (groupBy === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return {
      key: format(start, "yyyy-'W'II"),
      label: `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`,
      sortKey: format(start, "yyyy-MM-dd"),
    };
  }
  return {
    key: format(date, "yyyy-MM-dd"),
    label: format(date, "MMM dd, yyyy"),
    sortKey: format(date, "yyyy-MM-dd"),
  };
};

/**
 * Sales vs Collection vs Expenses.
 *
 * Three different money questions, side by side, on the same periods:
 *  - Sales      — what was invoiced (accrual): transaction totals, dated by the
 *                 transaction date, across all reportable sale channels
 *                 (bulk + consignment sales + agent sales). Consignment
 *                 hand-offs are excluded — they are goods on loan, not sales.
 *  - Collection — cash actually received: `transaction_payments` plus
 *                 `consignment_payments` (consignments are settled as a whole,
 *                 so their collections never touch a sale row), dated by
 *                 payment date. Includes payments on invoices from earlier
 *                 periods, so it can exceed Sales for the same range.
 *  - Expenses   — money paid out: `expenses`, dated by expense date.
 *
 * Net Cash Flow is Collection − Expenses (cash in vs cash out). Net Margin is
 * Sales − Expenses, which measures the period on an accrual basis instead.
 */
export const SalesCollectionExpenseReport = () => {
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );

  const today = new Date();
  const [range, setRange] = useState([
    {
      startDate: startOfMonth(today),
      endDate: today,
      key: "selection",
    },
  ]);
  const [mode, setMode] = useState("monthly"); // monthly / quarter / yearly / custom
  const [groupBy, setGroupBy] = useState<GroupBy>("day");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalCollection: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    netMargin: 0,
    collectionRate: 0,
  });

  // 🚀 Auto-update date range on mode change
  useEffect(() => {
    const now = new Date();
    let start: Date = startOfMonth(now);
    const end: Date = now;

    if (mode === "monthly") {
      start = startOfMonth(now);
      setGroupBy("day");
    }
    if (mode === "quarter") {
      start = startOfMonth(subMonths(now, 2));
      setGroupBy("week");
    }
    if (mode === "yearly") {
      start = startOfYear(now);
      setGroupBy("month");
    }

    if (mode !== "custom")
      setRange([{ startDate: start, endDate: end, key: "selection" }]);
  }, [mode]);

  const loadReport = async () => {
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);

    const start = formatLocalDate(range[0].startDate);
    const end = formatLocalDate(range[0].endDate);

    // 1️⃣ Sales — invoiced amounts, dated by transaction date.
    const salesPromise = supabase
      .from("transactions")
      .select("id, created_at, total_amount, transaction_type")
      .eq("branch_id", selectedBranchId)
      .in("transaction_type", REPORTABLE_SALE_TYPES)
      .gte("created_at", `${start} 00:00:00`)
      .lte("created_at", `${end} 23:59:59`);

    // 2️⃣ Collection — payments received, dated by payment date. The payments
    //    table has no branch column, so the parent transactions are loaded
    //    below to scope by branch and exclude consignment hand-offs.
    const paymentsPromise = supabase
      .from("transaction_payments")
      .select("id, amount, payment_date, transaction_id")
      .gte("payment_date", `${start} 00:00:00`)
      .lte("payment_date", `${end} 23:59:59`);

    // 3️⃣ Expenses — money paid out, dated by expense date.
    const expensesPromise = supabase
      .from("expenses")
      .select("id, expense_date, amount")
      .eq("branch_id", selectedBranchId)
      .gte("expense_date", start)
      .lte("expense_date", end);

    const [salesRes, paymentsRes, expensesRes] = await Promise.all([
      salesPromise,
      paymentsPromise,
      expensesPromise,
    ]);

    if (salesRes.error || paymentsRes.error || expensesRes.error) {
      console.error(salesRes.error || paymentsRes.error || expensesRes.error);
      toast.error("Failed to load report data");
      setLoading(false);
      return;
    }

    const salesData = salesRes.data || [];
    const paymentsData = paymentsRes.data || [];
    const expensesData = expensesRes.data || [];

    // Keep only payments whose transaction belongs to this branch and is a
    // reportable sale, so Collection lines up with what Sales counts.
    const txnIds = Array.from(
      new Set(paymentsData.map((p: any) => p.transaction_id).filter(Boolean))
    );
    const allowedTxnIds = new Set<number>();

    if (txnIds.length > 0) {
      const { data: txns, error: tErr } = await supabase
        .from("transactions")
        .select("id")
        .in("id", txnIds)
        .eq("branch_id", selectedBranchId)
        .in("transaction_type", REPORTABLE_SALE_TYPES);

      if (tErr) {
        console.error(tErr);
        toast.error("Failed to load payment transactions");
        setLoading(false);
        return;
      }

      (txns || []).forEach((t: any) => allowedTxnIds.add(t.id));
    }

    // Consignment collections are recorded against the consignment, not
    // against the `consignment_sale` transactions, so `transaction_payments`
    // never sees them — without this, Collection ignored every peso collected
    // on a consignment while Sales still counted the sale.
    const consignmentCollections = await fetchConsignmentCollections({
      branchId: selectedBranchId,
      start,
      end,
    });

    if (consignmentCollections.error) {
      toast.error("Consignment collections could not be loaded");
    }

    // Fold all three sources into one bucket per period.
    const buckets = new Map<string, PeriodRow>();

    const bump = (
      date: Date,
      field: "sales" | "collection" | "expenses",
      amount: number
    ) => {
      const b = bucketOf(date, groupBy);
      const existing =
        buckets.get(b.key) ||
        ({
          key: b.key,
          label: b.label,
          sortKey: b.sortKey,
          sales: 0,
          collection: 0,
          expenses: 0,
        } as PeriodRow);
      existing[field] += amount;
      buckets.set(b.key, existing);
    };

    let totalSales = 0;
    let totalCollection = 0;
    let totalExpenses = 0;

    salesData.forEach((t: any) => {
      if (!t.created_at) return;
      const amount = Number(t.total_amount) || 0;
      totalSales += amount;
      bump(parseISO(t.created_at), "sales", amount);
    });

    paymentsData.forEach((p: any) => {
      if (!p.payment_date) return;
      if (!allowedTxnIds.has(p.transaction_id)) return;
      const amount = Number(p.amount) || 0;
      totalCollection += amount;
      bump(parseISO(p.payment_date), "collection", amount);
    });

    consignmentCollections.payments.forEach((p) => {
      if (!p.payment_date) return;
      const amount = Number(p.amount) || 0;
      totalCollection += amount;
      bump(parseISO(p.payment_date), "collection", amount);
    });

    expensesData.forEach((e: any) => {
      if (!e.expense_date) return;
      const amount = Number(e.amount) || 0;
      totalExpenses += amount;
      bump(parseISO(e.expense_date), "expenses", amount);
    });

    const periodRows = Array.from(buckets.values()).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );

    setRows(periodRows);
    setSummary({
      totalSales,
      totalCollection,
      totalExpenses,
      netCashFlow: totalCollection - totalExpenses,
      netMargin: totalSales - totalExpenses,
      collectionRate: totalSales > 0 ? (totalCollection / totalSales) * 100 : 0,
    });

    setLoading(false);
  };

  const downloadPdf = () => {
    if (!rows.length) return;

    const groupLabel =
      groupBy === "day" ? "Daily" : groupBy === "week" ? "Weekly" : "Monthly";

    exportReportPdf({
      title: "Sales vs Collection vs Expenses",
      fileName: "Sales_Collection_Expenses",
      meta: [
        `Period: ${format(range[0].startDate, "MMM dd, yyyy")} - ${format(
          range[0].endDate,
          "MMM dd, yyyy"
        )}`,
        `Grouped: ${groupLabel}`,
        "Sales = invoiced amounts dated by transaction date. Collection = payments received dated by payment date.",
        "Expenses = expenses dated by expense date. Net Cash Flow = Collection - Expenses.",
      ],
      summary: [
        { label: "Total Sales", value: money(summary.totalSales) },
        { label: "Total Collection", value: money(summary.totalCollection) },
        { label: "Total Expenses", value: money(summary.totalExpenses) },
        { label: "Net Cash Flow", value: money(summary.netCashFlow) },
        {
          label: "Collection Rate",
          value: `${summary.collectionRate.toFixed(2)}%`,
        },
      ],
      columns: [
        "Period",
        "Sales",
        "Collection",
        "Expenses",
        "Net Cash Flow",
        "Net Margin",
        "Collection Rate",
      ],
      numericColumns: [1, 2, 3, 4, 5, 6],
      rows: [
        ...rows.map((r) => [
          r.label,
          money(r.sales),
          money(r.collection),
          money(r.expenses),
          money(r.collection - r.expenses),
          money(r.sales - r.expenses),
          r.sales > 0 ? `${((r.collection / r.sales) * 100).toFixed(2)}%` : "-",
        ]),
        [
          "TOTAL",
          money(summary.totalSales),
          money(summary.totalCollection),
          money(summary.totalExpenses),
          money(summary.netCashFlow),
          money(summary.netMargin),
          `${summary.collectionRate.toFixed(2)}%`,
        ],
      ],
    });
  };

  useEffect(() => {
    if (selectedBranchId) {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, range, groupBy, selectedBranchId]);

  const chartData = rows.map((r) => ({
    period: r.label,
    Sales: Number(r.sales.toFixed(2)),
    Collection: Number(r.collection.toFixed(2)),
    Expenses: Number(r.expenses.toFixed(2)),
  }));

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Mode */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Date Range
              </label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                  <SelectItem value="yearly">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Group By */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Group By
              </label>
              <Select
                value={groupBy}
                onValueChange={(v) => setGroupBy(v as GroupBy)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <div className="flex gap-2">
              <Button
                onClick={loadReport}
                variant="blue"
                size="sm"
                disabled={loading || !selectedBranchId}
                className="flex-1 sm:flex-initial"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              {rows.length > 0 && (
                <Button onClick={downloadPdf} variant="green" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
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
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Total Sales</p>
                    <CardInfo
                      label="Total Sales"
                      text="What was invoiced in the period: the total of every bulk, consignment and agent sale dated by its transaction date. Consignment hand-offs (goods on loan) are excluded."
                    />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    ₱{money(summary.totalSales)}
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
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Total Collection</p>
                    <CardInfo
                      label="Total Collection"
                      text="Cash actually received in the period, dated by payment date — invoice payments plus collections on consignments. This includes payments on invoices issued in earlier periods, so it can be higher than Total Sales for the same range."
                    />
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    ₱{money(summary.totalCollection)}
                  </p>
                </div>
                <Banknote className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Total Expenses</p>
                    <CardInfo
                      label="Total Expenses"
                      text="Money paid out in the period: every expense recorded for this branch, dated by its expense date."
                    />
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    ₱{money(summary.totalExpenses)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Net Cash Flow</p>
                    <CardInfo
                      label="Net Cash Flow"
                      text="Total Collection minus Total Expenses — the cash the branch actually gained or lost in the period. A negative figure means more went out than came in."
                    />
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      summary.netCashFlow < 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    ₱{money(summary.netCashFlow)}
                  </p>
                </div>
                <Scale className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECONDARY FIGURES */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-sm text-gray-500">Collection Rate</p>
                <CardInfo
                  label="Collection Rate"
                  text="Total Collection divided by Total Sales for the period. Under 100% means part of what was invoiced is still uncollected; over 100% means older receivables were collected during this period."
                />
              </div>
              <p className="text-2xl font-bold">
                {summary.collectionRate.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-sm text-gray-500">
                  Net Margin (Sales − Expenses)
                </p>
                <CardInfo
                  label="Net Margin (Sales − Expenses)"
                  text="Total Sales minus Total Expenses. This measures the period on an accrual basis — it counts everything invoiced, whether or not it has been paid yet. Note this subtracts operating expenses from revenue, not cost of goods sold; use the Profit report for gross margin."
                />
              </div>
              <p
                className={`text-2xl font-bold ${
                  summary.netMargin < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                ₱{money(summary.netMargin)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* COMPARISON CHART */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Sales vs Collection vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  interval="preserveStartEnd"
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: any) => `₱${money(value)}`}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend />
                <Bar dataKey="Sales" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="Collection"
                  fill="#22c55e"
                  radius={[6, 6, 0, 0]}
                />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* BREAKDOWN TABLE */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Period Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="app__table">
                <thead className="app__thead">
                  <tr>
                    <th className="app__th">Period</th>
                    <th className="app__th text-right">Sales</th>
                    <th className="app__th text-right">Collection</th>
                    <th className="app__th text-right">Expenses</th>
                    <th className="app__th text-right">Net Cash Flow</th>
                    <th className="app__th text-right">Net Margin</th>
                    <th className="app__th text-right">Collection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const netCash = r.collection - r.expenses;
                    const netMargin = r.sales - r.expenses;
                    return (
                      <tr key={r.key} className="app__tr">
                        <td className="app__td">{r.label}</td>
                        <td className="app__td text-right text-blue-600">
                          ₱{money(r.sales)}
                        </td>
                        <td className="app__td text-right text-green-600">
                          ₱{money(r.collection)}
                        </td>
                        <td className="app__td text-right text-red-600">
                          ₱{money(r.expenses)}
                        </td>
                        <td
                          className={`app__td text-right font-medium ${
                            netCash < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          ₱{money(netCash)}
                        </td>
                        <td
                          className={`app__td text-right ${
                            netMargin < 0 ? "text-red-600" : ""
                          }`}
                        >
                          ₱{money(netMargin)}
                        </td>
                        <td className="app__td text-right">
                          {r.sales > 0
                            ? `${((r.collection / r.sales) * 100).toFixed(2)}%`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="app__tr font-semibold bg-gray-50">
                    <td className="app__td">TOTAL</td>
                    <td className="app__td text-right">
                      ₱{money(summary.totalSales)}
                    </td>
                    <td className="app__td text-right">
                      ₱{money(summary.totalCollection)}
                    </td>
                    <td className="app__td text-right">
                      ₱{money(summary.totalExpenses)}
                    </td>
                    <td
                      className={`app__td text-right ${
                        summary.netCashFlow < 0 ? "text-red-600" : ""
                      }`}
                    >
                      ₱{money(summary.netCashFlow)}
                    </td>
                    <td
                      className={`app__td text-right ${
                        summary.netMargin < 0 ? "text-red-600" : ""
                      }`}
                    >
                      ₱{money(summary.netMargin)}
                    </td>
                    <td className="app__td text-right">
                      {summary.collectionRate.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Sales is what was invoiced (dated by transaction date). Collection
              is cash received (dated by payment date) and can include payments
              on invoices from earlier periods, so it may exceed Sales for the
              same range.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && rows.length === 0 && (
        <div className="py-10 text-center text-gray-400">
          No sales, collections or expenses found for the selected period.
        </div>
      )}
    </div>
  );
};

export default SalesCollectionExpenseReport;
