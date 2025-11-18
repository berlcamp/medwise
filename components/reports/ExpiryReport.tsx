'use client'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { differenceInDays, format, isBefore, parseISO } from 'date-fns'
import { saveAs } from 'file-saver'
import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const today = new Date()

type ProductStockExpiry = {
  id: number
  product_id: number
  product_name: string
  batch_no: string | null
  remaining_quantity: number
  expiration_date: string | null
  manufacturer: string | null
  date_manufactured: string | null
  supplier_name: string | null
}

export const ExpiryReport = () => {
  const [list, setList] = useState<ProductStockExpiry[]>([])

  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('daily') // daily / weekly / monthly / custom

  const [range, setRange] = useState([
    {
      startDate: today,
      endDate: today,
      key: 'selection'
    }
  ])

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

  const fetchExpiringStocks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_stocks')
        .select(
          `
          *,
          product:product_id(name, category),
          supplier:supplier_id(name)
        `
        )
        .gte('remaining_quantity', 1)
        .not('expiration_date', 'is', null)
        .gte('expiration_date', range[0].startDate.toISOString())
        .lte('expiration_date', range[0].endDate.toISOString())
        .order('expiration_date', { ascending: true })

      if (error) throw error

      const formatted = (data || []).map((d) => ({
        id: d.id,
        product_id: d.product_id,
        product_name: d.product?.name || '',
        batch_no: d.batch_no,
        remaining_quantity: d.remaining_quantity,
        expiration_date: d.expiration_date,
        manufacturer: d.manufacturer,
        date_manufactured: d.date_manufactured,
        supplier_name: d.supplier?.name || '-'
      }))

      setList(formatted)
    } catch (err) {
      console.error(err)
      toast.error('Failed to fetch expiring stocks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpiringStocks()
  }, [])

  // ---------- EXPORT TO EXCEL ----------
  const exportToExcel = () => {
    const wsData = list.map((item) => ({
      Product: item.product_name,
      'Batch #': item.batch_no || '-',
      Supplier: item.supplier_name,
      'Remaining Qty': item.remaining_quantity,
      Manufacturer: item.manufacturer || '-',
      'Mfg Date': item.date_manufactured
        ? format(parseISO(item.date_manufactured), 'MMM dd, yyyy')
        : '-',
      'Expiry Date': item.expiration_date
        ? format(parseISO(item.expiration_date), 'MMM dd, yyyy')
        : '-',
      'Days to Expiry': item.expiration_date
        ? differenceInDays(parseISO(item.expiration_date), new Date())
        : '-'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Expiry Report')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `expiry_report_${new Date().toISOString()}.xlsx`)
  }

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

        {list.length > 0 && (
          <Button
            onClick={exportToExcel}
            variant="green"
            size="xs"
            className="ml-auto"
          >
            Download Excel
          </Button>
        )}
      </div>
      <div>
        <Button onClick={fetchExpiringStocks} variant="blue" size="sm">
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

      <div className="overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">No data found.</p>
        ) : (
          <table className="app__table">
            <thead className="app__thead">
              <tr>
                <th className="app__th">Product</th>
                <th className="app__th">Batch / Supplier</th>
                <th className="app__th">Remaining Qty</th>
                <th className="app__th">Mfg Date / Exp</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const exp = item.expiration_date
                  ? format(parseISO(item.expiration_date), 'MMM dd, yyyy')
                  : '-'
                const mfg = item.date_manufactured
                  ? format(parseISO(item.date_manufactured), 'MMM dd, yyyy')
                  : '-'
                const today = new Date()
                const isExpired = item.expiration_date
                  ? isBefore(parseISO(item.expiration_date), today)
                  : false

                return (
                  <tr key={item.id} className="app__tr">
                    <td className="app__td">{item.product_name}</td>
                    <td className="app__td">
                      {item.batch_no && <>Batch: {item.batch_no}, </>}
                      Supplier: {item.supplier_name}
                    </td>
                    <td className="app__td">{item.remaining_quantity}</td>
                    <td className="app__td">
                      {item.manufacturer && <>Mfg: {item.manufacturer}, </>}
                      {item.date_manufactured && <>Date: {mfg}, </>}
                      Exp: {exp}
                      {isExpired && (
                        <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">
                          Expired
                        </span>
                      )}
                    </td>
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
