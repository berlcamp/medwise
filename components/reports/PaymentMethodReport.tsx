/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { supabase } from '@/lib/supabase/client'
import { Branch } from '@/types'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/lib/redux/hook'
import { Loader2, Download, RefreshCw, CreditCard, DollarSign } from 'lucide-react'
import { saveAs } from 'file-saver'

export const PaymentMethodReport = () => {
  const selectedBranchId = useAppSelector((state) => state.branch.selectedBranchId)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(selectedBranchId)
  
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('month')
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalTransactions: 0
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

  // Update date range
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

  const fetchData = async () => {
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }

    setLoading(true)
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, total_amount, payment_type, payment_status, created_at')
        .eq('branch_id', selectedBranch)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (error) throw error

      // Group by payment type
      const paymentMap = new Map<string, any>()
      
      transactions?.forEach((tx: any) => {
        const paymentType = tx.payment_type || 'Unknown'
        if (!paymentMap.has(paymentType)) {
          paymentMap.set(paymentType, {
            paymentType,
            totalAmount: 0,
            transactionCount: 0,
            paid: 0,
            unpaid: 0,
            partial: 0
          })
        }

        const item = paymentMap.get(paymentType)!
        item.totalAmount += Number(tx.total_amount) || 0
        item.transactionCount += 1
        
        if (tx.payment_status === 'Paid') item.paid += Number(tx.total_amount) || 0
        if (tx.payment_status === 'Unpaid') item.unpaid += Number(tx.total_amount) || 0
        if (tx.payment_status === 'Partial') item.partial += Number(tx.total_amount) || 0
      })

      const data = Array.from(paymentMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
      setReportData(data)

      const totalSales = data.reduce((sum, d) => sum + d.totalAmount, 0)
      const totalTransactions = data.reduce((sum, d) => sum + d.transactionCount, 0)

      setSummary({ totalSales, totalTransactions })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedBranch) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, startDate, endDate])

  const exportExcel = () => {
    const rows = reportData.map((item) => ({
      'Payment Method': item.paymentType,
      'Total Amount': item.totalAmount,
      'Transactions': item.transactionCount,
      'Paid': item.paid,
      'Unpaid': item.unpaid,
      'Partial': item.partial,
      'Average Transaction': item.transactionCount > 0 ? item.totalAmount / item.transactionCount : 0
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Methods')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `payment_method_report_${format(new Date(), 'yyyyMMdd')}.xlsx`)
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
                <Button onClick={fetchData} variant="blue" size="sm" disabled={loading || !selectedBranch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate
                </Button>
                {reportData.length > 0 && (
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

      {/* SUMMARY */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold">₱{summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-2xl font-bold">{summary.totalTransactions}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Payment Method</th>
                    <th className="p-3 text-right font-semibold">Total Amount</th>
                    <th className="p-3 text-right font-semibold">Transactions</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Unpaid</th>
                    <th className="p-3 text-right font-semibold">Partial</th>
                    <th className="p-3 text-right font-semibold">Avg. Transaction</th>
                    <th className="p-3 text-right font-semibold">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, idx) => {
                    const percentage = summary.totalSales > 0 ? (item.totalAmount / summary.totalSales) * 100 : 0
                    const avgTransaction = item.transactionCount > 0 ? item.totalAmount / item.transactionCount : 0

                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{item.paymentType}</td>
                        <td className="p-3 text-right font-semibold">₱{item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right">{item.transactionCount}</td>
                        <td className="p-3 text-right text-green-600">₱{item.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right text-red-600">₱{item.unpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right text-orange-600">₱{item.partial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right">₱{avgTransaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-semibold">{percentage.toFixed(2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
