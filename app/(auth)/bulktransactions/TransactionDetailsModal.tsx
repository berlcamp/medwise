/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Transaction } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
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

  // Load transaction items
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

  // Update reference number
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
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Centered panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="app__modal_dialog_panel">
          {/* Header */}
          <div className="app__modal_dialog_title_container">
            <DialogTitle className="text-base font-medium">
              Transaction Details
            </DialogTitle>
          </div>

          {/* Scrollable content */}
          <div className="app__modal_dialog_content space-y-4">
            {loading ? (
              <p>Loading...</p>
            ) : (
              <>
                {/* Header Info */}
                <div className="space-y-2 border-b pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <strong>Reference:</strong>
                    <Input
                      className="app__input_standard w-48 h-7 text-sm"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Enter reference number"
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
                    <strong>Customer:</strong>{' '}
                    {transaction.customer?.name || '-'}
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
                <div className="overflow-x-auto">
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
                </div>
              </>
            )}
            {/* Footer */}
            <div className="app__modal_dialog_footer mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
