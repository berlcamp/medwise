/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import Notfoundpage from "@/components/Notfoundpage";
import { ChannelReports } from "@/components/reports/ChannelReports";
import { CustomerSalesReport } from "@/components/reports/CustomerSalesReport";
import { ExpiryReport } from "@/components/reports/ExpiryReport";
import GLTransactionsReport from "@/components/reports/GLTransactionsReport";
import InventoryReport from "@/components/reports/InventoryReport";
import { PaymentMethodReport } from "@/components/reports/PaymentMethodReport";
import { ProductPerformanceReport } from "@/components/reports/ProductPerformanceReport";
import { StockCardReport } from "@/components/reports/StockCardReport";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const user = useAppSelector((state) => state.user.user);
  const isBulkUser = user?.type === "bulk";
  const isAdmin = user?.type === "admin" || user?.type === "super admin";

  // Channel tabs (Sales/Profit/Daily inside) — hidden for bulk users.
  const channelTabs = [
    { value: "bulk", label: "Bulk", icon: ShoppingCart },
    { value: "consignment", label: "Consignment", icon: Truck },
    { value: "agent", label: "Agent", icon: UserCog },
  ];

  // Global tabs. Customer/Product/Payment/GL are sales-analysis (hidden for
  // bulk users); Inventory/Expiry/Stock are always available.
  const salesGlobalTabs = [
    { value: "customer", label: "Customer Sales", icon: Users },
    { value: "product", label: "Product Performance", icon: BarChart3 },
    { value: "payment", label: "Payment Methods", icon: CreditCard },
    { value: "gl", label: "GL Transactions", icon: CreditCard },
  ];
  const inventoryTabs = [
    { value: "inventory", label: "Inventory", icon: Package },
    { value: "expiry", label: "Expiry Report", icon: Calendar },
    { value: "stockcard", label: "Stock Movements", icon: FileText },
  ];

  const visibleTabs = [
    ...(isBulkUser ? [] : channelTabs),
    ...(isBulkUser ? [] : salesGlobalTabs),
    ...inventoryTabs,
  ];

  const defaultTab = isBulkUser ? "inventory" : "bulk";
  const [tab, setTab] = useState(defaultTab);

  // Reset to a permitted tab if the current one becomes unavailable.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === tab)) {
      setTab(defaultTab);
    }
  }, [isBulkUser, isAdmin, tab, defaultTab]);

  // Restrict access for cashier users (after all hooks)
  if (user?.type === "cashier") return <Notfoundpage />;

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
                {!isBulkUser && (
                  <>
                    <TabsContent value="bulk" className="mt-0">
                      <ChannelReports channel="bulk" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="consignment" className="mt-0">
                      <ChannelReports channel="consignment" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="agent" className="mt-0">
                      <ChannelReports channel="agent" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="customer" className="mt-0">
                      <CustomerSalesReport />
                    </TabsContent>
                    <TabsContent value="product" className="mt-0">
                      <ProductPerformanceReport />
                    </TabsContent>
                    <TabsContent value="payment" className="mt-0">
                      <PaymentMethodReport />
                    </TabsContent>
                    <TabsContent value="gl" className="mt-0">
                      <GLTransactionsReport />
                    </TabsContent>
                  </>
                )}
                <TabsContent value="inventory" className="mt-0">
                  <InventoryReport />
                </TabsContent>
                <TabsContent value="expiry" className="mt-0">
                  <ExpiryReport />
                </TabsContent>
                <TabsContent value="stockcard" className="mt-0">
                  <StockCardReport />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
