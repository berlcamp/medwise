'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { Branch, Product, User } from '@/types'
import { format, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

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
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const fetchStockMovements = async () => {
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
        .order('created_at', { ascending: true })

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
    fetchStockMovements()
  }, [])

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
    <div className="mt-4 space-y-4">
      <div className="mt-10 flex items-center justify-between gap-2">
        <Input
          placeholder="Search product..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={exportToExcel}>Export Excel</Button>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : filteredMovements.length === 0 ? (
          <p className="text-gray-500">No data found.</p>
        ) : (
          <table className="app__table">
            <thead className="app__thead">
              <tr>
                <th className="app__th">Date</th>
                <th className="app__th">Product</th>
                <th className="app__th">Batch / Mfg / Exp</th>
                <th className="app__th">Type</th>
                <th className="app__th">Quantity</th>
                {/* <th className="app__th">Remaining</th> */}
                <th className="app__th">User</th>
                <th className="app__th">Remarks</th>
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
                  <tr key={m.id} className="app__tr">
                    <td className="app__td">
                      {format(parseISO(m.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="app__td">{m.product_name}</td>
                    <td className="app__td">
                      {m.batch_no ? `Batch: ${m.batch_no}, ` : ''}
                      {m.manufacturer ? `Mfg: ${m.manufacturer}, ` : ''}
                      {m.date_manufactured ? `Date: ${mfg}, ` : ''}
                      Exp: {exp}
                    </td>
                    <td className="app__td">
                      {m.type}
                      {m.branch && <span> ({m.branch?.name})</span>}
                    </td>
                    <td className="app__td">{m.quantity}</td>
                    {/* <td className="app__td">{m.remaining_quantity ?? '-'}</td> */}
                    <td className="app__td">{m.user?.name}</td>
                    <td className="app__td">{m.remarks || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
