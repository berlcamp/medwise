/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

interface Transaction {
  id: number
  total_amount: number
  created_at: string
  customer_name: string | null
}

interface LowStock {
  category: string
  name: string
  product_id: number
  reorder_point: number
  stock_qty: number
  unit: string
}
export default function DashboardPage() {
  const [totalSalesToday, setTotalSalesToday] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  )
  const [lowStockProducts, setLowStockProducts] = useState<LowStock[]>([])
  const [salesData, setSalesData] = useState<any[]>([])

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  useEffect(() => {
    const fetchData = async () => {
      const today = format(new Date(), 'yyyy-MM-dd')

      // 1️⃣ Total sales today
      const { data: salesToday } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('branch_id', selectedBranchId)
        .gte('created_at', today)
      setTotalSalesToday(
        salesToday?.reduce((acc, t: any) => acc + Number(t.total_amount), 0) ||
          0
      )

      // 2️⃣ Total transactions
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', selectedBranchId)
      setTotalTransactions(count || 0)

      // 3️⃣ Recent transactions
      const { data: recent } = await supabase
        .from('transactions')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentTransactions(recent || [])

      // Fetch all product stocks for this branch with product info
      const { data: lowStock } = await supabase.rpc('get_low_stock', {
        branch: selectedBranchId
      })
      setLowStockProducts(lowStock || [])

      // 5️⃣ Sales over the last 7 days (chart)
      const { data: last7days } = await supabase
        .from('transactions')
        .select('total_amount, created_at')
        .eq('branch_id', selectedBranchId)
        .gte(
          'created_at',
          format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        ) // 7 days
      const grouped: Record<string, number> = {}
      last7days?.forEach((t: any) => {
        const date = format(new Date(t.created_at), 'yyyy-MM-dd')
        grouped[date] = (grouped[date] || 0) + Number(t.total_amount)
      })
      const chartData = Array.from({ length: 7 })
        .map((_, i) => {
          const date = format(
            new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            'yyyy-MM-dd'
          )
          return { date, total: grouped[date] || 0 }
        })
        .reverse()
      setSalesData(chartData)
    }

    fetchData()
  }, [selectedBranchId])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Sales Today</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-semibold">
              ₱{totalSalesToday.toFixed(2)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-semibold">{totalTransactions}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Products</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All stocks sufficient
              </p>
            ) : (
              <ul className="space-y-1">
                {lowStockProducts.map((p, idx) => (
                  <li key={idx} className="text-sm">
                    {p.name} ({p.stock_qty} {p.unit})
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-gray-200">
            {recentTransactions.map((t) => (
              <li key={t.id} className="py-2 flex justify-between">
                <span>{t.customer_name || 'Guest'}</span>
                <span>₱{t.total_amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
