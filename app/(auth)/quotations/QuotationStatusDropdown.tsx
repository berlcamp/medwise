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
import { useAppDispatch } from '@/lib/redux/hook'
import { updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { Quotation } from '@/types'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  quotation: Quotation
  onUpdated?: () => void
}

export const QuotationStatusDropdown = ({ quotation, onUpdated }: Props) => {
  const dispatch = useAppDispatch()
  const [status, setStatus] = useState(quotation.status)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<string>(status)

  const handleSelectStatus = (value: string) => {
    setNewStatus(value)
    setConfirmOpen(true)
  }

  const handleSave = async () => {
    const { data, error } = await supabase
      .from('quotations')
      .update({ status: newStatus })
      .eq('id', quotation.id)
      .select()

    if (!error && data && data.length > 0) {
      const updated = data[0]

      setStatus(updated.status)
      setConfirmOpen(false)
      
      // Update Redux state
      dispatch(updateList({ id: quotation.id, status: newStatus }))
      
      toast.success(`Quotation status updated to ${newStatus}`)
      
      if (onUpdated) onUpdated()
    } else {
      console.error(error)
      toast.error(error?.message || 'Failed to update quotation status')
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'draft':
        return 'outline'
      case 'sent':
        return 'blue'
      case 'accepted':
        return 'green'
      case 'rejected':
        return 'destructive'
      case 'expired':
        return 'orange'
      default:
        return 'outline'
    }
  }

  const statusOptions: Quotation['status'][] = ['draft', 'sent', 'accepted', 'rejected', 'expired']

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant={getStatusVariant(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          {statusOptions.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => handleSelectStatus(s)}
              disabled={s === status}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        message={`Are you sure you want to change quotation status from "${status.charAt(0).toUpperCase() + status.slice(1)}" to "${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}"?`}
      />
    </>
  )
}
