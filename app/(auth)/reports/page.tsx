'use client'
import { ExpiryReport } from '@/components/reports/ExpiryReport'
import InventoryReport from '@/components/reports/InventoryReport'
import { ProfitReport } from '@/components/reports/ProfitReport'
import SalesReport from '@/components/reports/SalesReport'
import { StockCardReport } from '@/components/reports/StockCardReport'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState } from 'react'

export default function ReportsPage() {
  const [tab, setTab] = useState('inventory')

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Reports</h1>
      </div>

      <div className="app__content">
        <div className="p-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="profit">Profit</TabsTrigger>
              <TabsTrigger value="expiry">Expiry</TabsTrigger>
              <TabsTrigger value="stockcard">Stock Card</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory">
              <InventoryReport />
            </TabsContent>
            <TabsContent value="sales">
              <SalesReport />
            </TabsContent>
            <TabsContent value="profit">
              <ProfitReport />
            </TabsContent>
            <TabsContent value="expiry">
              <ExpiryReport />
            </TabsContent>
            <TabsContent value="stockcard">
              <StockCardReport />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
