'use client'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { differenceInDays, format, isBefore, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '../ui/button'

interface StockRow {
  product_id: number
  name: string
  category: string
  stock_on_hand: number
  nearest_expiration: string | null
}

export default function InventoryReport() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StockRow[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    loadInventory()
  }, [])

  const downloadExcel = () => {
    // Convert your `data` array into sheet rows
    const rows = data.map((i) => ({
      'Product Name': i.name,
      Category: i.category,
      'Stock on Hand': i.stock_on_hand,
      'Nearest Expiry': i.nearest_expiration || '—'
    }))

    // Convert to worksheet
    const ws = XLSX.utils.json_to_sheet(rows)

    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Report')

    // Export as Excel file
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    saveAs(blob, 'Inventory_Report.xlsx')
  }

  const loadInventory = async () => {
    setLoading(true)

    const { data: rows, error } = await supabase.rpc('get_inventory_report', {
      org_id_param: Number(process.env.NEXT_PUBLIC_ORG_ID)
    })

    if (error) {
      console.error('Inventory report error:', error)
      setLoading(false)
      return
    }

    setData(rows || [])
    setLoading(false)
  }

  // -------- FILTERED DATA ----------
  const filtered = data.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())

    const matchesCategory = categoryFilter
      ? item.category === categoryFilter
      : true

    return matchesSearch && matchesCategory
  })

  // -------- GET UNIQUE CATEGORIES ----------
  const categories = [...new Set(data.map((i) => i.category))]

  const getStatusBadge = (exp: string | null) => {
    if (!exp) return <Badge variant="outline">No expiry</Badge>

    const date = parseISO(exp)
    const today = new Date()

    if (isBefore(date, today)) {
      return <Badge variant="destructive">Expired</Badge>
    }

    const daysLeft = differenceInDays(date, today)

    if (daysLeft <= 30) {
      return <Badge variant="orange">Expiring Soon</Badge>
    }

    return <Badge variant="green">Good</Badge>
  }

  return (
    <div className="mt-4 space-y-4">
      {/* FILTERS */}
      <div className="mt-10 flex gap-3 items-center">
        <Input
          placeholder="Search product or category..."
          className="w-60"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded px-2 py-1 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin w-6 h-6 text-gray-500" />
        </div>
      )}

      {/* TABLE */}
      {!loading && (
        <div>
          <div className="flex justify-end mb-3">
            <Button onClick={downloadExcel} variant="green" size="xs">
              Export to Excel
            </Button>
          </div>
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2">Category</th>
                  <th className="p-2 text-right">Stock on Hand</th>
                  <th className="p-2">Nearest Exp.</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const exp = item.nearest_expiration
                    ? format(parseISO(item.nearest_expiration), 'MMM dd, yyyy')
                    : '—'

                  return (
                    <tr key={item.product_id} className="border-t">
                      <td className="p-2 font-medium">{item.name}</td>
                      <td className="p-2">{item.category}</td>

                      <td className="p-2 text-right font-semibold">
                        {item.stock_on_hand}
                      </td>

                      <td className="p-2">{exp}</td>

                      <td className="p-2">
                        {getStatusBadge(item.nearest_expiration)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>{' '}
        </div>
      )}
    </div>
  )
}
