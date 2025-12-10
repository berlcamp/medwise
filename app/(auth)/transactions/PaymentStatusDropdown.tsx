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
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAppDispatch } from '@/lib/redux/hook'
import { updateList } from '@/lib/redux/listSlice'

interface Props {
  transaction: any
  onUpdated?: () => void // optional callback after update
}

export const PaymentStatusDropdown = ({ transaction, onUpdated }: Props) => {
  const dispatch = useAppDispatch()
  const [status, setStatus] = useState(transaction.payment_status)
  const [partialAmount, setPartialAmount] = useState(
    transaction.partial_amount || 0
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<string>(status)
  const [showPartialInput, setShowPartialInput] = useState(false)

  const handleSelectStatus = (value: string) => {
    setNewStatus(value)
    if (value === 'Partial') {
      setShowPartialInput(true)
    } else {
      setShowPartialInput(false)
    }
    setConfirmOpen(true)
  }

  const handleSave = async () => {
    const updates: any = { payment_status: newStatus }
    if (newStatus === 'Partial') updates.partial_amount = partialAmount

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transaction.id)
      .select() // returns the updated row

    if (!error && data && data.length > 0) {
      const updatedTransaction = data[0]

      // Update local component state
      setStatus(updatedTransaction.payment_status)
      setPartialAmount(updatedTransaction.partial_amount || 0)

      setStatus(newStatus)
      setConfirmOpen(false)
      
      // Update Redux directly with partial update
      const reduxUpdate: any = { payment_status: newStatus, id: transaction.id }
      if (newStatus === 'Partial') {
        reduxUpdate.partial_amount = partialAmount
      }
      dispatch(updateList(reduxUpdate))
      
      if (onUpdated) onUpdated()
    } else {
      console.error(error)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant={status === 'Paid' ? 'green' : 'orange'}>
            {status === 'Partial'
              ? `Partial: ₱${Number(partialAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : status}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          {['Paid', 'Partial', 'Unpaid'].map((s) => (
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

      {/* Confirmation / Partial Amount Modal */}
      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        message={
          showPartialInput ? (
            <div className="space-y-2">
              <p>Enter partial amount:</p>
              <Input
                type="number"
                value={partialAmount}
                onChange={(e) => setPartialAmount(Number(e.target.value))}
              />
            </div>
          ) : (
            `Are you sure you want to set status to "${newStatus}"?`
          )
        }
      />
    </>
  )
}
