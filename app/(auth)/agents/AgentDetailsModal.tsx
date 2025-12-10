/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs'
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import {
    returnAgentItems
} from '@/lib/utils/agent'
import { Agent, AgentItem } from '@/types'
import { Dialog, DialogPanel } from '@headlessui/react'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  agent: Agent
}

export function AgentDetailsModal({
  isOpen,
  onClose,
  agent
}: Props) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [agentData, setAgentData] = useState<Agent>(agent)
  const user = useAppSelector((state) => state.user.user)

  // Transactions state
  const [transactions, setTransactions] = useState<any[]>([])

  // Return items state
  const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({})
  const [returningItems, setReturningItems] = useState(false)
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false)



  useEffect(() => {
    setAgentData(agent)
  }, [agent])

  // Load agent items
  useEffect(() => {
    if (!agentData?.id) return

    const fetchItems = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('agent_items')
        .select(
          `
          *,
          product:products (id, name, unit, selling_price)
        `
        )
        .eq('agent_id', agentData.id)

      if (error) {
        console.error(error)
        toast.error('Failed to load agent items')
      } else {
        setItems(data || [])
      }

      setLoading(false)
    }

    fetchItems()
  }, [agentData?.id])

  // Load transactions for this agent
  useEffect(() => {
    if (!agentData?.id || !isOpen) return

    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, customer:customer_id(name,address)')
        .eq('transaction_type', 'agent_sale')
        .ilike('customer_name', `%${agentData.name}%`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading transactions:', error)
      } else {
        setTransactions(data || [])
      }
    }

    fetchTransactions()
  }, [agentData?.id, agentData?.name, isOpen])


  const handleReturnItems = async () => {
    const itemsToReturn = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = items.find((i) => i.id === Number(itemId))
        return {
          product_id: item.product_id,
          product_stock_id: item.product_stock_id,
          quantity: qty
        }
      })

    if (itemsToReturn.length === 0) {
      toast.error('Please enter quantities to return')
      return
    }

    setReturningItems(true)

    try {
      const result = await returnAgentItems({
        agent_id: agentData.id,
        items: itemsToReturn,
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to return items')
      }

      toast.success(result.message || 'Items returned successfully!')
      setReturnItems({})
      setConfirmReturnOpen(false)

      // Reload items
      const { data: itemsData } = await supabase
        .from('agent_items')
        .select(
          `
          *,
          product:products (id, name, unit, selling_price)
        `
        )
        .eq('agent_id', agentData.id)

      if (itemsData) setItems(itemsData)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to return items')
    }

    setReturningItems(false)
  }


  const totalItemsAdded = items.reduce((sum, i) => sum + i.quantity_added, 0)
  const totalItemsSold = items.reduce((sum, i) => sum + i.quantity_sold, 0)
  const totalItemsReturned = items.reduce((sum, i) => sum + i.quantity_returned, 0)
  const totalCurrentBalance = items.reduce((sum, i) => sum + i.current_balance, 0)
  const totalValue = items.reduce((sum, i) => sum + i.total_value, 0)

  return (
    <>
      <Dialog
        open={isOpen}
        as="div"
        className="relative z-50 focus:outline-none"
        onClose={() => {}}
      >
        <div className="fixed inset-0 bg-gray-600 opacity-80" aria-hidden="true" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg"
          >
            <div className="p-6">
              {loading ? (
                <p>Loading...</p>
              ) : (
                <>
                  {/* Header */}
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold">{agentData.name}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Area</p>
                        <p className="font-semibold">{agentData.area || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Contact</p>
                        <p className="font-semibold">{agentData.contact_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Vehicle Plate</p>
                        <p className="font-semibold">{agentData.vehicle_plate_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Status</p>
                        <p className="font-semibold">{agentData.status}</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600">Items Added</p>
                      <p className="text-xl font-bold text-green-900">
                        {totalItemsAdded}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Items Sold</p>
                      <p className="text-xl font-bold text-orange-900">
                        {totalItemsSold}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Items Returned</p>
                      <p className="text-xl font-bold text-purple-900">
                        {totalItemsReturned}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Current Balance</p>
                      <p className="text-xl font-bold text-gray-900">
                        {totalCurrentBalance}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Value</p>
                      <p className="text-xl font-bold">
                        {formatMoney(totalValue)}
                      </p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Item Overview</TabsTrigger>
                      <TabsTrigger value="transactions">Transactions</TabsTrigger>
                      <TabsTrigger value="return">Return Items</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview">
                      <div className="border rounded-lg mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-center">Added</TableHead>
                              <TableHead className="text-center">Sold</TableHead>
                              <TableHead className="text-center">Returned</TableHead>
                              <TableHead className="text-center">Current</TableHead>
                              <TableHead className="text-right">Unit Price</TableHead>
                              <TableHead className="text-right">Total Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-gray-500">
                                  No items found
                                </TableCell>
                              </TableRow>
                            ) : (
                              items.map((item: AgentItem) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">
                                        {item.product?.name || 'Unknown'}
                                      </div>
                                      {item.batch_no && (
                                        <div className="text-xs text-gray-500">
                                          Batch: {item.batch_no}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.quantity_added > 0 ? (
                                      <span className="text-green-600 font-medium">
                                        +{item.quantity_added}
                                      </span>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.quantity_sold > 0 ? (
                                      <span className="text-orange-600 font-medium">
                                        -{item.quantity_sold}
                                      </span>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.quantity_returned > 0 ? (
                                      <span className="text-purple-600 font-medium">
                                        -{item.quantity_returned}
                                      </span>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-semibold">
                                      {item.current_balance}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(item.unit_price)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(item.total_value)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    {/* Transactions Tab */}
                    <TabsContent value="transactions">
                      <div className="border rounded-lg mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Transaction No.</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-center">Payment Status</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500">
                                  No transactions found
                                </TableCell>
                              </TableRow>
                            ) : (
                              transactions.map((transaction: any) => (
                                <TableRow key={transaction.id}>
                                  <TableCell>
                                    <div className="font-medium">
                                      {transaction.transaction_number}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {transaction.customer_name || transaction.customer?.name || '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(transaction.total_amount)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        transaction.payment_status === 'Paid'
                                          ? 'bg-green-100 text-green-800'
                                          : transaction.payment_status === 'Partial'
                                          ? 'bg-orange-100 text-orange-800'
                                          : transaction.payment_status === 'Unpaid'
                                          ? 'bg-red-100 text-red-800'
                                          : transaction.payment_status === 'Pending'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {transaction.payment_status?.toUpperCase() || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {transaction.created_at
                                      ? format(new Date(transaction.created_at), 'MMM dd, yyyy')
                                      : '-'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    {/* Return Items Tab */}
                    <TabsContent value="return">
                      <div className="border rounded-lg mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-center">Available</TableHead>
                              <TableHead className="text-center">Quantity to Return</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items
                              .filter((item: AgentItem) => item.current_balance > 0)
                              .map((item: AgentItem) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div className="font-medium">
                                      {item.product?.name || 'Unknown'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-semibold">
                                      {item.current_balance}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={item.current_balance}
                                      value={returnItems[item.id] || 0}
                                      onChange={(e) => {
                                        const value = Number(e.target.value)
                                        const clampedValue = Math.min(
                                          Math.max(0, value),
                                          item.current_balance
                                        )
                                        setReturnItems({
                                          ...returnItems,
                                          [item.id]: clampedValue
                                        })
                                      }}
                                      className="w-20 mx-auto"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-end pt-4 border-t mt-4">
                        <Button
                          variant="blue"
                          onClick={() => setConfirmReturnOpen(true)}
                          disabled={
                            returningItems ||
                            Object.values(returnItems).every((qty) => qty === 0)
                          }
                        >
                          {returningItems ? 'Processing...' : 'Return Items'}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

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

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={confirmReturnOpen}
        onClose={() => setConfirmReturnOpen(false)}
        onConfirm={handleReturnItems}
        message="Are you sure you want to return these items to inventory?"
      />
    </>
  )
}
