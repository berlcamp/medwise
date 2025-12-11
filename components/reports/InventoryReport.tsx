"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { differenceInDays, format, isBefore, parseISO } from "date-fns";
import { saveAs } from "file-saver";
import { Download, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface StockRow {
  product_id: number;
  name: string;
  category: string;
  stock_on_hand: number;
  nearest_expiration: string | null;
}

export default function InventoryReport() {
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (selectedBranchId) {
      loadInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const downloadExcel = () => {
    // Convert your `data` array into sheet rows
    const rows = data.map((i) => ({
      "Product Name": i.name,
      Category: i.category,
      "Stock on Hand": i.stock_on_hand,
      "Nearest Expiry": i.nearest_expiration || "—",
    }));

    // Convert to worksheet
    const ws = XLSX.utils.json_to_sheet(rows);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

    // Export as Excel file
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, "Inventory_Report.xlsx");
  };

  const loadInventory = async () => {
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);

    // Fetch inventory data filtered by branch
    const { data: stocks, error: stocksError } = await supabase
      .from("product_stocks")
      .select(
        `
        product_id,
        remaining_quantity,
        expiration_date,
        product:product_id(id, name, category)
      `
      )
      .eq("branch_id", selectedBranchId)
      .gt("remaining_quantity", 0);

    if (stocksError) {
      console.error("Inventory report error:", stocksError);
      toast.error("Failed to load inventory");
      setLoading(false);
      return;
    }

    // Group by product and calculate totals
    const productMap = new Map<number, StockRow>();

    stocks?.forEach((stock) => {
      const productId = stock.product_id;
      const productArray = stock.product as
        | { id: number; name: string; category: string | null }[]
        | null;
      const product = Array.isArray(productArray)
        ? productArray[0]
        : productArray;

      if (!product) return;

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          product_id: productId,
          name: product.name,
          category: product.category || "Uncategorized",
          stock_on_hand: 0,
          nearest_expiration: null,
        });
      }

      const row = productMap.get(productId)!;
      row.stock_on_hand += stock.remaining_quantity || 0;

      // Track nearest expiration
      if (stock.expiration_date) {
        if (
          !row.nearest_expiration ||
          new Date(stock.expiration_date) < new Date(row.nearest_expiration)
        ) {
          row.nearest_expiration = stock.expiration_date;
        }
      }
    });

    setData(Array.from(productMap.values()));
    setLoading(false);
  };

  // -------- FILTERED DATA ----------
  const filtered = data.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" ? true : item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // -------- GET UNIQUE CATEGORIES ----------
  const categories = [...new Set(data.map((i) => i.category))];

  const getStatusBadge = (exp: string | null) => {
    if (!exp) return <Badge variant="outline">No expiry</Badge>;

    const date = parseISO(exp);
    const today = new Date();

    if (isBefore(date, today)) {
      return <Badge variant="destructive">Expired</Badge>;
    }

    const daysLeft = differenceInDays(date, today);

    if (daysLeft <= 30) {
      return <Badge variant="orange">Expiring Soon</Badge>;
    }

    return <Badge variant="green">Good</Badge>;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder="All Categories"
                    className="truncate"
                  />
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="all" className="truncate">
                    All Categories
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="truncate">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search product or category..."
                  className="pl-10 h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLE */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Inventory Report</CardTitle>
          {filtered.length > 0 && (
            <Button onClick={downloadExcel} variant="green" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No inventory data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-left font-semibold">Category</th>
                    <th className="p-3 text-right font-semibold">
                      Stock on Hand
                    </th>
                    <th className="p-3 text-left font-semibold">
                      Nearest Exp.
                    </th>
                    <th className="p-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const exp = item.nearest_expiration
                      ? format(
                          parseISO(item.nearest_expiration),
                          "MMM dd, yyyy"
                        )
                      : "—";

                    return (
                      <tr
                        key={item.product_id}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.category}</td>
                        <td className="p-3 text-right font-semibold">
                          {item.stock_on_hand}
                        </td>
                        <td className="p-3">{exp}</td>
                        <td className="p-3">
                          {getStatusBadge(item.nearest_expiration)}
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
}
