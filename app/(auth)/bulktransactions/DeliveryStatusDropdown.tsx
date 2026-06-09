/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface Props {
  transaction: any
  onUpdated?: () => void
}

export const DeliveryStatusDropdown = ({ transaction, onUpdated }: Props) => {
  const [status, setStatus] = useState(transaction.delivery_status)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<string>(status)
  const [receiptDate, setReceiptDate] = useState<string>(
    transaction.delivery_receipt_date || ''
  )
  // Last saved receipt date, tracked locally because the transaction prop is
  // read-only (frozen Redux/state object) and cannot be mutated.
  const [savedReceiptDate, setSavedReceiptDate] = useState<string>(
    transaction.delivery_receipt_date || ''
  )

  const handleSelectStatus = (value: string) => {
    setNewStatus(value)
    if (value === 'Delivered') {
      // Default to the existing receipt date, or today if none is set yet.
      setReceiptDate(savedReceiptDate || format(new Date(), 'yyyy-MM-dd'))
    }
    setConfirmOpen(true)
  }

  const handleSave = async () => {
    const isDelivered = newStatus === 'Delivered'
    const { data, error } = await supabase
      .from('transactions')
      .update({
        delivery_status: newStatus,
        // Stamp/clear the delivery dates based on the new status.
        delivered_at: isDelivered ? new Date().toISOString() : null,
        delivery_receipt_date: isDelivered ? receiptDate || null : null
      })
      .eq('id', transaction.id)
      .select()

    if (!error && data && data.length > 0) {
      const updated = data[0]

      // Track locally; the transaction prop is read-only and cannot be mutated.
      setStatus(updated.delivery_status)
      setSavedReceiptDate(updated.delivery_receipt_date || '')
      setConfirmOpen(false)
      if (onUpdated) onUpdated()
    } else {
      console.error(error)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="xs"
            variant={status === 'Delivered' ? 'green' : 'orange'}
          >
            {status}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          {['Pending', 'Delivered'].map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleSelectStatus(s)}>
              {s === 'Delivered' && status === 'Delivered'
                ? 'Delivered (edit date)'
                : s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to set delivery status to &quot;{newStatus}
              &quot;?
            </p>
            {newStatus === 'Delivered' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">
                  Delivery Receipt Date:
                </label>
                <input
                  type="date"
                  className="h-8 rounded border px-2 text-sm"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
              </div>
            )}
          </div>
        }
      />
    </>
  )
}
