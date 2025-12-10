/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { AddModal as AddCustomerModal } from '@/app/(auth)/customers/AddModal'
import { QuotationPrint } from '@/components/printables/QuotationPrint'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { cn, formatMoney } from '@/lib/utils'
import { Customer, Product } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Plus, Search, Trash2, User, Calendar, Package, ShoppingCart, DollarSign, FileText, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const FormSchema = z.object({
  customer_id: z.coerce
    .number({ invalid_type_error: 'Customer required' })
    .min(1, 'Customer required'),
  quotation_date: z.string().min(1, 'Date required'),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  product_id: z.coerce.number().optional()
})

type FormType = z.infer<typeof FormSchema>

interface CartItem {
  product_id: number
  product_name: string
  unit: string
  quantity: number
  price: number
  total: number
}

export default function QuotationForm() {
  const router = useRouter()
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      quotation_date: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  })

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [printData, setPrintData] = useState<any>(null)
  const [shouldPrint, setShouldPrint] = useState(false)

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const totalAmount = cartItems.reduce((acc, i) => acc + i.total, 0)

  // Handle printing when printData is ready
  useEffect(() => {
    if (shouldPrint && printData) {
      // Wait for React to render the component
      const timer = setTimeout(() => {
        // Check if the print element exists
        const printElement = document.getElementById('quotation-print-area')
        if (printElement) {
          // Use requestAnimationFrame to ensure DOM is fully updated
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.print()
              setTimeout(() => {
                setPrintData(null)
                setShouldPrint(false)
              }, 500)
            })
          })
        } else {
          console.error('Print element not found')
          setPrintData(null)
          setShouldPrint(false)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [shouldPrint, printData])

  // Load customers
  useEffect(() => {
    if (!selectedBranchId) return
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .order('name', { ascending: true })
      if (data) setCustomers(data)
    }
    fetchCustomers()
  }, [selectedBranchId])

  // Load products
  useEffect(() => {
    if (!selectedBranchId || !productSearchTerm.trim()) {
      setProducts([])
      return
    }

    setLoadingProducts(true)
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .ilike('name', `%${productSearchTerm}%`)
        .limit(20)
      if (data) setProducts(data)
      setLoadingProducts(false)
    }

    const timer = setTimeout(fetchProducts, 300)
    return () => clearTimeout(timer)
  }, [productSearchTerm, selectedBranchId])

  // Close product results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowProductResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addToCart = (product: Product) => {
    const existing = cartItems.find((item) => item.product_id === product.id)
    if (existing) {
      setCartItems(
        cartItems.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        )
      )
    } else {
      setCartItems([
        ...cartItems,
        {
          product_id: product.id,
          product_name: product.name,
          unit: product.unit || 'pcs',
          quantity: 1,
          price: product.selling_price,
          total: product.selling_price
        }
      ])
    }
    setProductSearchTerm('')
    setShowProductResults(false)
  }

  const removeFromCart = (productId: number) => {
    setCartItems(cartItems.filter((item) => item.product_id !== productId))
  }

  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCartItems(
      cartItems.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, total: quantity * item.price }
          : item
      )
    )
  }

  const onSubmit = async (data: FormType) => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one product')
      return
    }

    if (!selectedBranchId) {
      toast.error('Please select a branch')
      return
    }

    setSubmitting(true)

    try {
      const customer = customers.find((c) => c.id === data.customer_id)

      // Generate temporary quotation number for display
      const { data: quoteNumData } = await supabase.rpc('generate_quotation_number')
      const quotationNumber = quoteNumData || `QT-${Date.now()}`

      // Prepare quotation data for printing
      const quotationData = {
        quotation_number: quotationNumber,
        quotation_date: data.quotation_date,
        valid_until: data.valid_until || null,
        total_amount: totalAmount,
        notes: data.notes || null,
        customer_name: customer?.name || '',
        customer: customer || null
      }

      // Prepare items for printing
      const printItems = cartItems.map((item, index) => ({
        id: item.product_id || index,
        product_name: item.product_name,
        product: {
          name: item.product_name,
          unit: item.unit
        },
        quantity: item.quantity,
        unit_price: item.price,
        price: item.price,
        total: item.total,
        unit: item.unit
      }))

      const printDataToSet = { 
        quotation: quotationData, 
        items: printItems || [] 
      }
      
      setPrintData(printDataToSet)
      setShouldPrint(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to prepare quotation')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCustomers = searchTerm.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : customers

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6 print:hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            New Quotation
          </h1>
          <p className="text-gray-600 mt-2">Create a quotation for your customer</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer & Date Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Customer & Date Information
                </CardTitle>
                <CardDescription>
                  Select the customer and set quotation dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col md:col-span-2">
                        <FormLabel className="text-base font-medium">Customer</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between h-12 text-base',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {field.value
                                    ? customers.find((c) => c.id === field.value)?.name
                                    : 'Select customer...'}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search customer..."
                                value={searchTerm}
                                onValueChange={setSearchTerm}
                              />
                              <CommandEmpty>
                                <div className="p-4 flex flex-col items-center gap-3">
                                  <User className="h-12 w-12 text-gray-400" />
                                  <p className="text-sm text-gray-500">No customer found</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsAddCustomerOpen(true)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Customer
                                  </Button>
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {filteredCustomers.map((customer) => (
                                  <CommandItem
                                    value={customer.name}
                                    key={customer.id}
                                    onSelect={() => {
                                      form.setValue('customer_id', customer.id)
                                      setSearchTerm('')
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === customer.id
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    {customer.name}
                                  </CommandItem>
                                ))}
                                <div className="border-t p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => setIsAddCustomerOpen(true)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add New Customer
                                  </Button>
                                </div>
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quotation_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          Quotation Date
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valid_until"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          Valid Until
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Search Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Add Products
                </CardTitle>
                <CardDescription>
                  Search and add products to include in the quotation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative" ref={searchContainerRef}>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <Input
                        placeholder="Search products by name..."
                        value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value)
                          setShowProductResults(true)
                        }}
                        onFocus={() => setShowProductResults(true)}
                        className="pl-10 h-12 text-base"
                      />
                      {showProductResults && productSearchTerm.trim() && (
                        <div className="absolute z-50 w-full mt-2 bg-white border rounded-lg shadow-xl max-h-60 overflow-auto">
                          {loadingProducts ? (
                            <div className="p-6 text-center">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400 mb-2" />
                              <p className="text-sm text-gray-500">Loading products...</p>
                            </div>
                          ) : products.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                              No products found matching &quot;{productSearchTerm}&quot;
                            </div>
                          ) : (
                            <div className="py-2">
                              {products.map((product) => (
                                <div
                                  key={product.id}
                                  className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                  onClick={() => addToCart(product)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{product.name}</div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {formatMoney(product.selling_price)} / {product.unit}
                                      </div>
                                    </div>
                                    <Plus className="h-4 w-4 text-blue-600" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cart Card */}
            {cartItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    Quotation Items
                    <Badge variant="secondary" className="ml-2">
                      {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Review and adjust product quantities and prices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="text-center font-semibold">Quantity</TableHead>
                          <TableHead className="text-right font-semibold">Unit Price</TableHead>
                          <TableHead className="text-right font-semibold">Total</TableHead>
                          <TableHead className="text-center font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cartItems.map((item) => (
                          <TableRow key={item.product_id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartQuantity(item.product_id, Number(e.target.value))
                                }
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => {
                                  const newPrice = Number(e.target.value)
                                  setCartItems(
                                    cartItems.map((i) =>
                                      i.product_id === item.product_id
                                        ? { ...i, price: newPrice, total: i.quantity * newPrice }
                                        : i
                                    )
                                  )
                                }}
                                className="w-28 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {formatMoney(item.total)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromCart(item.product_id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-6 border-t bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex justify-end">
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-6 w-6 text-blue-600" />
                            <p className="text-3xl font-bold text-blue-600">{formatMoney(totalAmount)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Additional Notes
                </CardTitle>
                <CardDescription>
                  Add any additional information or terms for this quotation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Enter any additional notes, terms, or conditions..."
                          className="min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()}
                className="min-w-[120px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || cartItems.length === 0}
                className="min-w-[180px] bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Print Quotation
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onAdded={(newCustomer) => {
          setCustomers([...customers, newCustomer])
          form.setValue('customer_id', newCustomer.id)
          setIsAddCustomerOpen(false)
        }}
      />

      <QuotationPrint data={printData} />
    </div>
  )
}
