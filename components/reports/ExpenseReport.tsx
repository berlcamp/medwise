/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { fetchExpenseCategoryNames } from "@/lib/utils/expenseCategories";
import { exportReportPdf } from "@/lib/utils/reportPdf";
import { format, parseISO } from "date-fns";
import {
  Download,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingDown,
  Wallet,
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

const ALL = "All";

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

/**
 * Expense Report — every expense recorded for the selected branch within the
 * period, with a per-category breakdown so admins can see where the money
 * went. Expenses are dated by `expense_date` (when the money went out), which
 * is the same basis the Sales vs Collection vs Expenses report uses.
 */
export const ExpenseReport = () => {
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );

  const [range, setRange] = useState([
    {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(),
      key: "selection",
    },
  ]);
  const [mode, setMode] = useState("monthly"); // daily / weekly / monthly / custom
  const [category, setCategory] = useState(ALL);
  const [categories, setCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [byCategory, setByCategory] = useState<
    { category: string; amount: number; count: number; share: number }[]
  >([]);
  const [summary, setSummary] = useState({
    totalExpenses: 0,
    entryCount: 0,
    averageExpense: 0,
    topCategory: "-",
  });

  // Categories are admin-editable, so read the current list from the database.
  useEffect(() => {
    let isMounted = true;
    fetchExpenseCategoryNames().then((names) => {
      if (isMounted) setCategories(names);
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  const loadExpenses = async () => {
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);

    const start = formatLocalDate(range[0].startDate);
    const end = formatLocalDate(range[0].endDate);

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("branch_id", selectedBranchId)
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false });

    if (category !== ALL) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      toast.error("Failed to load expenses");
      setLoading(false);
      return;
    }

    const expenses = data || [];
    setRows(expenses);

    const totalExpenses = expenses.reduce(
      (sum: number, e: any) => sum + (Number(e.amount) || 0),
      0
    );
    const entryCount = expenses.length;

    // Per-category breakdown, largest first.
    const catMap = new Map<string, { amount: number; count: number }>();
    expenses.forEach((e: any) => {
      const key = e.category || "Uncategorized";
      const current = catMap.get(key) || { amount: 0, count: 0 };
      current.amount += Number(e.amount) || 0;
      current.count += 1;
      catMap.set(key, current);
    });

    const breakdown = Array.from(catMap.entries())
      .map(([cat, v]) => ({
        category: cat,
        amount: v.amount,
        count: v.count,
        share: totalExpenses > 0 ? (v.amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    setByCategory(breakdown);
    setSummary({
      totalExpenses,
      entryCount,
      averageExpense: entryCount > 0 ? totalExpenses / entryCount : 0,
      topCategory: breakdown.length > 0 ? breakdown[0].category : "-",
    });

    setLoading(false);
  };

  const downloadPdf = () => {
    if (!rows.length) return;

    const meta = [
      `Period: ${format(range[0].startDate, "MMM dd, yyyy")} - ${format(
        range[0].endDate,
        "MMM dd, yyyy"
      )}`,
      `Category: ${category === ALL ? "All Categories" : category}`,
    ];

    const detailRows = rows.map((e: any) => [
      e.expense_date ? format(parseISO(e.expense_date), "MMM dd, yyyy") : "-",
      e.category || "-",
      e.payee || "-",
      e.description || "-",
      e.payment_method || "-",
      e.reference_number || "-",
      money(e.amount),
    ]);

    // Category totals close out the report so the breakdown travels with it.
    const summaryRows = byCategory.map((c) => [
      "",
      c.category,
      "",
      `${c.count} entr${c.count === 1 ? "y" : "ies"}`,
      "",
      `${c.share.toFixed(2)}%`,
      money(c.amount),
    ]);

    exportReportPdf({
      title: "Expense Report",
      fileName: "Expense_Report",
      meta,
      summary: [
        { label: "Total Expenses", value: money(summary.totalExpenses) },
        { label: "Entries", value: String(summary.entryCount) },
        { label: "Avg. Expense", value: money(summary.averageExpense) },
        { label: "Top Category", value: summary.topCategory },
      ],
      columns: [
        "Date",
        "Category",
        "Paid To",
        "Description",
        "Payment Method",
        "Reference / OR No.",
        "Amount",
      ],
      numericColumns: [6],
      rows: [
        ...detailRows,
        ["", "", "", "", "", "", ""],
        ["", "BREAKDOWN BY CATEGORY", "", "", "", "", ""],
        ...summaryRows,
      ],
    });
  };

  useEffect(() => {
    if (selectedBranchId) {
      loadExpenses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, range, category, selectedBranchId]);

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
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="truncate">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <div className="flex gap-2">
              <Button
                onClick={loadExpenses}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Total Expenses</p>
                    <CardInfo
                      label="Total Expenses"
                      text="Sum of every expense recorded for this branch whose expense date falls inside the selected period (and category, if one is selected)."
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
                    <p className="text-sm text-gray-500">Entries</p>
                    <CardInfo
                      label="Entries"
                      text="The number of individual expense records matching the selected filters."
                    />
                  </div>
                  <p className="text-2xl font-bold">{summary.entryCount}</p>
                </div>
                <Receipt className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Avg. Expense</p>
                    <CardInfo
                      label="Avg. Expense"
                      text="Total Expenses divided by the number of entries — the average amount per expense record."
                    />
                  </div>
                  <p className="text-2xl font-bold">
                    ₱{money(summary.averageExpense)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-gray-500">Top Category</p>
                    <CardInfo
                      label="Top Category"
                      text="The expense category with the largest total amount in the selected period."
                    />
                  </div>
                  <p className="text-lg font-bold leading-tight">
                    {summary.topCategory}
                  </p>
                </div>
                <Receipt className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BREAKDOWN BY CATEGORY */}
      {byCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCategory}>
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  interval={0}
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
                <Bar dataKey="amount" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="app__table">
                <thead className="app__thead">
                  <tr>
                    <th className="app__th">Category</th>
                    <th className="app__th text-right">Entries</th>
                    <th className="app__th text-right">Amount</th>
                    <th className="app__th text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c) => (
                    <tr key={c.category} className="app__tr">
                      <td className="app__td">{c.category}</td>
                      <td className="app__td text-right">{c.count}</td>
                      <td className="app__td text-right font-medium">
                        ₱{money(c.amount)}
                      </td>
                      <td className="app__td text-right">
                        {c.share.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DETAILED LIST */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Expense Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="app__table">
                <thead className="app__thead">
                  <tr>
                    <th className="app__th">Date</th>
                    <th className="app__th">Category</th>
                    <th className="app__th">Paid To</th>
                    <th className="app__th">Description</th>
                    <th className="app__th">Payment Method</th>
                    <th className="app__th">Reference / OR No.</th>
                    <th className="app__th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e: any) => (
                    <tr key={e.id} className="app__tr">
                      <td className="app__td">
                        {e.expense_date
                          ? format(parseISO(e.expense_date), "MMM dd, yyyy")
                          : "-"}
                      </td>
                      <td className="app__td">{e.category || "-"}</td>
                      <td className="app__td">{e.payee || "-"}</td>
                      <td className="app__td">{e.description || "-"}</td>
                      <td className="app__td">{e.payment_method || "-"}</td>
                      <td className="app__td">{e.reference_number || "-"}</td>
                      <td className="app__td text-right font-medium">
                        ₱{money(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && rows.length === 0 && (
        <div className="py-10 text-center text-gray-400">
          No expenses found for the selected period.
        </div>
      )}
    </div>
  );
};

export default ExpenseReport;
