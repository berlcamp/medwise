/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { format, parseISO, subMonths } from 'date-fns'
import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export const ProfitReport = () => {
  const today = new Date()
  const [range, setRange] = useState([
    {
      startDate: subMonths(today, 1),
      endDate: today,
      key: 'selection'
    }
  ])
  const [mode, setMode] = useState('daily') // daily / weekly / monthly / custom

  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(
        `
        *,
        transaction_items:transaction_items(
          *,
          product:product_id(name),
          stock:product_stock_id(purchase_price)
        )
      `
      )
      .gte('created_at', range[0].startDate?.toISOString())
      .lte('created_at', range[0].endDate?.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Failed to load data')
      console.error(error)
      setLoading(false)
      return
    }

    setReportData(transactions || [])
    setLoading(false)
  }

  const exportExcel = () => {
    const rows: any[] = []

    reportData.forEach((t) =>
      t.transaction_items.forEach((item: any) => {
        rows.push({
          Date: format(parseISO(t.created_at), 'yyyy-MM-dd HH:mm'),
          'Transaction Number': t.transaction_number,
          Product: item.product?.name,
          Quantity: item.quantity,
          Price: item.price,
          'Line Total': item.total,
          'Cost Price': item.stock?.purchase_price || 0,
          Profit:
            item.total - (item.product?.purchase_price || 0) * item.quantity
        })
      })
    )

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Profit Report')
    XLSX.writeFile(
      wb,
      `Profit_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
    )
  }

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

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <div className="mt-10 flex gap-3 items-center">
        <select
          className="border px-2 py-1 rounded text-xs"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="custom">Custom Range</option>
        </select>

        {reportData.length > 0 && (
          <Button
            onClick={exportExcel}
            variant="green"
            size="xs"
            className="ml-auto"
          >
            Download Excel
          </Button>
        )}
      </div>
      <div>
        <Button onClick={fetchData} variant="blue" size="sm">
          Generate Report
        </Button>
      </div>

      {/* DATE PICKER FOR CUSTOM */}
      {mode === 'custom' && (
        <div className="border p-3 rounded inline-block">
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

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-100">
            <th className="p-2">Date</th>
            <th className="p-2">Transaction Number</th>
            <th className="p-2">Product</th>
            <th className="p-2">Qty</th>
            <th className="p-2">Price</th>
            <th className="p-2">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="p-2 text-center">
                Loading...
              </td>
            </tr>
          ) : reportData.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-2 text-center">
                No records found
              </td>
            </tr>
          ) : (
            reportData.map((t) =>
              t.transaction_items.map((item: any, idx: number) => (
                <tr key={t.id + '-' + idx} className="border-b">
                  <td className="p-2">
                    {format(parseISO(t.created_at), 'MMMM dd, yyyy HH:mm')}
                  </td>
                  <td className="p-2">{t.transaction_number}</td>
                  <td className="p-2">{item.product?.name}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">{item.price.toFixed(2)}</td>
                  <td className="p-2">{item.total.toFixed(2)}</td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
