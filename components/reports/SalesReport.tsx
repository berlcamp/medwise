/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

import { supabase } from '@/lib/supabase/client'
import { Transaction } from '@/types'
import { format, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { Button } from '../ui/button'

export default function SalesReport() {
  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ])

  const [mode, setMode] = useState('daily') // daily / weekly / monthly / custom
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<Transaction[]>([])

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

  async function loadSales() {
    setLoading(true)

    const start = range[0].startDate.toISOString().split('T')[0]
    const end = range[0].endDate.toISOString().split('T')[0]

    // Fetch sales + items in range
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `*,
        transaction_items (*,product:product_id(name)
        )
      `
      )
      .gte('created_at', `${start} 00:00:00`)
      .lte('created_at', `${end} 23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setReportData(data || [])
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
    loadSales()
  }, [])

  return (
    <div className="mt-4 space-y-4">
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
            onClick={downloadExcel}
            variant="green"
            size="xs"
            className="ml-auto"
          >
            Download Excel
          </Button>
        )}
      </div>
      <div>
        <Button onClick={loadSales} variant="blue" size="sm">
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

      {/* REPORT TABLE */}
      <div className="border rounded p-3 bg-white">
        {loading ? (
          <p>Loading...</p>
        ) : reportData.length === 0 ? (
          <p className="text-gray-500">No sales found for selected dates.</p>
        ) : (
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
              {reportData.map((t) =>
                t.transaction_items.map((item, idx) => (
                  <tr key={t.id + '-' + idx} className="border-b">
                    <td className="p-2">
                      {format(parseISO(t.created_at), 'MMMM dd, yyyy HH:mm')}
                    </td>
                    <td className="p-2">{t.transaction_number}</td>
                    <td className="p-2">{item.product?.name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.price}</td>
                    <td className="p-2">{item.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
