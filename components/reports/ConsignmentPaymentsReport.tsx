/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

import { useAppSelector } from "@/lib/redux/hook";
import {
  ConsignmentPaymentRow,
  ConsignmentPaymentSummary,
  fetchConsignmentCollections,
  fetchConsignmentsForPeriod,
} from "@/lib/utils/consignmentPayments";
import { exportReportPdf } from "@/lib/utils/reportPdf";
import { format, parseISO } from "date-fns";
import {
  Banknote,
  Download,
  Loader2,
  RefreshCw,
  Receipt,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const money = (n: any) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const periodOf = (c: ConsignmentPaymentSummary) =>
  c.month >= 1 && c.month <= 12 ? `${MONTHS[c.month - 1]} ${c.year}` : "-";

const statusClass = (status: string) =>
  status === "Paid"
    ? "bg-green-100 text-green-700"
    : status === "Unpaid"
      ? "bg-red-100 text-red-700"
      : "bg-orange-100 text-orange-700";

/**
 * Consignment collections.
 *
 * Payments on a consignment are recorded against the consignment, not against
 * the individual `consignment_sale` transactions, so they are invisible to the
 * sales report's payment columns. This is where that money is reported: what
 * was collected in the period, and where every consignment stands (Paid /
 * Partial / Unpaid) against what it has actually sold.
 */
export const ConsignmentPaymentsReport = () => {
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
  const [status, setStatus] = useState("All"); // All / Paid / Partial / Unpaid

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<ConsignmentPaymentRow[]>([]);
  const [consignments, setConsignments] = useState<ConsignmentPaymentSummary[]>(
    []
  );
  const [byId, setById] = useState<Map<number, ConsignmentPaymentSummary>>(
    new Map()
  );

  // 🚀 Auto-update date range on mode change
  useEffect(() => {
    const today = new Date();
    let start: Date = new Date();
    const end: Date = today;

    if (mode === "daily") start = today;
    if (mode === "weekly") {
      const weekStart = new Date();
      weekStart.setDate(today.getDate() - 6);
      start = weekStart;
    }
    if (mode === "monthly")
      start = new Date(today.getFullYear(), today.getMonth(), 1);

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

    const collections = await fetchConsignmentCollections({
      branchId: selectedBranchId,
      start,
      end,
    });

    if (collections.error) {
      toast.error("Failed to load consignment payments");
      setLoading(false);
      return;
    }

    // Consignments opened in the period, plus any older one collected against
    // during it — those payments belong in this report too.
    const listed = await fetchConsignmentsForPeriod({
      branchId: selectedBranchId,
      start,
      end,
      extraIds: collections.payments.map((p) => p.consignment_id),
    });

    setPayments(collections.payments);
    setConsignments(listed);
    setById(new Map(listed.map((c) => [c.id, c])));
    setLoading(false);
  };

  useEffect(() => {
    if (selectedBranchId) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, range, selectedBranchId]);

  // The status filter scopes both tables: the payments listed are the ones made
  // against the consignments shown.
  const visibleConsignments =
    status === "All"
      ? consignments
      : consignments.filter((c) => c.status === status);

  const visibleIds = new Set(visibleConsignments.map((c) => c.id));
  const visiblePayments = payments.filter((p) => visibleIds.has(p.consignment_id));

  const totalCollected = visiblePayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const totalSold = visibleConsignments.reduce(
    (sum, c) => sum + c.totalSoldValue,
    0
  );
  const totalPaid = visibleConsignments.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalOutstanding = visibleConsignments.reduce(
    (sum, c) => sum + Math.max(c.balanceDue, 0),
    0
  );
  const paidCount = visibleConsignments.filter(
    (c) => c.status === "Paid"
  ).length;

  const downloadPdf = () => {
    if (!visiblePayments.length && !visibleConsignments.length) return;

    const meta = [
      `Period: ${format(range[0].startDate, "MMM dd, yyyy")} - ${format(
        range[0].endDate,
        "MMM dd, yyyy"
      )}`,
      `Status: ${status}`,
      "Collected = consignment payments dated by payment date. Status is per consignment: what it sold vs. what has been collected.",
    ];

    exportReportPdf({
      title: "Consignment Payments",
      fileName: "Consignment_Payments",
      meta,
      summary: [
        { label: "Collected (period)", value: money(totalCollected) },
        { label: "Payments", value: String(visiblePayments.length) },
        { label: "Sold Value", value: money(totalSold) },
        { label: "Outstanding", value: money(totalOutstanding) },
      ],
      columns: [
        "Payment Date",
        "Consignment #",
        "Customer",
        "Method",
        "Reference",
        "CR #",
        "Amount",
        "Consignment Status",
      ],
      numericColumns: [6],
      rows: visiblePayments.map((p) => {
        const c = byId.get(p.consignment_id);
        return [
          p.payment_date
            ? format(parseISO(p.payment_date), "MMM dd, yyyy")
            : "-",
          c?.consignment_number || "-",
          c?.customer_name || "-",
          p.payment_method || "-",
          p.reference_number || "-",
          p.collection_receipt_number || "-",
          money(p.amount),
          c?.status || "-",
        ];
      }),
    });
  };

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

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Payment Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
              {(visiblePayments.length > 0 ||
                visibleConsignments.length > 0) && (
                <Button onClick={downloadPdf} variant="green" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500">Collected</p>
                  <CardInfo
                    label="Collected"
                    text="Cash actually received on consignments in the selected period, dated by payment date. A payment on an older consignment still counts here."
                  />
                </div>
                <p className="text-2xl font-bold">₱{money(totalCollected)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {visiblePayments.length} payment
                  {visiblePayments.length === 1 ? "" : "s"}
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
                  <p className="text-sm text-gray-500">Sold Value</p>
                  <CardInfo
                    label="Sold Value"
                    text="What the listed consignments have sold — the amount payable to Medwise. Items still on the customer's shelf are not included."
                  />
                </div>
                <p className="text-2xl font-bold">₱{money(totalSold)}</p>
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
                  <p className="text-sm text-gray-500">Total Paid</p>
                  <CardInfo
                    label="Total Paid"
                    text="Everything ever collected on the listed consignments, including payments made outside the selected period."
                  />
                </div>
                <p className="text-2xl font-bold">₱{money(totalPaid)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {paidCount} of {visibleConsignments.length} fully paid
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
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <CardInfo
                    label="Outstanding"
                    text="Sold Value minus Total Paid across the listed consignments — what is still to be collected."
                  />
                </div>
                <p className="text-2xl font-bold text-red-600">
                  ₱{money(totalOutstanding)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PAYMENTS RECEIVED */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payments Received</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : visiblePayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No consignment payments found for selected criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 text-left font-semibold">
                      Payment Date
                    </th>
                    <th className="p-3 text-left font-semibold">
                      Consignment #
                    </th>
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-left font-semibold">Method</th>
                    <th className="p-3 text-left font-semibold">Reference</th>
                    <th className="p-3 text-left font-semibold">CR #</th>
                    <th className="p-3 text-right font-semibold">Amount</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.map((p) => {
                    const c = byId.get(p.consignment_id);
                    return (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          {p.payment_date
                            ? format(parseISO(p.payment_date), "MMM dd, yyyy")
                            : "-"}
                        </td>
                        <td className="p-3 font-medium">
                          {c?.consignment_number || "-"}
                        </td>
                        <td className="p-3">{c?.customer_name || "-"}</td>
                        <td className="p-3">{p.payment_method || "-"}</td>
                        <td className="p-3">{p.reference_number || "-"}</td>
                        <td className="p-3">
                          {p.collection_receipt_number || "-"}
                        </td>
                        <td className="p-3 text-right font-semibold text-green-700">
                          ₱{money(p.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs ${statusClass(
                              c?.status || "-"
                            )}`}
                          >
                            {c?.status || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3" colSpan={6}>
                      Total Collected
                    </td>
                    <td className="p-3 text-right text-green-700">
                      ₱{money(totalCollected)}
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONSIGNMENT PAYMENT STATUS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consignment Payment Status</CardTitle>
          <p className="text-sm text-gray-500">
            Consignments opened in the period, plus any older consignment
            collected against during it.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : visibleConsignments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No consignments found for selected criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 text-left font-semibold">
                      Consignment #
                    </th>
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-left font-semibold">Period</th>
                    <th className="p-3 text-right font-semibold">Sold Value</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Balance</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleConsignments.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">
                        {c.consignment_number}
                      </td>
                      <td className="p-3">{c.customer_name || "-"}</td>
                      <td className="p-3">{periodOf(c)}</td>
                      <td className="p-3 text-right">
                        ₱{money(c.totalSoldValue)}
                      </td>
                      <td className="p-3 text-right text-green-700">
                        ₱{money(c.totalPaid)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        <span
                          className={
                            c.balanceDue > 0 ? "text-red-600" : "text-gray-400"
                          }
                        >
                          ₱{money(Math.max(c.balanceDue, 0))}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs ${statusClass(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3" colSpan={3}>
                      Total
                    </td>
                    <td className="p-3 text-right">₱{money(totalSold)}</td>
                    <td className="p-3 text-right text-green-700">
                      ₱{money(totalPaid)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      ₱{money(totalOutstanding)}
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
