/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { supabase } from '@/lib/supabase/client'
import { Branch } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/lib/redux/hook'
import { Loader2, Download, RefreshCw, Search } from 'lucide-react'
import { saveAs } from 'file-saver'

export const CustomerSalesReport = () => {
  const selectedBranchId = useAppSelector((state) => state.branch.selectedBranchId)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(selectedBranchId)
  
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [reportData, setReportData] = useState<any[]>([])
  const [search, setSearch] = useState('')

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

  const fetchData = async () => {
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
          customer_id,
          customer_name,
          total_amount,
          payment_status,
          created_at,
          transaction_items(quantity, price, total)
        `)
        .eq('branch_id', selectedBranch)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('customer_id', 'is', null)

      if (error) throw error

      // Group by customer
      const customerMap = new Map<number, any>()
      
      transactions?.forEach((tx: any) => {
        const customerId = tx.customer_id
        if (!customerId) return

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerId,
            customerName: tx.customer_name || 'Unknown',
            totalAmount: 0,
            transactionCount: 0,
            itemCount: 0,
            paid: 0,
            unpaid: 0,
            partial: 0,
            lastTransactionDate: null
          })
        }

        const customer = customerMap.get(customerId)!
        customer.totalAmount += Number(tx.total_amount) || 0
        customer.transactionCount += 1
        customer.itemCount += tx.transaction_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0
        
        if (tx.payment_status === 'Paid') customer.paid += Number(tx.total_amount) || 0
        if (tx.payment_status === 'Unpaid') customer.unpaid += Number(tx.total_amount) || 0
        if (tx.payment_status === 'Partial') customer.partial += Number(tx.total_amount) || 0
        
        const txDate = new Date(tx.created_at)
        if (!customer.lastTransactionDate || txDate > customer.lastTransactionDate) {
          customer.lastTransactionDate = txDate
        }
      })

      const data = Array.from(customerMap.values())
        .map(c => ({
          ...c,
          averageTransaction: c.transactionCount > 0 ? c.totalAmount / c.transactionCount : 0
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

      setReportData(data)
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

  const filteredData = reportData.filter(c => 
    c.customerName.toLowerCase().includes(search.toLowerCase())
  )

  const exportExcel = () => {
    const rows = filteredData.map((item) => ({
      'Customer Name': item.customerName,
      'Total Sales': item.totalAmount,
      'Transactions': item.transactionCount,
      'Items Purchased': item.itemCount,
      'Paid': item.paid,
      'Unpaid': item.unpaid,
      'Partial': item.partial,
      'Average Transaction': item.averageTransaction,
      'Last Transaction': item.lastTransactionDate ? format(item.lastTransactionDate, 'MMM dd, yyyy') : '-'
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Sales')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `customer_sales_report_${format(new Date(), 'yyyyMMdd')}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* FILTERS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button onClick={fetchData} variant="blue" size="sm" disabled={loading || !selectedBranch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate
                </Button>
                {filteredData.length > 0 && (
                  <Button onClick={exportExcel} variant="green" size="sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customer..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Sales Report</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No customer data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-right font-semibold">Total Sales</th>
                    <th className="p-3 text-right font-semibold">Transactions</th>
                    <th className="p-3 text-right font-semibold">Items</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Unpaid</th>
                    <th className="p-3 text-right font-semibold">Partial</th>
                    <th className="p-3 text-right font-semibold">Avg. Transaction</th>
                    <th className="p-3 text-left font-semibold">Last Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.customerName}</td>
                      <td className="p-3 text-right font-semibold">₱{item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">{item.transactionCount}</td>
                      <td className="p-3 text-right">{item.itemCount}</td>
                      <td className="p-3 text-right text-green-600">₱{item.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-red-600">₱{item.unpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-orange-600">₱{item.partial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">₱{item.averageTransaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3">{item.lastTransactionDate ? format(item.lastTransactionDate, 'MMM dd, yyyy') : '-'}</td>
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
