"use client";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { differenceInDays, format, isBefore, parseISO } from "date-fns";
import { saveAs } from "file-saver";
import { Download, Loader2, RefreshCw } from "lucide-react";
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

const today = new Date();

type ProductStockExpiry = {
  id: number;
  product_id: number;
  product_name: string;
  batch_no: string | null;
  remaining_quantity: number;
  expiration_date: string | null;
  manufacturer: string | null;
  date_manufactured: string | null;
  supplier_name: string | null;
};

export const ExpiryReport = () => {
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );
  const [list, setList] = useState<ProductStockExpiry[]>([]);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("monthly"); // daily / weekly / monthly / custom

  const [range, setRange] = useState([
    {
      startDate: today,
      endDate: new Date(
        today.getFullYear(),
        today.getMonth() + 3,
        today.getDate()
      ),
      key: "selection",
    },
  ]);

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

  const fetchExpiringStocks = async () => {
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_stocks")
        .select(
          `
          *,
          product:product_id(name, category),
          supplier:supplier_id(name)
        `
        )
        .eq("branch_id", selectedBranchId)
        .gte("remaining_quantity", 1)
        .not("expiration_date", "is", null)
        .gte("expiration_date", range[0].startDate.toISOString())
        .lte("expiration_date", range[0].endDate.toISOString())
        .order("expiration_date", { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((d) => ({
        id: d.id,
        product_id: d.product_id,
        product_name: d.product?.name || "",
        batch_no: d.batch_no,
        remaining_quantity: d.remaining_quantity,
        expiration_date: d.expiration_date,
        manufacturer: d.manufacturer,
        date_manufactured: d.date_manufactured,
        supplier_name: d.supplier?.name || "-",
      }));

      setList(formatted);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch expiring stocks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      fetchExpiringStocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, mode, range]);

  // ---------- EXPORT TO EXCEL ----------
  const exportToExcel = () => {
    const wsData = list.map((item) => ({
      Product: item.product_name,
      "Batch #": item.batch_no || "-",
      Supplier: item.supplier_name,
      "Remaining Qty": item.remaining_quantity,
      Manufacturer: item.manufacturer || "-",
      "Mfg Date": item.date_manufactured
        ? format(parseISO(item.date_manufactured), "MMM dd, yyyy")
        : "-",
      "Expiry Date": item.expiration_date
        ? format(parseISO(item.expiration_date), "MMM dd, yyyy")
        : "-",
      "Days to Expiry": item.expiration_date
        ? differenceInDays(parseISO(item.expiration_date), new Date())
        : "-",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Expiry Report");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `expiry_report_${new Date().toISOString()}.xlsx`);
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
                    Next 3 Months
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
                  onClick={fetchExpiringStocks}
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
                {list.length > 0 && (
                  <Button onClick={exportToExcel} variant="green" size="sm">
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

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expiry Report</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No expiring products found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-left font-semibold">
                      Batch / Supplier
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Remaining Qty
                    </th>
                    <th className="p-3 text-left font-semibold">
                      Mfg Date / Exp
                    </th>
                    <th className="p-3 text-center font-semibold">
                      Days to Expiry
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => {
                    const exp = item.expiration_date
                      ? format(parseISO(item.expiration_date), "MMM dd, yyyy")
                      : "-";
                    const mfg = item.date_manufactured
                      ? format(parseISO(item.date_manufactured), "MMM dd, yyyy")
                      : "-";
                    const today = new Date();
                    const isExpired = item.expiration_date
                      ? isBefore(parseISO(item.expiration_date), today)
                      : false;
                    const daysToExpiry = item.expiration_date
                      ? differenceInDays(parseISO(item.expiration_date), today)
                      : null;

                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{item.product_name}</td>
                        <td className="p-3">
                          {item.batch_no && <>Batch: {item.batch_no}, </>}
                          Supplier: {item.supplier_name}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {item.remaining_quantity}
                        </td>
                        <td className="p-3">
                          {item.manufacturer && <>Mfg: {item.manufacturer}, </>}
                          {item.date_manufactured && <>Date: {mfg}, </>}
                          Exp: {exp}
                          {isExpired && (
                            <span className="ml-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                              Expired
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {daysToExpiry !== null && (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                daysToExpiry < 0
                                  ? "bg-red-100 text-red-700"
                                  : daysToExpiry <= 30
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {daysToExpiry < 0
                                ? `${Math.abs(daysToExpiry)} days ago`
                                : `${daysToExpiry} days`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
