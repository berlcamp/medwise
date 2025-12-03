/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { Transaction } from '@/types'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction
}

export function ReturnsModal({ isOpen, onClose, transaction }: Props) {
  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load items
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
          product_stock_id,
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
          original_quantity: Number(item.quantity), // keep original for adjustment
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.total),
          name: item.products?.name || 'Unknown Product',
          product_id: item.product_id,
          product_stock_id: item.product_stock_id // must exist to update stock
        }))
        setCart(formatted)
      }

      setLoading(false)
    }

    fetchItems()
  }, [transaction])

  // SAVE updates transaction items & stocks
  const handleSave = async () => {
    setSaving(true)

    try {
      for (const item of cart) {
        const newQty = Number(item.quantity)
        const oldQty = Number(item.original_quantity)
        const diff = newQty - oldQty // + means more sold, - means returned

        // Update transaction_items
        await supabase
          .from('transaction_items')
          .update({
            quantity: newQty,
            total: newQty * item.price
          })
          .eq('id', item.id)

        // Fetch stock record
        const { data: stock } = await supabase
          .from('product_stocks')
          .select('*')
          .eq('id', item.product_stock_id)
          .single()

        if (!stock) throw new Error('Stock not found')

        let remaining = stock.remaining_quantity
        let consigned = stock.consigned_quantity

        if (diff > 0) {
          // More items sold → Deduct from consigned first
          let needed = diff

          if (consigned >= needed) {
            consigned -= needed
          } else {
            needed -= consigned
            consigned = 0
            remaining -= needed
          }
        }

        if (diff < 0) {
          // Items returned
          const returned = Math.abs(diff)

          // Returned items go ONLY to remaining_quantity
          remaining += returned
          // DO NOT increase consigned_quantity
        }

        // Update product stock row
        await supabase
          .from('product_stocks')
          .update({
            remaining_quantity: remaining,
            consigned_quantity: consigned
          })
          .eq('id', item.product_stock_id)
      }

      // Recalculate transaction total
      const totalAmount = cart.reduce((sum, item) => sum + item.total, 0)

      // Update the transactions table
      await supabase
        .from('transactions')
        .update({
          total_amount: totalAmount
        })
        .eq('id', transaction.id) // ensure you have transactionId

      toast.success('Quantities updated successfully!')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save changes.')
    }

    setSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Quantities</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Item List */}
            <table className="w-full mt-4 text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Item</th>
                  <th className="p-2">Qty</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={1}
                        max={item.original_quantity}
                        className="border px-2 py-1 w-20 text-right"
                        value={item.quantity}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          const updated = [...cart]
                          updated[idx].quantity = value
                          updated[idx].total = value * updated[idx].price
                          setCart(updated)
                        }}
                      />
                    </td>
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

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
