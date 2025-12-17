/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Notfoundpage from "@/components/Notfoundpage";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = { startDate: Date; endDate: Date; key: string };
type TransactionItem = {
  product: { name: string };
  quantity: number;
  price: number;
  total: number;
};
type Transaction = {
  id: number;
  transaction_number: string;
  created_at: string;
  branch_id: number;
  transaction_items: TransactionItem[];
};
type ProductStock = {
  id: number;
  product: { name: string; category: string };
  remaining_quantity: number;
  reorder_point: number;
};

export default function Page() {
  const [mode, setMode] = useState<"daily" | "weekly" | "monthly" | "custom">(
    "daily"
  );
  const [range, setRange] = useState<Range[]>([
    { startDate: new Date(), endDate: new Date(), key: "selection" },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [previousPeriodSales, setPreviousPeriodSales] = useState(0);
  const [inventoryTotalValue, setInventoryTotalValue] = useState(0);
  const [inventoryValueCurrentPrice, setInventoryValueCurrentPrice] =
    useState(0);

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );
  const user = useAppSelector((state) => state.user.user);
  const isBulkUser = user?.type === "bulk";
  const isAdmin = user?.type === "admin" || user?.type === "super admin";

  const loadDashboard = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    try {
      const today = new Date();
      let start: Date, end: Date;

      switch (mode) {
        case "daily":
          start = today;
          end = today;
          break;
        case "weekly":
          start = startOfWeek(today, { weekStartsOn: 1 });
          end = today;
          break;
        case "monthly":
          start = startOfMonth(today);
          end = today;
          break;
        case "custom":
          start = range[0].startDate;
          end = range[0].endDate;
          break;
        default:
          start = today;
          end = today;
      }

      const startDateObj = new Date(start);
      startDateObj.setHours(0, 0, 0, 0);

      const endDateObj = new Date(end);
      endDateObj.setHours(23, 59, 59, 999);

      // Calculate previous period for comparison
      const periodDays = Math.ceil(
        (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      const prevStartDateObj = subDays(startDateObj, periodDays + 1);
      const prevEndDateObj = subDays(startDateObj, 1);

      // Fetch current period transactions (filtered by branch)
      const { data: txData } = await supabase
        .from("transactions")
        .select(
          `id,transaction_number,created_at,branch_id,transaction_items:transaction_items(*, product:product_id(name))`
        )
        .eq("branch_id", selectedBranchId)
        .gte("created_at", startDateObj.toISOString())
        .lte("created_at", endDateObj.toISOString())
        .order("created_at", { ascending: true });

      setTransactions(txData || []);

      // Fetch previous period transactions for comparison
      const { data: prevTxData } = await supabase
        .from("transactions")
        .select(`id,transaction_items:transaction_items(total)`)
        .eq("branch_id", selectedBranchId)
        .gte("created_at", prevStartDateObj.toISOString())
        .lte("created_at", prevEndDateObj.toISOString());

      const prevSales =
        prevTxData?.reduce(
          (acc, t) =>
            acc + t.transaction_items.reduce((sum, i) => sum + i.total, 0),
          0
        ) || 0;
      setPreviousPeriodSales(prevSales);

      // Chart: sales per day
      const chartMap: Record<string, number> = {};
      txData?.forEach((t) => {
        const day = format(new Date(t.created_at), "yyyy-MM-dd");
        const total = t.transaction_items.reduce((acc, i) => acc + i.total, 0);
        chartMap[day] = (chartMap[day] || 0) + total;
      });
      setChartData(
        Object.entries(chartMap).map(([date, total]) => ({ date, total }))
      );

      // Top selling products
      const productMap: Record<string, number> = {};
      txData?.forEach((t) => {
        t.transaction_items.forEach((i) => {
          const name = i.product?.name || "Unknown";
          productMap[name] = (productMap[name] || 0) + i.quantity;
        });
      });
      setTopProducts(
        Object.entries(productMap)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5)
      );

      // Low stock products (filtered by branch)
      const { error, data: products } = await supabase.from("products").select(
        `
      *,
      product_stocks:product_stocks(remaining_quantity, branch_id)
    `
      );
      if (error) {
        console.error("error loading products:", error);
      }

      const lowStock = (products || [])
        .map((p: any) => {
          // Filter only stocks for the selected branch
          const branchStocks =
            p.product_stocks?.filter(
              (s: any) => s.branch_id === selectedBranchId
            ) || [];

          // Sum remaining quantities from all product_stocks entries
          const totalRemaining = branchStocks.reduce(
            (acc: number, s: any) => acc + (s.remaining_quantity || 0),
            0
          );

          return {
            id: p.id,
            product: { name: p.name, category: p.category },
            remaining_quantity: totalRemaining,
            reorder_point: p.reorder_point || 0,
          };
        })
        // Only include low-stock products: exclude items where total remaining stocks > order level
        // An item should NOT be considered low stock if totalRemaining > reorder_point
        .filter((p) => p.remaining_quantity <= p.reorder_point);

      setLowStock(lowStock);

      // Calculate inventory total value (admin only)
      if (isAdmin) {
        const { data: stocks, error: stocksError } = await supabase
          .from("product_stocks")
          .select("remaining_quantity, purchase_price")
          .eq("branch_id", selectedBranchId)
          .gt("remaining_quantity", 0);

        if (!stocksError && stocks) {
          const totalValue = stocks.reduce(
            (sum, stock) =>
              sum +
              Number(stock.remaining_quantity) *
                Number(stock.purchase_price || 0),
            0
          );
          setInventoryTotalValue(totalValue);
        }

        // Calculate inventory value based on current price (selling_price)
        const { data: stocksWithProducts, error: stocksWithProductsError } =
          await supabase
            .from("product_stocks")
            .select("remaining_quantity, product:product_id(selling_price)")
            .eq("branch_id", selectedBranchId)
            .gt("remaining_quantity", 0);

        if (!stocksWithProductsError && stocksWithProducts) {
          const totalValueCurrentPrice = stocksWithProducts.reduce(
            (sum, stock: any) => {
              const sellingPrice = stock.product?.selling_price || 0;
              return (
                sum + Number(stock.remaining_quantity) * Number(sellingPrice)
              );
            },
            0
          );
          setInventoryValueCurrentPrice(totalValueCurrentPrice);
        }
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [mode, range, selectedBranchId]);

  // Summaries
  const totalSales = transactions.reduce(
    (acc, t) => acc + t.transaction_items.reduce((sum, i) => sum + i.total, 0),
    0
  );
  const totalTransactions = transactions.length;
  const totalProductsSold = transactions.reduce(
    (acc, t) =>
      acc + t.transaction_items.reduce((sum, i) => sum + i.quantity, 0),
    0
  );
  const averageTransactionValue =
    totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Calculate percentage change
  const salesChange =
    previousPeriodSales > 0
      ? ((totalSales - previousPeriodSales) / previousPeriodSales) * 100
      : 0;

  // Restrict access for cashier users
  if (user?.type === "cashier") return <Notfoundpage />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Branch Analytics & Performance</p>
          </div>
          <Button
            onClick={loadDashboard}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Period Selector */}
        <div className="bg-white shadow-sm rounded-lg p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <Calendar className="w-5 h-5 text-gray-500" />
            <select
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {mode !== "custom" && (
              <span className="text-sm text-gray-500">
                {mode === "daily" && format(new Date(), "MMMM dd, yyyy")}
                {mode === "weekly" &&
                  `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "MMM dd")} - ${format(new Date(), "MMM dd, yyyy")}`}
                {mode === "monthly" &&
                  `${format(startOfMonth(new Date()), "MMM dd")} - ${format(new Date(), "MMM dd, yyyy")}`}
              </span>
            )}
            {mode === "custom" && (
              <span className="text-sm text-gray-500">
                {format(range[0].startDate, "MMM dd, yyyy")} -{" "}
                {format(range[0].endDate, "MMM dd, yyyy")}
              </span>
            )}
          </div>

          {mode === "custom" && (
            <div className="mt-4 border-t pt-4">
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
          )}
        </div>

        {/* Summary Cards - 3 widgets per row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Inventory Total Value - Admin only */}
          {isAdmin && (
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg rounded-xl p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">
                    Inventory Value (Based on Purchase Cost)
                  </p>
                  <h3 className="text-base font-bold mt-2">
                    {formatMoney(inventoryTotalValue)}
                  </h3>
                  <p className="text-sm text-indigo-100 mt-2">On-hand total</p>
                </div>
                <div className="bg-indigo-400/30 p-3 rounded-lg">
                  <Package className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Inventory Value (Based on Current Price) - Admin only */}
          {isAdmin && (
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg rounded-xl p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-purple-100 text-sm font-medium">
                    Inventory Value (Based on Current Price)
                  </p>
                  <h3 className="text-base font-bold mt-2">
                    {formatMoney(inventoryValueCurrentPrice)}
                  </h3>
                  <p className="text-sm text-purple-100 mt-2">
                    At selling price
                  </p>
                </div>
                <div className="bg-purple-400/30 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Total Sales - Hidden for bulk users */}
          {!isBulkUser && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg rounded-xl p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-sm font-medium">
                    Total Sales
                  </p>
                  <h3 className="text-base font-bold mt-2">
                    {formatMoney(totalSales)}
                  </h3>
                  {salesChange !== 0 && (
                    <div className="flex items-center mt-2 text-sm">
                      {salesChange > 0 ? (
                        <>
                          <TrendingUp className="w-4 h-4 mr-1" />
                          <span>+{salesChange.toFixed(1)}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4 mr-1" />
                          <span>{salesChange.toFixed(1)}%</span>
                        </>
                      )}
                      <span className="ml-1 text-blue-100">
                        vs previous period
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-blue-400/30 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Total Transactions */}
          <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">
                  Total Transactions
                </p>
                <h3 className="text-base font-bold mt-2 text-gray-900">
                  {totalTransactions}
                </h3>
                <p className="text-sm text-gray-400 mt-2">Orders processed</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Transaction Value - Hidden for bulk users */}
          {!isBulkUser && (
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium">
                    Avg. Transaction
                  </p>
                  <h3 className="text-base font-bold mt-2 text-gray-900">
                    {formatMoney(averageTransactionValue)}
                  </h3>
                  <p className="text-sm text-gray-400 mt-2">Per order</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          )}

          {/* Low Stock Alert */}
          <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">
                  Low Stock Items
                </p>
                <h3 className="text-base font-bold mt-2 text-gray-900">
                  {lowStock.length}
                </h3>
                <p className="text-sm text-orange-500 mt-2 flex items-center">
                  {lowStock.length > 0 && (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Needs attention
                    </>
                  )}
                  {lowStock.length === 0 && "All good!"}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${lowStock.length > 0 ? "bg-orange-100" : "bg-green-100"}`}
              >
                <Package
                  className={`w-6 h-6 ${lowStock.length > 0 ? "text-orange-600" : "text-green-600"}`}
                />
              </div>
            </div>
          </div>

          {/* Products Sold - Hidden for bulk users */}
          {!isBulkUser && (
            <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Products Sold</div>
              <div className="text-lg font-bold text-gray-900">
                {totalProductsSold}
              </div>
              <div className="text-xs text-gray-400 mt-1">Total units</div>
            </div>
          )}

          {/* Products per Transaction - Hidden for bulk users */}
          {!isBulkUser && (
            <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">
                Products per Transaction
              </div>
              <div className="text-lg font-bold text-gray-900">
                {totalTransactions > 0
                  ? (totalProductsSold / totalTransactions).toFixed(1)
                  : "0"}
              </div>
              <div className="text-xs text-gray-400 mt-1">Average items</div>
            </div>
          )}
        </div>

        {/* Stock Status - Separate row */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">Stock Status</div>
            <div className="text-lg font-bold text-gray-900">
              {lowStock.length === 0 ? "Healthy" : "Action Needed"}
            </div>
            <div className="text-xs text-gray-400 mt-1">Inventory health</div>
          </div>
        </div>

        {/* Charts Section - Hidden for bulk users */}
        {!isBulkUser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Performance Chart */}
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900">
                  Sales Performance
                </h3>
                <div className="text-sm text-gray-500">Daily trend</div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No sales data for selected period
                </div>
              )}
            </div>

            {/* Top Selling Products Chart */}
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900">
                  Top Selling Products
                </h3>
                <div className="text-sm text-gray-500">By quantity</div>
              </div>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts}>
                    <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="qty" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No product sales data
                </div>
              )}
            </div>
          </div>
        )}

        {/* Low Stock Products Table */}
        {lowStock.length > 0 && (
          <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-white mr-3" />
                <h3 className="font-bold text-lg text-white">
                  Low Stock Alert
                </h3>
              </div>
              <p className="text-orange-50 text-sm mt-1">
                {lowStock.length}{" "}
                {lowStock.length === 1 ? "product" : "products"} require
                restocking
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Reorder Point
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lowStock.map((p) => {
                    const percentage =
                      (p.remaining_quantity / p.reorder_point) * 100;
                    const isCritical = percentage < 50;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {p.product.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {p.product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`font-bold ${isCritical ? "text-red-600" : "text-orange-600"}`}
                          >
                            {p.remaining_quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-gray-600">
                            {p.reorder_point}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isCritical
                                ? "bg-red-100 text-red-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {isCritical ? "Critical" : "Low"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State when no branch selected */}
        {!selectedBranchId && (
          <div className="bg-white shadow-lg rounded-xl p-12 text-center border border-gray-100">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Branch Selected
            </h3>
            <p className="text-gray-500">
              Please select a branch to view analytics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
