'use client'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { ProductStock } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { format, parseISO } from 'date-fns'
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  Loader2,
  PackagePlus,
  ShoppingCart
} from 'lucide-react'
import { useEffect, useState } from 'react'

type TrackMovementModalProps = {
  isOpen: boolean
  onClose: () => void
  selectedItem: ProductStock | null
}

type MovementEvent = {
  id: string
  date: string
  type: 'added' | 'sale' | 'consignment_sale' | 'damage' | 'missing' | 'expired' | 'transfer' | 'other'
  label: string
  quantity: number
  reference?: string
  customer?: string
  user?: string
  remarks?: string
  destBranch?: string
}

const typeMeta: Record<
  MovementEvent['type'],
  { color: string; bg: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  added: { color: 'text-green-700', bg: 'bg-green-100', icon: PackagePlus, label: 'Stock Added' },
  sale: { color: 'text-blue-700', bg: 'bg-blue-100', icon: ShoppingCart, label: 'Sale' },
  consignment_sale: { color: 'text-indigo-700', bg: 'bg-indigo-100', icon: ShoppingCart, label: 'Consignment Sale' },
  damage: { color: 'text-red-700', bg: 'bg-red-100', icon: ArrowDownCircle, label: 'Damaged' },
  missing: { color: 'text-red-700', bg: 'bg-red-100', icon: ArrowDownCircle, label: 'Missing' },
  expired: { color: 'text-orange-700', bg: 'bg-orange-100', icon: ArrowDownCircle, label: 'Expired' },
  transfer: { color: 'text-purple-700', bg: 'bg-purple-100', icon: ArrowRightLeft, label: 'Transferred' },
  other: { color: 'text-gray-700', bg: 'bg-gray-100', icon: ArrowUpCircle, label: 'Movement' }
}

const normalizeRemovalType = (type: string): MovementEvent['type'] => {
  const t = (type || '').toLowerCase()
  if (t === 'damage' || t === 'damaged') return 'damage'
  if (t === 'missing') return 'missing'
  if (t === 'expired') return 'expired'
  if (t === 'transfer') return 'transfer'
  return 'other'
}

export const TrackMovementModal = ({
  isOpen,
  onClose,
  selectedItem
}: TrackMovementModalProps) => {
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<MovementEvent[]>([])

  useEffect(() => {
    if (!isOpen || !selectedItem) return

    let isMounted = true

    const fetchMovements = async () => {
      setLoading(true)
      const collected: MovementEvent[] = []

      // 1. Stock added event (the product_stocks row itself)
      collected.push({
        id: `added-${selectedItem.id}`,
        date: selectedItem.created_at,
        type: 'added',
        label: 'Stock Added',
        quantity: selectedItem.quantity,
        reference: selectedItem.batch_no || undefined,
        remarks: selectedItem.remarks || undefined
      })

      // 2. Sales via transactions
      const { data: txItems } = await supabase
        .from('transaction_items')
        .select(
          `
          id,
          quantity,
          created_at,
          transaction:transaction_id (
            transaction_number,
            reference_number,
            customer_name,
            status,
            transaction_type,
            created_at
          )
        `
        )
        .eq('product_stock_id', selectedItem.id)

      if (txItems) {
        txItems.forEach((row: unknown) => {
          const item = row as {
            id: number
            quantity: number
            created_at: string
            transaction:
              | {
                  transaction_number?: string
                  reference_number?: string
                  customer_name?: string | null
                  status?: string
                  transaction_type?: string
                  created_at?: string
                }
              | null
          }
          const tx = item.transaction
          const isReturned = tx?.status === 'returned'
          collected.push({
            id: `tx-${item.id}`,
            date: tx?.created_at || item.created_at,
            type: 'sale',
            label: isReturned ? 'Sale (Returned)' : 'Sale',
            quantity: item.quantity,
            reference:
              tx?.transaction_number || tx?.reference_number || undefined,
            customer: tx?.customer_name || undefined,
            remarks: isReturned ? 'Transaction returned' : undefined
          })
        })
      }

      // 3. Consignment sales (best-effort — ignore if table absent / no access)
      const { data: consItems } = await supabase
        .from('consignment_item_transaction_items')
        .select(
          `
          id,
          quantity,
          created_at,
          consignment_transaction:consignment_transaction_id (
            transaction_number,
            customer_name,
            transaction_type,
            created_at
          )
        `
        )
        .eq('product_stock_id', selectedItem.id)

      if (consItems) {
        consItems.forEach((row: unknown) => {
          const item = row as {
            id: number
            quantity: number
            created_at: string
            consignment_transaction:
              | {
                  transaction_number?: string
                  customer_name?: string | null
                  transaction_type?: string
                  created_at?: string
                }
              | null
          }
          const ctx = item.consignment_transaction
          const isReturn = (ctx?.transaction_type || '').toLowerCase().includes('return')
          collected.push({
            id: `ctx-${item.id}`,
            date: ctx?.created_at || item.created_at,
            type: 'consignment_sale',
            label: isReturn ? 'Consignment Return' : 'Consignment Sale',
            quantity: item.quantity,
            reference: ctx?.transaction_number || undefined,
            customer: ctx?.customer_name || undefined
          })
        })
      }

      // 4. Stock movements (damage, missing, expired, transfer)
      const { data: movements } = await supabase
        .from('stock_movements')
        .select(
          `
          id,
          quantity,
          type,
          remarks,
          created_at,
          dest_branch,
          user:user_id (name),
          branch:dest_branch (name)
        `
        )
        .eq('product_stock_id', selectedItem.id)

      if (movements) {
        movements.forEach((row: unknown) => {
          const m = row as {
            id: number
            quantity: number
            type: string
            remarks?: string | null
            created_at: string
            dest_branch?: number | null
            user?: { name?: string } | null
            branch?: { name?: string } | null
          }
          const moveType = normalizeRemovalType(m.type)
          collected.push({
            id: `mv-${m.id}`,
            date: m.created_at,
            type: moveType,
            label: typeMeta[moveType].label,
            quantity: m.quantity,
            user: m.user?.name || undefined,
            remarks: m.remarks || undefined,
            destBranch: moveType === 'transfer' ? m.branch?.name || undefined : undefined
          })
        })
      }

      collected.sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0
        const tb = b.date ? new Date(b.date).getTime() : 0
        return tb - ta
      })

      if (isMounted) {
        setEvents(collected)
        setLoading(false)
      }
    }

    fetchMovements()

    return () => {
      isMounted = false
    }
  }, [isOpen, selectedItem])

  const formatDate = (d?: string) => {
    if (!d) return '-'
    try {
      return format(parseISO(d), 'MMM dd, yyyy hh:mm a')
    } catch {
      return d
    }
  }

  return (
    <Dialog open={isOpen} as="div" className="relative z-50" onClose={onClose}>
      <div className="fixed inset-0 bg-gray-600 opacity-80" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="app__modal_dialog_panel">
          <div className="app__modal_dialog_title_container">
            <DialogTitle as="h3" className="text-base font-medium">
              Track Movement
              {selectedItem?.product?.name && (
                <span className="ml-2 font-normal text-gray-200">
                  — {selectedItem.product.name}
                </span>
              )}
            </DialogTitle>
          </div>

          <div className="app__modal_dialog_content">
            {selectedItem && (
              <div className="rounded border bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <div className="grid grid-cols-2 gap-y-1 md:grid-cols-4">
                  <div>
                    <span className="font-semibold">Batch:</span>{' '}
                    {selectedItem.batch_no || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Manufacturer:</span>{' '}
                    {selectedItem.manufacturer || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Manufactured:</span>{' '}
                    {selectedItem.date_manufactured
                      ? format(parseISO(selectedItem.date_manufactured), 'MMM dd, yyyy')
                      : '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Expires:</span>{' '}
                    {selectedItem.expiration_date
                      ? format(parseISO(selectedItem.expiration_date), 'MMM dd, yyyy')
                      : '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Initial Qty:</span>{' '}
                    {selectedItem.quantity}
                  </div>
                  <div>
                    <span className="font-semibold">Remaining:</span>{' '}
                    {selectedItem.remaining_quantity}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading movement history...
              </div>
            ) : events.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No movement history found for this batch.
              </div>
            ) : (
              <ol className="relative space-y-3 border-l border-gray-200 pl-5">
                {events.map((ev) => {
                  const meta = typeMeta[ev.type]
                  const Icon = meta.icon
                  return (
                    <li key={ev.id} className="relative">
                      <span
                        className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ${meta.bg}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      </span>
                      <div className="rounded border bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}
                            >
                              {ev.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(ev.date)}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            {ev.type === 'added' ? '+' : '-'}
                            {ev.quantity}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                          {ev.reference && (
                            <div>
                              <span className="font-semibold">Ref:</span> {ev.reference}
                            </div>
                          )}
                          {ev.customer && (
                            <div>
                              <span className="font-semibold">Customer:</span>{' '}
                              {ev.customer}
                            </div>
                          )}
                          {ev.destBranch && (
                            <div>
                              <span className="font-semibold">To Branch:</span>{' '}
                              {ev.destBranch}
                            </div>
                          )}
                          {ev.user && (
                            <div>
                              <span className="font-semibold">By:</span> {ev.user}
                            </div>
                          )}
                          {ev.remarks && (
                            <div>
                              <span className="font-semibold">Remarks:</span>{' '}
                              {ev.remarks}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <div className="app__modal_dialog_footer px-6 pb-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
