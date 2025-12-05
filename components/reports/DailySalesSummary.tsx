/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { supabase } from '@/lib/supabase/client'
import { Branch } from '@/types'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/lib/redux/hook'
import { Loader2, Download, RefreshCw, TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react'
import { saveAs } from 'file-saver'

export const DailySalesSummary = () => {
  const selectedBranchId = useAppSelector((state) => state.branch.selectedBranchId)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(selectedBranchId)
  
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('week') // week, month, custom
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }))
  const [summary, setSummary] = useState<any[]>([])
  const [totals, setTotals] = useState({
    totalSales: 0,
    totalTransactions: 0,
    totalCustomers: 0,
    averageTransaction: 0
  })

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      if (data) setBranches(data)
    }
    fetchBranches()
  }, [])

  // Update selected branch when Redux changes
  useEffect(() => {
    setSelectedBranch(selectedBranchId)
  }, [selectedBranchId])

  // Update date range based on selection
  useEffect(() => {
    const today = new Date()
    if (dateRange === 'week') {
      setStartDate(startOfWeek(today, { weekStartsOn: 1 }))
      setEndDate(endOfWeek(today, { weekStartsOn: 1 }))
    } else if (dateRange === 'month') {
      setStartDate(startOfMonth(today))
      setEndDate(endOfMonth(today))
    }
  }, [dateRange])

  const fetchSummary = async () => {
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }

    setLoading(true)
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          total_amount,
          customer_id,
          customer_name,
          created_at,
          payment_status,
          transaction_type
        `)
        .eq('branch_id', selectedBranch)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group by date
      const dailyMap = new Map<string, any>()
      
      transactions?.forEach((tx: any) => {
        const date = format(parseISO(tx.created_at), 'yyyy-MM-dd')
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            sales: 0,
            transactions: 0,
            customers: new Set(),
            paid: 0,
            unpaid: 0,
            retail: 0,
            bulk: 0
          })
        }

        const day = dailyMap.get(date)!
        day.sales += Number(tx.total_amount) || 0
        day.transactions += 1
        if (tx.customer_id) day.customers.add(tx.customer_id)
        if (tx.payment_status === 'Paid') day.paid += Number(tx.total_amount) || 0
        if (tx.payment_status === 'Unpaid') day.unpaid += Number(tx.total_amount) || 0
        if (tx.transaction_type === 'retail') day.retail += Number(tx.total_amount) || 0
        if (tx.transaction_type === 'bulk') day.bulk += Number(tx.total_amount) || 0
      })

      const summaryData = Array.from(dailyMap.values()).map(day => ({
        ...day,
        customers: day.customers.size,
        averageTransaction: day.transactions > 0 ? day.sales / day.transactions : 0
      })).sort((a, b) => a.date.localeCompare(b.date))

      setSummary(summaryData)

      // Calculate totals
      const totalSales = summaryData.reduce((sum, d) => sum + d.sales, 0)
      const totalTransactions = summaryData.reduce((sum, d) => sum + d.transactions, 0)
      const totalCustomers = new Set(transactions?.map((t: any) => t.customer_id).filter(Boolean) || []).size
      const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

      setTotals({
        totalSales,
        totalTransactions,
        totalCustomers,
        averageTransaction
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedBranch) {
      fetchSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, startDate, endDate])

  const exportExcel = () => {
    const rows = summary.map((day) => ({
      Date: format(parseISO(day.date), 'MMM dd, yyyy'),
      'Total Sales': day.sales,
      Transactions: day.transactions,
      Customers: day.customers,
      'Average Transaction': day.averageTransaction,
      'Paid Amount': day.paid,
      'Unpaid Amount': day.unpaid,
      'Retail Sales': day.retail,
      'Bulk Sales': day.bulk
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `daily_sales_summary_${format(new Date(), 'yyyyMMdd')}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* FILTERS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select
                value={selectedBranch?.toString() || ''}
                onValueChange={(value) => setSelectedBranch(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button onClick={fetchSummary} variant="blue" size="sm" disabled={loading || !selectedBranch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
                {summary.length > 0 && (
                  <Button onClick={exportExcel} variant="green" size="sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold">₱{totals.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold">{totals.totalTransactions}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Customers</p>
                  <p className="text-2xl font-bold">{totals.totalCustomers}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Transaction</p>
                  <p className="text-2xl font-bold">₱{totals.averageTransaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUMMARY TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Sales Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : summary.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No data found for selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Date</th>
                    <th className="p-3 text-right font-semibold">Total Sales</th>
                    <th className="p-3 text-right font-semibold">Transactions</th>
                    <th className="p-3 text-right font-semibold">Customers</th>
                    <th className="p-3 text-right font-semibold">Avg. Transaction</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Unpaid</th>
                    <th className="p-3 text-right font-semibold">Retail</th>
                    <th className="p-3 text-right font-semibold">Bulk</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((day, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{format(parseISO(day.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-right font-semibold">₱{day.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">{day.transactions}</td>
                      <td className="p-3 text-right">{day.customers}</td>
                      <td className="p-3 text-right">₱{day.averageTransaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-green-600">₱{day.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-red-600">₱{day.unpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">₱{day.retail.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">₱{day.bulk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
