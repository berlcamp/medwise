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
import { Agent } from '@/types'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  const [agentId, setAgentId] = useState<string>(
    transaction.delivery_agent_id ? String(transaction.delivery_agent_id) : ''
  )
  const [savedAgentId, setSavedAgentId] = useState<string>(
    transaction.delivery_agent_id ? String(transaction.delivery_agent_id) : ''
  )
  const [agents, setAgents] = useState<Pick<Agent, 'id' | 'name'>[]>([])

  // Load the branch's active agents once the modal needs them.
  useEffect(() => {
    if (!confirmOpen || newStatus !== 'Delivered' || agents.length > 0) return

    const fetchAgents = async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .eq('branch_id', transaction.branch_id)
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (error) console.error(error)
      else setAgents(data || [])
    }

    fetchAgents()
  }, [confirmOpen, newStatus, agents.length, transaction.branch_id])

  const handleSelectStatus = (value: string) => {
    setNewStatus(value)
    if (value === 'Delivered') {
      // Default to the existing receipt date, or today if none is set yet.
      setReceiptDate(savedReceiptDate || format(new Date(), 'yyyy-MM-dd'))
      setAgentId(savedAgentId)
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
        delivery_receipt_date: isDelivered ? receiptDate || null : null,
        // Agent is optional; clear it when the order is no longer delivered.
        delivery_agent_id: isDelivered ? (agentId ? Number(agentId) : null) : null
      })
      .eq('id', transaction.id)
      .select()

    if (!error && data && data.length > 0) {
      const updated = data[0]

      // Track locally; the transaction prop is read-only and cannot be mutated.
      setStatus(updated.delivery_status)
      setSavedReceiptDate(updated.delivery_receipt_date || '')
      setSavedAgentId(
        updated.delivery_agent_id ? String(updated.delivery_agent_id) : ''
      )
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
              <>
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
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">
                    Agent{' '}
                    <span className="font-normal text-gray-400">
                      (optional)
                    </span>
                    :
                  </label>
                  <select
                    className="h-8 rounded border bg-white px-2 text-sm"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">None</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={String(agent.id)}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        }
      />
    </>
  )
}
