/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

import { supabase } from '@/lib/supabase/client'
import { Transaction, Branch } from '@/types'
import { format, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useAppSelector } from '@/lib/redux/hook'
import { Loader2, Download, RefreshCw, TrendingUp, DollarSign, ShoppingCart, Package } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SalesReport() {
  const selectedBranchId = useAppSelector((state) => state.branch.selectedBranchId)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(selectedBranchId)
  
  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ])

  const [txnType, setTxnType] = useState('All') // All, Retail, Bulk
  const [paymentStatus, setPaymentStatus] = useState('All') // All, Paid, Unpaid, Partial

  const [mode, setMode] = useState('daily') // daily / weekly / monthly / custom
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<Transaction[]>([])
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    totalItems: 0
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

  // 🚀 Auto-update date range on mode change
  useEffect(() => {
    const today = new Date()
    let start: Date = new Date()
    let end: Date = new Date()

    if (mode === 'daily') {
      start = today
      end = today
    }

    if (mode === 'weekly') {
      const weekStart = new Date()
      weekStart.setDate(today.getDate() - 6)
      start = weekStart
      end = today
    }

    if (mode === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
    }

    if (mode !== 'custom')
      setRange([{ startDate: start, endDate: end, key: 'selection' }])
  }, [mode])

  // Update selected branch when Redux changes
  useEffect(() => {
    setSelectedBranch(selectedBranchId)
  }, [selectedBranchId])

  async function loadSales() {
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }

    setLoading(true)

    const start = range[0].startDate.toISOString().split('T')[0]
    const end = range[0].endDate.toISOString().split('T')[0]

    let query = supabase
      .from('transactions')
      .select(
        `*,
      transaction_items (*, product:product_id(name))`
      )
      .eq('branch_id', selectedBranch)
      .gte('created_at', `${start} 00:00:00`)
      .lte('created_at', `${end} 23:59:59`)
      .order('created_at', { ascending: false })

    // 🔥 Apply transaction type filter
    if (txnType !== 'All') {
      query = query.eq('transaction_type', txnType)
    }

    // Apply payment status filter
    if (paymentStatus !== 'All') {
      query = query.eq('payment_status', paymentStatus)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      toast.error('Failed to load sales data')
      setLoading(false)
      return
    }

    const transactions = data || []
    setReportData(transactions)

    // Calculate summary
    const totalSales = transactions.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0)
    const totalItems = transactions.reduce((sum, t) => 
      sum + t.transaction_items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0), 0
    )
    const totalTransactions = transactions.length
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

    setSummary({
      totalSales,
      totalTransactions,
      averageTransaction,
      totalItems
    })

    setLoading(false)
  }

  // Download Excel file
  function downloadExcel() {
    if (!reportData.length) return

    const rows: any[] = []

    reportData.forEach((t) => {
      t.transaction_items.forEach((item) => {
        rows.push({
          TransactionID: t.transaction_number,
          Date: t.created_at,
          ProductID: item.product?.name,
          Quantity: item.quantity,
          Price: item.price,
          LineTotal: item.total,
          BatchNo: item.batch_no,
          MfgDate: item.date_manufactured,
          ExpDate: item.expiration_date,
          TransactionTotal: t.total_amount
        })
      })
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')

    const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    saveAs(
      new Blob([excelBuffer], { type: 'application/octet-stream' }),
      `Sales_Report_${Date.now()}.xlsx`
    )
  }

  useEffect(() => {
    if (selectedBranch) {
      loadSales()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnType, paymentStatus, selectedBranch])

  return (
    <div className="space-y-6">
      {/* FILTERS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Branch Selector */}
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

            {/* Date Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={txnType} onValueChange={setTxnType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Transactions</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Status</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button onClick={loadSales} variant="blue" size="sm" disabled={loading || !selectedBranch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate
                </Button>
                {reportData.length > 0 && (
                  <Button onClick={downloadExcel} variant="green" size="sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* DATE PICKER FOR CUSTOM */}
          {mode === 'custom' && (
            <div className="mt-4 border p-4 rounded-lg inline-block">
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
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold">{summary.totalTransactions}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Transaction</p>
                  <p className="text-2xl font-bold">₱{summary.averageTransaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{summary.totalItems}</p>
                </div>
                <Package className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Report</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No sales found for selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 text-left font-semibold">Date & Time</th>
                    <th className="p-3 text-left font-semibold">Transaction #</th>
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-right font-semibold">Qty</th>
                    <th className="p-3 text-right font-semibold">Price</th>
                    <th className="p-3 text-right font-semibold">Line Total</th>
                    <th className="p-3 text-center font-semibold">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((t) =>
                    t.transaction_items.map((item, idx) => (
                      <tr key={t.id + '-' + idx} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          {format(parseISO(t.created_at), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="p-3 font-medium">{t.transaction_number}</td>
                        <td className="p-3">{t.customer_name || '-'}</td>
                        <td className="p-3">{item.product?.name || '-'}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">₱{Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-semibold">₱{Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            t.payment_status === 'Paid' ? 'bg-green-100 text-green-700' :
                            t.payment_status === 'Unpaid' ? 'bg-red-100 text-red-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {t.payment_status || '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
