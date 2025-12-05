'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { supabase } from '@/lib/supabase/client'
import { Branch, Product, User } from '@/types'
import { format, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/lib/redux/hook'
import { Loader2, Download, Search, RefreshCw } from 'lucide-react'

type StockMovement = {
  id: number
  product_id: number
  branch: Branch
  product_name: string
  batch_no: string | null
  type: string
  quantity: number
  remaining_quantity: number | null
  remarks: string | null
  created_at: string
  user_name: string
  product_stock_id: number
  expiration_date: string | null
  date_manufactured: string | null
  manufacturer: string | null
  product: Product
  user: User
}

export const StockCardReport = () => {
  const selectedBranchId = useAppSelector((state) => state.branch.selectedBranchId)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(selectedBranchId)
  
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

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

  const fetchStockMovements = async () => {
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(
          `
          *,
          product:product_id(name, category),
          branch:dest_branch(name),
          user:user_id(name)
        `
        )
        .eq('dest_branch', selectedBranch)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((d) => ({
        id: d.id,
        product_id: d.product_id,
        product_name: d.product?.name || '',
        branch: d.branch || null,
        batch_no: d.batch_no,
        type: d.type,
        quantity: d.quantity,
        remaining_quantity: d.remaining_quantity,
        remarks: d.remarks,
        created_at: d.created_at,
        user_name: d.user?.username || 'Unknown',
        product_stock_id: d.product_stock_id,
        expiration_date: d.expiration_date,
        date_manufactured: d.date_manufactured,
        manufacturer: d.manufacturer
      }))

      setMovements(formatted as StockMovement[])
    } catch (err) {
      console.error(err)
      toast.error('Failed to fetch stock movements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedBranch) {
      fetchStockMovements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch])

  const filteredMovements = movements.filter((m) =>
    m.product_name.toLowerCase().includes(filter.toLowerCase())
  )

  // ---------- EXPORT TO EXCEL ----------
  const exportToExcel = () => {
    if (!filteredMovements.length) {
      toast.error('No data to export!')
      return
    }

    const wsData = filteredMovements.map((m) => ({
      Date: format(parseISO(m.created_at), 'MMM dd, yyyy HH:mm'),
      Product: m.product_name,
      'Batch / Mfg / Exp': `${m.batch_no ? `Batch: ${m.batch_no}, ` : ''}${
        m.manufacturer ? `Mfg: ${m.manufacturer}, ` : ''
      }${m.date_manufactured ? `Date: ${format(parseISO(m.date_manufactured), 'MMM dd, yyyy')}, ` : ''}Exp: ${
        m.expiration_date
          ? format(parseISO(m.expiration_date), 'MMM dd, yyyy')
          : '-'
      }`,
      Type: `${m.type} ${m.branch && `(${m.branch?.name})`}`,
      Quantity: m.quantity,
      //   Remaining: m.remaining_quantity ?? '-',
      User: m.user?.name,
      Remarks: m.remarks || '-'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Card')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf]),
      `stock_card_report_${new Date().toISOString()}.xlsx`
    )
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
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search product..."
                  className="pl-10"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button onClick={fetchStockMovements} variant="blue" size="sm" disabled={loading || !selectedBranch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
                {filteredMovements.length > 0 && (
                  <Button onClick={exportToExcel} variant="green" size="sm">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No stock movements found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Date</th>
                    <th className="p-3 text-left font-semibold">Product</th>
                    <th className="p-3 text-left font-semibold">Batch / Mfg / Exp</th>
                    <th className="p-3 text-left font-semibold">Type</th>
                    <th className="p-3 text-right font-semibold">Quantity</th>
                    <th className="p-3 text-left font-semibold">User</th>
                    <th className="p-3 text-left font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => {
                    const exp = m.expiration_date
                      ? format(parseISO(m.expiration_date), 'MMM dd, yyyy')
                      : '-'
                    const mfg = m.date_manufactured
                      ? format(parseISO(m.date_manufactured), 'MMM dd, yyyy')
                      : '-'

                    return (
                      <tr key={m.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          {format(parseISO(m.created_at), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="p-3 font-medium">{m.product_name}</td>
                        <td className="p-3 text-sm">
                          {m.batch_no ? `Batch: ${m.batch_no}, ` : ''}
                          {m.manufacturer ? `Mfg: ${m.manufacturer}, ` : ''}
                          {m.date_manufactured ? `Date: ${mfg}, ` : ''}
                          Exp: {exp}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            m.type === 'in' ? 'bg-green-100 text-green-700' :
                            m.type === 'out' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {m.type}
                            {m.branch && ` (${m.branch?.name})`}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold">{m.quantity}</td>
                        <td className="p-3">{m.user?.name || '-'}</td>
                        <td className="p-3 text-sm">{m.remarks || '-'}</td>
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
