/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { DeliveryReceiptPrint } from '@/components/printables/DeliveryReceiptPrint'
import { InvoicePrint } from '@/components/printables/InvoicePrint'
import { Badge } from '@/components/ui/badge'
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
import { cn, formatMoney } from '@/lib/utils'
import {
  addConsignmentItems,
  formatConsignmentPeriod,
  generateTransactionNumber,
  recordConsignmentSale,
  returnConsignmentItems
} from '@/lib/utils/consignment'
import { Consignment, ConsignmentItem, Product, ProductStock, Transaction } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { format, isAfter, parseISO, startOfToday } from 'date-fns'
import { Printer, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

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
  // Local state for consignment data that can be updated
  const [consignmentData, setConsignmentData] = useState<Consignment>(consignment)
  const user = useAppSelector((state) => state.user.user)

  // Sale recording state
  const [saleItems, setSaleItems] = useState<{ [key: number]: number }>({})
  const [recordingSale, setRecordingSale] = useState(false)
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false)

  // Return items state
  const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({})
  const [returningItems, setReturningItems] = useState(false)
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false)

  // Add items state
  const [newItems, setNewItems] = useState<Array<{
    product_id: number
    product_name: string
    unit: string
    quantity: number
    price: number
    stock_qty: number
    total: number
  }>>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [addingItems, setAddingItems] = useState(false)
  const [confirmAddOpen, setConfirmAddOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  
  // Print state
  const [consignmentTransactions, setConsignmentTransactions] = useState<Transaction[]>([])
  const [printData, setPrintData] = useState<any>(null)
  const [printType, setPrintType] = useState<'invoice' | 'delivery' | null>(null)

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  // Update consignmentData when prop changes
  useEffect(() => {
    setConsignmentData(consignment)
  }, [consignment])

  // Load consignment transactions
  useEffect(() => {
    if (!consignmentData?.id || !isOpen) return
    
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', consignmentData.customer_id)
        .eq('transaction_type', 'consignment_sale')
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setConsignmentTransactions(data as Transaction[])
      }
    }
    
    fetchTransactions()
  }, [consignmentData?.id, consignmentData?.customer_id, isOpen])

  // Load consignment items
  useEffect(() => {
    if (!consignmentData?.id) return

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
        .eq('consignment_id', consignmentData.id)
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
  }, [consignmentData])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(productSearchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [productSearchTerm])

  // Fetch products with search and debouncing
  useEffect(() => {
    const fetchProducts = async () => {
      if (!debouncedSearchTerm.trim() && !showProductResults) {
        setProducts([])
        return
      }

      if (!debouncedSearchTerm.trim()) {
        setProducts([])
        return
      }

      setLoadingProducts(true)

      try {
        const query = supabase
          .from('products')
          .select(
            '*,product_stocks:product_stocks(remaining_quantity,type,expiration_date,branch_id)'
          )
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
          .ilike('name', `%${debouncedSearchTerm.trim()}%`)
          .limit(50)
          .order('name', { ascending: true })

        const { data: p } = await query

        if (p) {
          const today = startOfToday()

          const formatted = p.map((product) => {
            const stock_qty =
              product.product_stocks
                ?.filter((s: ProductStock) => s.branch_id === selectedBranchId)
                .reduce((acc: number, s: ProductStock) => {
                  const exp = s.expiration_date ? parseISO(s.expiration_date) : null
                  const isNotExpired = !exp || isAfter(exp, today)
                  if (!isNotExpired) return acc

                  return s.type === 'in'
                    ? acc + s.remaining_quantity
                    : acc - s.remaining_quantity
                }, 0) ?? 0

            return {
              ...product,
              stock_qty
            }
          })

          // Only show products with stock > 0 for the selected branch
          setProducts(formatted.filter((item) => item.stock_qty > 0))
        } else {
          setProducts([])
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchProducts()
  }, [selectedBranchId, debouncedSearchTerm, showProductResults])

  // Close product results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowProductResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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
      const transactionNumber = await generateTransactionNumber(consignmentData.branch_id)

      const result = await recordConsignmentSale({
        consignment_id: consignmentData.id,
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
      
      // Reload items and consignment data
      const [itemsResult, consignmentResult] = await Promise.all([
        supabase
          .from('consignment_items')
          .select(
            `
            *,
            product:products (id, name, unit, selling_price)
          `
          )
          .eq('consignment_id', consignmentData.id),
        supabase
          .from('consignments')
          .select('*')
          .eq('id', consignmentData.id)
          .single()
      ])
      
      if (itemsResult.data) setItems(itemsResult.data)
      if (consignmentResult.data) setConsignmentData(consignmentResult.data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to record sale')
    }

    setRecordingSale(false)
  }

  const printInvoice = async (transaction: Transaction) => {
    setPrintData(null)
    setPrintType(null)

    const { data: items, error } = await supabase
      .from('transaction_items')
      .select(`*, product:product_id(name)`)
      .eq('transaction_id', transaction.id)

    if (error) {
      console.error(error)
      toast.error('Failed to load transaction items')
      return
    }

    setPrintData({ transaction, items })
    setPrintType('invoice')

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        setPrintData(null)
        setPrintType(null)
      }, 500)
    }, 200)
  }

  const printDeliveryReceipt = async (transaction: Transaction) => {
    setPrintData(null)
    setPrintType(null)

    const { data: items, error } = await supabase
      .from('transaction_items')
      .select(`*, product:product_id(name)`)
      .eq('transaction_id', transaction.id)

    if (error) {
      console.error(error)
      toast.error('Failed to load transaction items')
      return
    }

    setPrintData({ transaction, items })
    setPrintType('delivery')

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        setPrintData(null)
        setPrintType(null)
      }, 500)
    }, 200)
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
        consignment_id: consignmentData.id,
        items: itemsToReturn,
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to return items')
      }

      toast.success(result.message || 'Items returned successfully!')
      setReturnItems({})
      setConfirmReturnOpen(false)
      
      // Reload items and consignment data
      const [itemsResult, consignmentResult] = await Promise.all([
        supabase
          .from('consignment_items')
          .select(
            `
            *,
            product:products (id, name, unit, selling_price)
          `
          )
          .eq('consignment_id', consignmentData.id),
        supabase
          .from('consignments')
          .select('*')
          .eq('id', consignmentData.id)
          .single()
      ])
      
      if (itemsResult.data) setItems(itemsResult.data)
      if (consignmentResult.data) setConsignmentData(consignmentResult.data)
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

  // Add items handlers
  const addProductToNewItems = (productId: number, qty = 1) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    // Check if product already in newItems
    const existingIndex = newItems.findIndex((item) => item.product_id === productId)
    
    if (existingIndex >= 0) {
      // Update existing item quantity
      setNewItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: item.quantity + qty,
                total: item.price * (item.quantity + qty)
              }
            : item
        )
      )
    } else {
      // Add new item
      setNewItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit: product.unit ?? '',
          quantity: qty,
          price: product.selling_price,
          stock_qty: product.stock_qty ?? 0,
          total: product.selling_price * qty
        }
      ])
    }

    toast.success(`${product.name} added`)
    setProductSearchTerm('')
    setDebouncedSearchTerm('')
    setShowProductResults(false)
  }

  const updateNewItemQuantity = (productId: number, qty: number) => {
    setNewItems((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          const maxQty = Math.min(qty, item.stock_qty)
          return {
            ...item,
            quantity: maxQty,
            total: item.price * maxQty
          }
        }
        return item
      })
    )
  }

  const updateNewItemPrice = (productId: number, price: number) => {
    setNewItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, price, total: price * item.quantity }
          : item
      )
    )
  }

  const removeNewItem = (productId: number) => {
    setNewItems((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const handleAddItems = async () => {
    if (newItems.length === 0) {
      toast.error('Please add at least one product')
      return
    }

    setAddingItems(true)

    try {
      const result = await addConsignmentItems({
        consignment_id: consignment.id,
        items: newItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to add items')
      }

      toast.success(result.message || 'Items added successfully!')
      setNewItems([])
      setConfirmAddOpen(false)
      
      // Reload items and consignment data
      const [itemsResult, consignmentResult] = await Promise.all([
        supabase
          .from('consignment_items')
          .select(
            `
            *,
            product:products (id, name, unit, selling_price)
          `
          )
          .eq('consignment_id', consignmentData.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('consignments')
          .select('*')
          .eq('id', consignmentData.id)
          .single()
      ])
      
      if (itemsResult.data) setItems(itemsResult.data)
      if (consignmentResult.data) {
        // Update local consignment state to refresh summary display
        setConsignmentData(consignmentResult.data)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to add items')
    }

    setAddingItems(false)
  }

  const totalAddAmount = newItems.reduce((sum, item) => sum + item.total, 0)

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
                  <p className="font-semibold">{consignmentData.consignment_number}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Customer</p>
                  <p className="font-semibold">{consignmentData.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Period</p>
                  <p className="font-semibold">
                    {formatConsignmentPeriod(consignmentData.month, consignmentData.year)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Created</p>
                  <p className="font-semibold">
                    {format(new Date(consignmentData.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600">Previous Balance</p>
                  <p className="text-xl font-bold text-blue-900">
                    {consignmentData.previous_balance_qty}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600">New Items</p>
                  <p className="text-xl font-bold text-green-900">
                    +{consignmentData.new_items_qty}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600">Sold</p>
                  <p className="text-xl font-bold text-orange-900">
                    -{consignmentData.sold_qty}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600">Returned</p>
                  <p className="text-xl font-bold text-purple-900">
                    -{consignmentData.returned_qty}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
                  <p className="text-xs text-gray-600">Current Balance</p>
                  <p className="text-xl font-bold text-gray-900">
                    {consignmentData.current_balance_qty}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Total Consigned Value</p>
                  <p className="font-semibold">
                    {formatMoney(consignmentData.total_consigned_value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Sold Value</p>
                  <p className="font-semibold text-green-600">
                    {formatMoney(consignmentData.total_sold_value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Balance Due</p>
                  <p className="font-semibold text-red-600">
                    {formatMoney(consignmentData.balance_due)}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Item Overview</TabsTrigger>
                  <TabsTrigger value="add-items">Add Items</TabsTrigger>
                  <TabsTrigger value="record-sale">Record Sale</TabsTrigger>
                  <TabsTrigger value="return">Return Items</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                  {/* Print Section */}
                  {consignmentTransactions.length > 0 && (
                    <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                      <h3 className="text-sm font-semibold mb-3">Print Documents</h3>
                      <div className="space-y-2">
                        {consignmentTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div>
                              <span className="text-sm font-medium">{tx.transaction_number}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {format(new Date(tx.created_at), 'MMM dd, yyyy')}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => printDeliveryReceipt(tx)}
                              >
                                <Printer className="w-3 h-3 mr-1" />
                                Delivery Receipt
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => printInvoice(tx)}
                              >
                                <Printer className="w-3 h-3 mr-1" />
                                Sales Invoice
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
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

                {/* Add Items Tab */}
                <TabsContent value="add-items">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Add new products or increase quantities of existing products in this consignment. 
                      Items will be deducted from available inventory.
                    </p>

                    {/* Product Search */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Search Products</label>
                      <div className="relative" ref={searchContainerRef}>
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Search products to add..."
                          value={productSearchTerm}
                          onChange={(e) => {
                            setProductSearchTerm(e.target.value)
                            setShowProductResults(e.target.value.trim().length > 0)
                          }}
                          onFocus={() => setShowProductResults(productSearchTerm.trim().length > 0)}
                          className="pl-10"
                        />
                        
                        {/* Product Search Results Dropdown */}
                        {showProductResults && loadingProducts && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-6 z-50 text-center">
                            <p className="text-gray-500">Searching products...</p>
                          </div>
                        )}
                        
                        {showProductResults && !loadingProducts && products.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
                            <div className="p-2">
                              {products.map((product) => {
                                const alreadyInNewItems = newItems.some(
                                  (item) => item.product_id === product.id
                                )
                                
                                return (
                                  <button
                                    key={product.id}
                                    onClick={() => {
                                      addProductToNewItems(product.id, 1)
                                    }}
                                    className={cn(
                                      'w-full text-left p-3 rounded-md mb-1 transition-colors flex items-center justify-between',
                                      alreadyInNewItems
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'hover:bg-blue-50 border border-transparent hover:border-blue-200 cursor-pointer'
                                    )}
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm">
                                          {product.name}
                                        </h3>
                                        {alreadyInNewItems && (
                                          <Badge variant="secondary" className="text-xs">
                                            In List
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-gray-500">{product.category}</span>
                                        <span className="text-xs text-gray-500">•</span>
                                        <span className="text-xs text-gray-500">{product.unit}</span>
                                        <span className="text-xs text-gray-500">•</span>
                                        <Badge variant="outline" className="text-xs">
                                          Stock: {product.stock_qty || 0}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="text-right ml-4">
                                      <p className="text-base font-bold text-blue-600">
                                        ₱{product.selling_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        
                        {showProductResults && !loadingProducts && products.length === 0 && productSearchTerm.trim() && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-6 z-50 text-center">
                            <p className="text-gray-500">No products found for &quot;{productSearchTerm}&quot;</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* New Items Table */}
                    {newItems.length > 0 && (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-center">Stock Available</TableHead>
                              <TableHead className="text-center">Quantity</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-[100px]">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {newItems.map((item) => {
                              const existingItem = items.find((i: ConsignmentItem) => i.product_id === item.product_id)
                              const currentConsignedQty = existingItem?.current_balance || 0
                              
                              return (
                                <TableRow key={item.product_id}>
                                  <TableCell className="font-medium">
                                    {item.product_name}
                                    {existingItem && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Currently consigned: {currentConsignedQty}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{item.stock_qty}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.stock_qty}
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateNewItemQuantity(item.product_id, Number(e.target.value))
                                      }
                                      className="w-20 mx-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={item.price}
                                      onChange={(e) =>
                                        updateNewItemPrice(item.product_id, Number(e.target.value))
                                      }
                                      className="w-24 ml-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatMoney(item.total)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => removeNewItem(item.product_id)}
                                    >
                                      Remove
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>

                        {/* Summary */}
                        <div className="bg-muted/30 px-4 py-4 border-t">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Value:</span>
                            <span>{formatMoney(totalAddAmount)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {newItems.length === 0 && (
                      <div className="border-2 border-dashed rounded-lg p-12 text-center">
                        <p className="text-muted-foreground">
                          No items added yet. Search and select products above to add them.
                        </p>
                      </div>
                    )}

                    {newItems.length > 0 && (
                      <div className="flex justify-end pt-4 border-t">
                        <Button
                          variant="default"
                          onClick={() => setConfirmAddOpen(true)}
                          disabled={addingItems}
                        >
                          {addingItems ? 'Adding...' : 'Add Items to Consignment'}
                        </Button>
                      </div>
                    )}
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

      {/* Print Components */}
      {printType === 'invoice' && printData && (
        <InvoicePrint data={printData} />
      )}
      {printType === 'delivery' && printData && (
        <DeliveryReceiptPrint data={printData} />
      )}

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

      <ConfirmationModal
        isOpen={confirmAddOpen}
        onClose={() => setConfirmAddOpen(false)}
        onConfirm={handleAddItems}
        message={`Are you sure you want to add ${newItems.reduce((sum, item) => sum + item.quantity, 0)} items (${formatMoney(totalAddAmount)}) to this consignment?`}
      />
    </>
  )
}
