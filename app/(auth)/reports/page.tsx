/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import Notfoundpage from "@/components/Notfoundpage";
import { ChannelReports } from "@/components/reports/ChannelReports";
import { CustomerSalesReport } from "@/components/reports/CustomerSalesReport";
import { ExpenseReport } from "@/components/reports/ExpenseReport";
import { ExpiryReport } from "@/components/reports/ExpiryReport";
import GLTransactionsReport from "@/components/reports/GLTransactionsReport";
import InventoryReport from "@/components/reports/InventoryReport";
import { PaymentMethodReport } from "@/components/reports/PaymentMethodReport";
import { ProductPerformanceReport } from "@/components/reports/ProductPerformanceReport";
import { SalesCollectionExpenseReport } from "@/components/reports/SalesCollectionExpenseReport";
import { StockCardReport } from "@/components/reports/StockCardReport";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReportAccess } from "@/lib/constants";
import { useAppSelector } from "@/lib/redux/hook";
import {
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Receipt,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const user = useAppSelector((state) => state.user.user);
  // Which tabs this user may open — set per user from the Staff modal,
  // falling back to the role default when nothing has been saved.
  const access = getReportAccess(user?.type, user?.report_access);
  const can = (key: string) => (access as string[]).includes(key);
  const canSeeProfit = can("profit");

  const allTabs = [
    { value: "bulk", label: "Bulk", icon: ShoppingCart },
    { value: "consignment", label: "Consignment", icon: Truck },
    { value: "agent", label: "Agent", icon: UserCog },
    { value: "customer", label: "Customer Sales", icon: Users },
    { value: "product", label: "Product Performance", icon: BarChart3 },
    { value: "payment", label: "Payment Methods", icon: CreditCard },
    { value: "gl", label: "GL Transactions", icon: CreditCard },
    { value: "expenses", label: "Expenses", icon: Receipt },
    { value: "salesvsexpenses", label: "Sales vs Collection vs Expenses", icon: Scale },
    { value: "inventory", label: "Inventory", icon: Package },
    { value: "expiry", label: "Expiry Report", icon: Calendar },
    { value: "stockcard", label: "Stock Movements", icon: FileText },
  ];

  const visibleTabs = allTabs.filter((t) => can(t.value));
  const accessKey = visibleTabs.map((t) => t.value).join(",");

  const defaultTab = visibleTabs[0]?.value ?? "";
  const [tab, setTab] = useState(defaultTab);

  // Reset to a permitted tab if the current one becomes unavailable.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === tab)) {
      setTab(defaultTab);
    }
  }, [accessKey, tab, defaultTab]);

  // Restrict access for cashier users (after all hooks)
  if (user?.type === "cashier") return <Notfoundpage />;

  if (visibleTabs.length === 0) {
    return (
      <div className="app__content">
        <Card>
          <CardContent className="p-6 text-sm text-gray-500">
            You have not been given access to any reports. Ask an admin to
            enable them on your staff account.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app__title">
        <h1 className="text-3xl font-semibold">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comprehensive business insights and data analysis
        </p>
      </div>

      <div className="app__content">
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-2 h-auto p-1 bg-gray-100">
                {visibleTabs.map((report) => {
                  const Icon = report.icon;
                  return (
                    <TabsTrigger
                      key={report.value}
                      value={report.value}
                      className="flex flex-col items-center gap-1.5 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {report.label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="mt-6">
                {can("bulk") && (
                  <TabsContent value="bulk" className="mt-0">
                    <ChannelReports channel="bulk" canSeeProfit={canSeeProfit} />
                  </TabsContent>
                )}
                {can("consignment") && (
                  <TabsContent value="consignment" className="mt-0">
                    <ChannelReports channel="consignment" canSeeProfit={canSeeProfit} />
                  </TabsContent>
                )}
                {can("agent") && (
                  <TabsContent value="agent" className="mt-0">
                    <ChannelReports channel="agent" canSeeProfit={canSeeProfit} />
                  </TabsContent>
                )}
                {can("customer") && (
                  <TabsContent value="customer" className="mt-0">
                    <CustomerSalesReport />
                  </TabsContent>
                )}
                {can("product") && (
                  <TabsContent value="product" className="mt-0">
                    <ProductPerformanceReport />
                  </TabsContent>
                )}
                {can("payment") && (
                  <TabsContent value="payment" className="mt-0">
                    <PaymentMethodReport />
                  </TabsContent>
                )}
                {can("gl") && (
                  <TabsContent value="gl" className="mt-0">
                    <GLTransactionsReport />
                  </TabsContent>
                )}
                {can("expenses") && (
                  <TabsContent value="expenses" className="mt-0">
                    <ExpenseReport />
                  </TabsContent>
                )}
                {can("salesvsexpenses") && (
                  <TabsContent value="salesvsexpenses" className="mt-0">
                    <SalesCollectionExpenseReport />
                  </TabsContent>
                )}
                {can("inventory") && (
                  <TabsContent value="inventory" className="mt-0">
                    <InventoryReport />
                  </TabsContent>
                )}
                {can("expiry") && (
                  <TabsContent value="expiry" className="mt-0">
                    <ExpiryReport />
                  </TabsContent>
                )}
                {can("stockcard") && (
                  <TabsContent value="stockcard" className="mt-0">
                    <StockCardReport />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
