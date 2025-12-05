/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
          products ( name, unit )
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
          name: item.products?.name || 'Unknown Product',
          unit: item.products?.unit || ''
        }))
        setCart(formatted)
      }

      setLoading(false)
    }

    fetchItems()
  }, [transaction])

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

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Dialog
      open={isOpen}
      as="div"
      className="relative z-50 focus:outline-none"
      onClose={() => {}}
    >
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-600 opacity-80"
        aria-hidden="true"
      />

      {/* Centered panel container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg backdrop-blur-2xl"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <DialogTitle as="h3" className="text-base font-medium">
              Transaction Details
            </DialogTitle>
          </div>

          {/* Scrollable Content */}
          <div className="px-6 py-4">
            {loading ? (
              <p>Loading...</p>
            ) : (
              <>
                {/* Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Transaction No.</p>
                    <p className="font-semibold">{transaction.transaction_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Customer</p>
                    <p className="font-semibold">{transaction.customer?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Payment Method</p>
                    <p className="font-semibold">{transaction.payment_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Date</p>
                    <p className="font-semibold">
                      {transaction.created_at &&
                        format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600">Total Items</p>
                    <p className="text-xl font-bold text-blue-900">
                      {totalItems}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600">Total Amount</p>
                    <p className="text-xl font-bold text-green-900">
                      {formatMoney(transaction.total_amount)}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-600">Payment Status</p>
                    <div className="mt-1">
                      {transaction.payment_status === 'Paid' && (
                        <Badge variant="green">Paid</Badge>
                      )}
                      {transaction.payment_status === 'Partial' && (
                        <Badge variant="orange">Partial</Badge>
                      )}
                      {transaction.payment_status === 'Unpaid' && (
                        <Badge variant="red">Unpaid</Badge>
                      )}
                      {transaction.payment_status === 'Pending' && (
                        <Badge variant="orange">Pending</Badge>
                      )}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600">Delivery Status</p>
                    <div className="mt-1">
                      {transaction.delivery_status === 'Delivered' && (
                        <Badge variant="green">Delivered</Badge>
                      )}
                      {transaction.delivery_status === 'Pending' && (
                        <Badge variant="orange">Pending</Badge>
                      )}
                      {transaction.delivery_status === 'In Transit' && (
                        <Badge variant="blue">In Transit</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reference Number */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600">
                      Reference Number:
                    </label>
                    <Input
                      className="w-64 h-8 text-sm"
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
                </div>

                {/* Items Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            No items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        cart.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              {item.unit && (
                                <div className="text-xs text-gray-500">Unit: {item.unit}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">{item.quantity}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(item.price)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatMoney(item.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer */}
                <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
