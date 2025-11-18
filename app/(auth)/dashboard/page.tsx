/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { format, startOfMonth, startOfWeek } from 'date-fns'
import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
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
  YAxis
} from 'recharts'

type Range = { startDate: Date; endDate: Date; key: string }
type TransactionItem = {
  product: { name: string }
  quantity: number
  price: number
  total: number
}
type Transaction = {
  id: number
  transaction_number: string
  created_at: string
  transaction_items: TransactionItem[]
}
type ProductStock = {
  id: number
  product: { name: string; category: string }
  remaining_quantity: number
  reorder_point: number
}

export default function Page() {
  const [mode, setMode] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>(
    'daily'
  )
  const [range, setRange] = useState<Range[]>([
    { startDate: new Date(), endDate: new Date(), key: 'selection' }
  ])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<ProductStock[]>([])

  const loadDashboard = async () => {
    const today = new Date()
    let start: Date, end: Date

    switch (mode) {
      case 'daily':
        start = today
        end = today
        break
      case 'weekly':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = today
        break
      case 'monthly':
        start = startOfMonth(today)
        end = today
        break
      case 'custom':
        start = range[0].startDate
        end = range[0].endDate
        break
      default:
        start = today
        end = today
    }

    // Fetch transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select(
        `id,transaction_number,created_at,transaction_items:transaction_items(*, product:product_id(name))`
      )
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    setTransactions(txData || [])

    // Chart: sales per day
    const chartMap: Record<string, number> = {}
    txData?.forEach((t) => {
      const day = format(new Date(t.created_at), 'yyyy-MM-dd')
      const total = t.transaction_items.reduce((acc, i) => acc + i.total, 0)
      chartMap[day] = (chartMap[day] || 0) + total
    })
    setChartData(
      Object.entries(chartMap).map(([date, total]) => ({ date, total }))
    )

    // Top selling products
    const productMap: Record<string, number> = {}
    txData?.forEach((t) => {
      t.transaction_items.forEach((i) => {
        const name = i.product?.name || 'Unknown'
        productMap[name] = (productMap[name] || 0) + i.quantity
      })
    })
    setTopProducts(
      Object.entries(productMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
    )

    // Low stock products
    const { data: products } = await supabase
      .from('products')
      .select(
        '*, product_stocks:product_stocks(remaining_quantity,reorder_point)'
      )
      .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)

    const formattedLowStock = (products || [])
      .map((p: any) => ({
        id: p.id,
        product: { name: p.name, category: p.category },
        remaining_quantity: p.product_stocks?.reduce(
          (acc: number, s: any) => acc + (s.remaining_quantity || 0),
          0
        ),
        reorder_point: p.product_stocks?.[0]?.reorder_point || 0
      }))
      .filter((p) => p.remaining_quantity <= p.reorder_point)
    setLowStock(formattedLowStock)
  }

  useEffect(() => {
    loadDashboard()
  }, [mode, range])

  // Summaries
  const totalSales = transactions.reduce(
    (acc, t) => acc + t.transaction_items.reduce((sum, i) => sum + i.total, 0),
    0
  )
  const totalTransactions = transactions.length
  const totalProductsSold = transactions.reduce(
    (acc, t) =>
      acc + t.transaction_items.reduce((sum, i) => sum + i.quantity, 0),
    0
  )

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">POS Dashboard</h2>

      {/* FILTERS */}
      <div className="flex gap-3 items-center mb-4">
        <select
          className="border border-gray-400 px-2 py-1 rounded text-xs"
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
        >
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        <Button onClick={loadDashboard} variant="blue" size="sm">
          Generate Data
        </Button>
      </div>

      {mode === 'custom' && (
        <div className="border p-3 rounded inline-block mb-4">
          <DateRangePicker
            onChange={(item) =>
              setRange([
                {
                  startDate: item.selection.startDate ?? new Date(),
                  endDate: item.selection.endDate ?? new Date(),
                  key: 'selection'
                }
              ])
            }
            moveRangeOnFirstSelection={false}
            ranges={range}
          />
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded p-4">
          <div className="text-xs text-gray-500">Total Sales</div>
          <div className="text-xl font-bold">${totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-white shadow rounded p-4">
          <div className="text-xs text-gray-500">Total Transactions</div>
          <div className="text-xl font-bold">{totalTransactions}</div>
        </div>
        <div className="bg-white shadow rounded p-4">
          <div className="text-xs text-gray-500">Total Products Sold</div>
          <div className="text-xl font-bold">{totalProductsSold}</div>
        </div>
        <div className="bg-white shadow rounded p-4">
          <div className="text-xs text-gray-500">Low Stock Products</div>
          <div className="text-xl font-bold">{lowStock.length}</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded p-4">
          <h3 className="font-semibold mb-2">Sales Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white shadow rounded p-4">
          <h3 className="font-semibold mb-2">Top Selling Products</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducts}>
              <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LOW STOCK TABLE */}
      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        <h3 className="font-semibold mb-2">Low Stock Products</h3>
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2">Product</th>
              <th className="p-2">Category</th>
              <th className="p-2">Remaining Qty</th>
              <th className="p-2">Reorder Point</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.product.name}</td>
                <td className="p-2">{p.product.category}</td>
                <td className="p-2">{p.remaining_quantity}</td>
                <td className="p-2">{p.reorder_point}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
