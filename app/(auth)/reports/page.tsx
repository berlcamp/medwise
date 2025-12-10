'use client'
import { ExpiryReport } from '@/components/reports/ExpiryReport'
import InventoryReport from '@/components/reports/InventoryReport'
import { ProfitReport } from '@/components/reports/ProfitReport'
import SalesReport from '@/components/reports/SalesReport'
import { StockCardReport } from '@/components/reports/StockCardReport'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, TrendingUp, Package, Calendar, DollarSign, Users, BarChart3, CreditCard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DailySalesSummary } from '@/components/reports/DailySalesSummary'
import { PaymentMethodReport } from '@/components/reports/PaymentMethodReport'
import { CustomerSalesReport } from '@/components/reports/CustomerSalesReport'
import { ProductPerformanceReport } from '@/components/reports/ProductPerformanceReport'
import { useAppSelector } from '@/lib/redux/hook'
import Notfoundpage from '@/components/Notfoundpage'

export default function ReportsPage() {
  const user = useAppSelector((state) => state.user.user)
  const isBulkUser = user?.type === 'bulk'
  const isAdmin = user?.type === 'admin' || user?.type === 'super admin'
  
  // Sales and profit related tabs that should be hidden for bulk users
  const restrictedTabs = ['sales', 'daily', 'profit', 'payment', 'customer', 'product']
  
  const allReportTabs = [
    { value: 'sales', label: 'Sales Report', icon: DollarSign, description: 'Transaction and sales data' },
    { value: 'daily', label: 'Daily Summary', icon: Calendar, description: 'Daily sales overview' },
    { value: 'profit', label: 'Profit Report', icon: TrendingUp, description: 'Profit and margin analysis' },
    { value: 'payment', label: 'Payment Methods', icon: CreditCard, description: 'Payment method breakdown' },
    { value: 'customer', label: 'Customer Sales', icon: Users, description: 'Customer performance' },
    { value: 'product', label: 'Product Performance', icon: BarChart3, description: 'Top products analysis' },
    { value: 'inventory', label: 'Inventory', icon: Package, description: 'Stock levels and status' },
    { value: 'expiry', label: 'Expiry Report', icon: Calendar, description: 'Expiring products' },
    { value: 'stockcard', label: 'Stock Movements', icon: FileText, description: 'Stock movement history' },
  ]
  
  // Filter out restricted tabs for bulk users, and profit tab for non-admin users
  const reportTabs = allReportTabs.filter(tab => {
    if (isBulkUser && restrictedTabs.includes(tab.value)) return false
    if (tab.value === 'profit' && !isAdmin) return false
    return true
  })
  
  const defaultTab = isBulkUser ? 'inventory' : 'sales'
  const [tab, setTab] = useState(defaultTab)
  
  // Reset tab if current tab is restricted
  useEffect(() => {
    if (isBulkUser && restrictedTabs.includes(tab)) {
      setTab(defaultTab)
    }
    if (tab === 'profit' && !isAdmin) {
      setTab(defaultTab)
    }
  }, [isBulkUser, isAdmin, tab, defaultTab, restrictedTabs])
  
  // Restrict access for cashier users (after all hooks)
  if (user?.type === 'cashier') return <Notfoundpage />

  return (
    <div className="space-y-6">
      <div className="app__title">
        <h1 className="text-3xl font-semibold">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Comprehensive business insights and data analysis</p>
      </div>

      <div className="app__content">
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-2 h-auto p-1 bg-gray-100">
                {reportTabs.map((report) => {
                  const Icon = report.icon
                  return (
                    <TabsTrigger
                      key={report.value}
                      value={report.value}
                      className="flex flex-col items-center gap-1.5 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{report.label}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              <div className="mt-6">
                {!isBulkUser && (
                  <>
                    <TabsContent value="sales" className="mt-0">
                      <SalesReport />
                    </TabsContent>
                    <TabsContent value="daily" className="mt-0">
                      <DailySalesSummary />
                    </TabsContent>
                    {isAdmin && (
                      <TabsContent value="profit" className="mt-0">
                        <ProfitReport />
                      </TabsContent>
                    )}
                    <TabsContent value="payment" className="mt-0">
                      <PaymentMethodReport />
                    </TabsContent>
                    <TabsContent value="customer" className="mt-0">
                      <CustomerSalesReport />
                    </TabsContent>
                    <TabsContent value="product" className="mt-0">
                      <ProductPerformanceReport />
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
  )
}
