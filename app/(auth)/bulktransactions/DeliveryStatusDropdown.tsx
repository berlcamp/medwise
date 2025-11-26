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

  const handleSelectStatus = (value: string) => {
    setNewStatus(value)
    setConfirmOpen(true)
  }

  const handleSave = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .update({ delivery_status: newStatus })
      .eq('id', transaction.id)
      .select()

    if (!error && data && data.length > 0) {
      const updated = data[0]

      setStatus(updated.delivery_status)
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
            <DropdownMenuItem
              key={s}
              onClick={() => handleSelectStatus(s)}
              disabled={s === status}
            >
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        message={`Are you sure you want to set delivery status to "${newStatus}"?`}
      />
    </>
  )
}
