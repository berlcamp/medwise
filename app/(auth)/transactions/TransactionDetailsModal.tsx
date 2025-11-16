/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input' // ✅ use your existing input component if available
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Transaction } from '@/types'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction
}: Props) {
  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [referenceNumber, setReferenceNumber] = useState(
    transaction.reference_number || ''
  )

  // ✅ Load items with joined product/service names
  useEffect(() => {
    if (!transaction?.id) return

    const fetchItems = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('transaction_items')
        .select(
          `
          id,
          quantity,
          price,
          total,
          product_id,
          products ( name )
        `
        )
        .eq('transaction_id', transaction.id)

      if (error) {
        console.error(error)
        toast.error('Failed to load transaction items')
      } else {
        // ✅ Normalize data for easier rendering
        const formatted = data.map((item: any) => ({
          id: item.id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.total),
          name: item.products?.name || 'Unknown Product'
        }))
        setCart(formatted)
      }

      setLoading(false)
    }

    fetchItems()
  }, [transaction])

  // ✅ Update reference number in Supabase
  const handleUpdateReference = async () => {
    if (!transaction?.id) return
    if (!referenceNumber.trim()) {
      toast.error('Reference number cannot be empty')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('transactions')
      .update({ reference_number: referenceNumber.trim() })
      .eq('id', transaction.id)

    if (error) {
      console.error(error)
      toast.error('Failed to update reference number')
    } else {
      toast.success('Reference number updated successfully')
    }

    setSaving(false)
  }

  useEffect(() => {
    setReferenceNumber(transaction.reference_number || '')
  }, [isOpen, transaction.reference_number])
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Header Info */}
            <div className="space-y-2 border-b pb-4 mb-4 text-sm">
              <div className="flex items-center gap-2 mb-4">
                <strong>Reference:</strong>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Enter reference number"
                  className="w-48 h-7 text-sm"
                />
                <Button
                  variant="blue"
                  size="xs"
                  onClick={handleUpdateReference}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>

              <p>
                <strong>Transaction No:</strong>{' '}
                {transaction.transaction_number}
              </p>
              <p>
                <strong>Customer:</strong> {transaction.customer?.name || '-'}
              </p>
              <p>
                <strong>Date:</strong>{' '}
                {transaction.created_at &&
                  format(new Date(transaction.created_at), 'MMMM dd, yyyy')}
              </p>
              <p>
                <strong>Total Amount:</strong>{' '}
                {formatMoney(transaction.total_amount)}
              </p>
              <p>
                <strong>Payment Method:</strong> {transaction.payment_type}
              </p>
            </div>

            {/* Item List */}
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Item</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">
                      ₱{item.price.toLocaleString()}
                    </td>
                    <td className="p-2 text-right">
                      ₱{item.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
