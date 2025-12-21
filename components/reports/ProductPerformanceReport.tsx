/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { saveAs } from "file-saver";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export const ProductPerformanceReport = () => {
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [reportData, setReportData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("revenue"); // revenue, quantity, transactions

  const fetchData = async () => {
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

    const start = formatLocalDate(startDate);
    const end = formatLocalDate(endDate);

    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          transaction_items(
            product_id,
            quantity,
            price,
            total,
            product:product_id(name, category)
          )
        `
        )
        .eq("branch_id", selectedBranchId)
        .gte("created_at", `${start} 00:00:00`)
        .lte("created_at", `${end} 23:59:59`);

      if (error) throw error;

      // Group by product
      const productMap = new Map<number, any>();

      transactions?.forEach((tx: any) => {
        tx.transaction_items?.forEach((item: any) => {
          const productId = item.product_id;
          if (!productId) return;

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              productId,
              productName: item.product?.name || "Unknown",
              category: item.product?.category || "Uncategorized",
              totalRevenue: 0,
              totalQuantity: 0,
              transactionCount: 0,
              averagePrice: 0,
            });
          }

          const product = productMap.get(productId)!;
          product.totalRevenue += Number(item.total) || 0;
          product.totalQuantity += Number(item.quantity) || 0;
          product.transactionCount += 1;
        });
      });

      const data = Array.from(productMap.values()).map((p) => ({
        ...p,
        averagePrice:
          p.totalQuantity > 0 ? p.totalRevenue / p.totalQuantity : 0,
      }));

      // Sort data
      data.sort((a, b) => {
        if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
        if (sortBy === "quantity") return b.totalQuantity - a.totalQuantity;
        return b.transactionCount - a.transactionCount;
      });

      setReportData(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, sortBy, selectedBranchId]);

  const filteredData = reportData.filter(
    (p) =>
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const exportExcel = () => {
    const rows = filteredData.map((item) => ({
      "Product Name": item.productName,
      Category: item.category,
      "Total Revenue": item.totalRevenue,
      "Quantity Sold": item.totalQuantity,
      Transactions: item.transactionCount,
      "Average Price": item.averagePrice,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Performance");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf]),
      `product_performance_report_${format(new Date(), "yyyyMMdd")}.xlsx`
    );
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
                Start Date
              </label>
              <Input
                type="date"
                className="h-10 w-full"
                value={format(startDate, "yyyy-MM-dd")}
                onChange={(e) => setStartDate(new Date(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                End Date
              </label>
              <Input
                type="date"
                className="h-10 w-full"
                value={format(endDate, "yyyy-MM-dd")}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select sort" className="truncate" />
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="revenue" className="truncate">
                    Revenue
                  </SelectItem>
                  <SelectItem value="quantity" className="truncate">
                    Quantity
                  </SelectItem>
                  <SelectItem value="transactions" className="truncate">
                    Transactions
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions and Search Row */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t">
            <div className="flex gap-2 flex-1">
              <Button
                onClick={fetchData}
                variant="blue"
                size="sm"
                disabled={loading}
                className="flex-1 sm:flex-initial"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              {filteredData.length > 0 && (
                <Button onClick={exportExcel} variant="green" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search product or category..."
                className="pl-10 h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Performance Report</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No product data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Rank</th>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-left font-semibold">Category</th>
                    <th className="p-3 text-right font-semibold">
                      Total Revenue
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Quantity Sold
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Transactions
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Average Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr
                      key={item.productId}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : idx === 1
                                ? "bg-gray-100 text-gray-700"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{item.productName}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3 text-right font-semibold">
                        ₱
                        {item.totalRevenue.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right">{item.totalQuantity}</td>
                      <td className="p-3 text-right">
                        {item.transactionCount}
                      </td>
                      <td className="p-3 text-right">
                        ₱
                        {item.averagePrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
