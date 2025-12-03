/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'

/**
 * PrintSOAButton
 * - Props: customer object with at least id and name
 * - Opens a dialog to select start/end dates then generates a PDF SOA using jsPDF + autoTable
 * - Uses existing `supabase` client in the project
 *
 * Usage:
 * <PrintSOAButton customer={customer} />
 *
 * Notes:
 * - This component assumes jsPDF and jspdf-autotable are installed and available.
 *   If not, install: npm i jspdf jspdf-autotable react-datepicker react-hot-toast
 * - Styling uses existing UI components from the project. Replace with your own if different.
 */

type Customer = {
  id: number
  name: string
}

export default function PrintSOAButton({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const defaultRange = () => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 6) // default to last 6 months
    return { start, end }
  }

  // initialize default dates on first open
  const handleOpen = () => {
    if (!startDate && !endDate) {
      const { start, end } = defaultRange()
      setStartDate(start)
      setEndDate(end)
    }
    setOpen(true)
  }

  const generatePDF = async () => {
    if (!customer) return
    if (!startDate || !endDate) {
      toast.error('Please select a start and end date')
      return
    }

    setLoading(true)

    try {
      // Fetch transactions and their items within date range
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          id,
          reference_number,
          total_amount,
          payment_type,
          payment_status,
          created_at,
          transaction_number,
          transaction_items:transaction_items ( id, product_id, quantity, price, total, product:product_id(name) )
        `
        )
        .eq('customer_id', customer.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      const transactions = data || []

      // Build PDF
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 40

      // Header
      const pageWidth = doc.internal.pageSize.getWidth()

      // Centered text

      doc.setFontSize(12)
      doc.text('FEB SACOTE RECORBA', pageWidth / 2, 50, { align: 'center' })

      doc.setFontSize(10)

      doc.text('MEDWISE PHARMACEUTICAL PRODUCTS TRADING', pageWidth / 2, 65, {
        align: 'center'
      })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Statement of Account', pageWidth / 2, 100, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(`Customer: ${customer.name}`, margin, 120)
      doc.text(
        `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`,
        margin,
        140
      )
      doc.text(
        `Printed: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        margin,
        160
      )

      // Table of transactions: Date | Ref # | Tx # | Payment | Amount
      const tableBody: any[] = []
      let runningTotal = 0
      for (const tx of transactions) {
        const date = tx.created_at
          ? format(new Date(tx.created_at), 'yyyy-MM-dd')
          : '-'
        const ref = tx.reference_number || '-'
        const txnum = tx.transaction_number || '-'
        const payment = tx.payment_type || '-'
        const payment_status = tx.payment_status || '-'
        const amount = tx.total_amount || '-'
        runningTotal += amount
        tableBody.push([
          date,
          ref,
          txnum,
          payment,
          payment_status,
          amount.toFixed(2)
        ])
      }

      autoTable(doc, {
        head: [
          [
            'Date',
            'Reference',
            'Transaction #',
            'Payment Type',
            'Payment Status',
            'Amount'
          ]
        ],
        body: tableBody,
        startY: 180,
        styles: { fontSize: 10 }
      })

      // After table, print totals
      const finalY = (doc as any).lastAutoTable?.finalY || 140
      doc.setFontSize(11)
      doc.text(
        `Total: ${runningTotal.toFixed(2)}`,
        pageWidth - margin - 100,
        finalY + 30
      )

      // Optionally list details of each transaction on subsequent pages
      // (for brevity we only added summary above; you can expand to print items if you like)

      doc.save(
        `SOA_${customer.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`
      )
      toast.success('SOA generated')
      setOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to generate SOA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="xs" variant="outline" onClick={handleOpen}>
        Print SOA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Print Statement of Account
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Customer: <span className="font-medium">{customer?.name}</span>
            </p>
          </DialogHeader>

          <div className="mt-4 space-y-5">
            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Date</label>
              <div className="border rounded-lg px-3 py-2 bg-background flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40 transition">
                <DatePicker
                  preventOpenOnFocus
                  selected={startDate}
                  onChange={(d: Date | null) => setStartDate(d)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  className="w-full outline-none"
                  placeholderText="Select start date"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End Date</label>
              <div className="border rounded-lg px-3 py-2 bg-background flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40 transition">
                <DatePicker
                  selected={endDate}
                  onChange={(d: Date | null) => setEndDate(d)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  className="w-full outline-none"
                  placeholderText="Select end date"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-lg"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>

              <Button
                onClick={generatePDF}
                disabled={loading}
                className="rounded-lg"
              >
                {loading ? 'Generating...' : 'Print SOA'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
