/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
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
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import {
  formatConsignmentPeriod,
  generateTransactionNumber,
  recordConsignmentSale,
  returnConsignmentItems
} from '@/lib/utils/consignment'
import { Consignment, ConsignmentItem } from '@/types'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@/lib/redux/hook'
import { ConfirmationModal } from '@/components/ConfirmationModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  consignment: Consignment
}

export function ConsignmentDetailsModal({
  isOpen,
  onClose,
  consignment
}: Props) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const user = useAppSelector((state) => state.user.user)

  // Sale recording state
  const [saleItems, setSaleItems] = useState<{ [key: number]: number }>({})
  const [recordingSale, setRecordingSale] = useState(false)
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false)

  // Return items state
  const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({})
  const [returningItems, setReturningItems] = useState(false)
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false)

  // Load consignment items
  useEffect(() => {
    if (!consignment?.id) return

    const fetchItems = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('consignment_items')
        .select(
          `
          *,
          product:products (id, name, unit, selling_price)
        `
        )
        .eq('consignment_id', consignment.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error(error)
        toast.error('Failed to load consignment items')
      } else {
        setItems(data || [])
      }

      setLoading(false)
    }

    fetchItems()
  }, [consignment])

  const handleRecordSale = async () => {
    const itemsToSell = Object.entries(saleItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = items.find((i) => i.id === Number(itemId))
        return {
          product_id: item.product_id,
          quantity: qty,
          price: item.unit_price
        }
      })

    if (itemsToSell.length === 0) {
      toast.error('Please enter quantities to record as sold')
      return
    }

    setRecordingSale(true)

    try {
      const transactionNumber = await generateTransactionNumber()

      const result = await recordConsignmentSale({
        consignment_id: consignment.id,
        items: itemsToSell,
        transaction_number: transactionNumber,
        payment_type: 'Consignment',
        payment_status: 'Pending',
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to record sale')
      }

      toast.success(result.message || 'Sale recorded successfully!')
      setSaleItems({})
      setConfirmSaleOpen(false)
      
      // Reload items
      const { data } = await supabase
        .from('consignment_items')
        .select(
          `
          *,
          product:products (id, name, unit, selling_price)
        `
        )
        .eq('consignment_id', consignment.id)
      
      if (data) setItems(data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to record sale')
    }

    setRecordingSale(false)
  }

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
      const result = await returnConsignmentItems({
        consignment_id: consignment.id,
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
      const { data } = await supabase
        .from('consignment_items')
        .select(
          `
          *,
          product:products (id, name, unit, selling_price)
        `
        )
        .eq('consignment_id', consignment.id)
      
      if (data) setItems(data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to return items')
    }

    setReturningItems(false)
  }

  const totalSaleAmount = Object.entries(saleItems).reduce((sum, [itemId, qty]) => {
    const item = items.find((i) => i.id === Number(itemId))
    return sum + (item?.unit_price || 0) * qty
  }, 0)

  return (
    <>
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
            className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg backdrop-blur-2xl"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
              <DialogTitle as="h3" className="text-base font-medium">
                Manage Consignment
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
                  <p className="text-gray-500 text-xs">Consignment No.</p>
                  <p className="font-semibold">{consignment.consignment_number}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Customer</p>
                  <p className="font-semibold">{consignment.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Period</p>
                  <p className="font-semibold">
                    {formatConsignmentPeriod(consignment.month, consignment.year)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Created</p>
                  <p className="font-semibold">
                    {format(new Date(consignment.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600">Previous Balance</p>
                  <p className="text-xl font-bold text-blue-900">
                    {consignment.previous_balance_qty}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600">New Items</p>
                  <p className="text-xl font-bold text-green-900">
                    +{consignment.new_items_qty}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600">Sold</p>
                  <p className="text-xl font-bold text-orange-900">
                    -{consignment.sold_qty}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600">Returned</p>
                  <p className="text-xl font-bold text-purple-900">
                    -{consignment.returned_qty}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
                  <p className="text-xs text-gray-600">Current Balance</p>
                  <p className="text-xl font-bold text-gray-900">
                    {consignment.current_balance_qty}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Total Consigned Value</p>
                  <p className="font-semibold">
                    {formatMoney(consignment.total_consigned_value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Sold Value</p>
                  <p className="font-semibold text-green-600">
                    {formatMoney(consignment.total_sold_value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Balance Due</p>
                  <p className="font-semibold text-red-600">
                    {formatMoney(consignment.balance_due)}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Item Overview</TabsTrigger>
                  <TabsTrigger value="record-sale">Record Sale</TabsTrigger>
                  <TabsTrigger value="return">Return Items</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Prev Balance</TableHead>
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
                            <TableCell colSpan={8} className="text-center text-gray-500">
                              No items found
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item: ConsignmentItem) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {item.product?.name || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.batch_no && `Batch: ${item.batch_no}`}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.previous_balance > 0 ? (
                                  <span className="text-blue-600 font-medium">
                                    {item.previous_balance}
                                  </span>
                                ) : (
                                  '-'
                                )}
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

                {/* Record Sale Tab */}
                <TabsContent value="record-sale">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Enter quantities sold by the customer. This will deduct from
                      consigned inventory and create a transaction record.
                    </p>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-center">
                              Current Balance
                            </TableHead>
                            <TableHead className="text-center">
                              Quantity Sold
                            </TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items
                            .filter((item: ConsignmentItem) => item.current_balance > 0)
                            .map((item: ConsignmentItem) => {
                              const qtySold = saleItems[item.id] || 0
                              const subtotal = qtySold * item.unit_price
                              return (
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
                                      min={0}
                                      max={item.current_balance}
                                      value={saleItems[item.id] || 0}
                                      onChange={(e) => {
                                        const value = Number(e.target.value)
                                        const clampedValue = Math.min(Math.max(0, value), item.current_balance)
                                        setSaleItems({
                                          ...saleItems,
                                          [item.id]: clampedValue
                                        })
                                      }}
                                      className="w-20 mx-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(item.unit_price)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(subtotal)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t">
                      <div>
                        <p className="text-sm text-gray-600">Total Sale Amount:</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatMoney(totalSaleAmount)}
                        </p>
                      </div>
                      <Button
                        variant="green"
                        onClick={() => setConfirmSaleOpen(true)}
                        disabled={
                          recordingSale ||
                          Object.values(saleItems).every((qty) => qty === 0)
                        }
                      >
                        {recordingSale ? 'Recording...' : 'Record Sale'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Return Items Tab */}
                <TabsContent value="return">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Return unsold items back to inventory. This will increase
                      available stock.
                    </p>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-center">
                              Current Balance
                            </TableHead>
                            <TableHead className="text-center">
                              Quantity to Return
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items
                            .filter((item: ConsignmentItem) => item.current_balance > 0)
                            .map((item: ConsignmentItem) => (
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
                                    min={0}
                                    max={item.current_balance}
                                    value={returnItems[item.id] || 0}
                                    onChange={(e) => {
                                      const value = Number(e.target.value)
                                      const clampedValue = Math.min(Math.max(0, value), item.current_balance)
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
                    <div className="flex justify-end pt-4 border-t">
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
        isOpen={confirmSaleOpen}
        onClose={() => setConfirmSaleOpen(false)}
        onConfirm={handleRecordSale}
        message={`Are you sure you want to record this sale of ${formatMoney(totalSaleAmount)}?`}
      />

      <ConfirmationModal
        isOpen={confirmReturnOpen}
        onClose={() => setConfirmReturnOpen(false)}
        onConfirm={handleReturnItems}
        message="Are you sure you want to return these items to inventory?"
      />
    </>
  )
}
