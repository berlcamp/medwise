'use client'
import { AddModal as AddCustomerModal } from '@/app/(auth)/customers/AddModal'
import { ConfirmationModal } from '@/components/ConfirmationModal'
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
  /* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  createTransactionWithStockDeduction,
  validateCartItems
} from '@/lib/utils/transaction'
import { Customer, Product, ProductStock } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAfter, parseISO, startOfToday } from 'date-fns'
import { 
  Check, 
  ChevronsUpDown, 
  Plus, 
  Search, 
  ShoppingCart, 
  Trash2,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Minus
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

// ---------- ZOD SCHEMA ----------
const FormSchema = z.object({
  customer_id: z.coerce
    .number({ invalid_type_error: 'Customer required' })
    .min(1, 'Customer required'), // ✅ coercion fixes string->number
  attendants: z.array(z.string()).optional(),

  // Product selection
  product_id: z.coerce.number().optional(), // optional because user may not add products
  product_qty: z.coerce
    .number()
    .min(1, 'Quantity must be at least 1')
    .optional(),
  payment_type: z.string().min(1, 'Payment Type is required'),
  gl_number: z.string().optional(),

  // Service selection
  service_id: z.coerce.number().optional() // optional because user may not add services
})

type FormType = z.infer<typeof FormSchema>

type TransactionType = 'bulk' | 'retail' | 'consignment'

interface TransactionFormProps {
  transactionType: TransactionType
}

export default function TransactionForm({ transactionType }: TransactionFormProps) {
  const router = useRouter()
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      gl_number: ''
    }
  })

  const [cartItems, setCartItems] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formValues, setFormValues] = useState<any>(null)

  const filteredProducts = productSearchTerm.trim() 
    ? products.filter((p) =>
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
      )
    : []

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const totalAmount = cartItems.reduce((acc, i) => acc + i.total, 0)

  // Get configuration based on transaction type
  const getConfig = () => {
    switch (transactionType) {
      case 'bulk':
        return {
          title: 'New Transaction [Bulk]',
          paymentStatus: 'Unpaid',
          redirectUrl: '/bulktransactions',
          successMessage: 'Transaction completed successfully!',
          allowPriceEdit: false
        }
      case 'retail':
        return {
          title: 'New Transaction [Retail]',
          paymentStatus: 'Paid',
          redirectUrl: '/transactions',
          successMessage: 'Transaction completed successfully!',
          allowPriceEdit: false
        }
      case 'consignment':
        return {
          title: 'New Consignment',
          paymentStatus: 'Pending',
          redirectUrl: '/consignments',
          successMessage: 'Consignment created successfully!',
          allowPriceEdit: true
        }
      default:
        return {
          title: 'New Transaction',
          paymentStatus: 'Paid',
          redirectUrl: '/transactions',
          successMessage: 'Transaction completed successfully!',
          allowPriceEdit: false
        }
    }
  }

  const config = getConfig()

  // ---------- SUBMIT ----------
  const onSubmit = async (data: any) => {
    
    // ✅ Validate cart items
    const validation = validateCartItems(cartItems)
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid cart items')
      return
    }

    try {
      // 🔒 Call atomic database function to prevent race conditions
      const result = await createTransactionWithStockDeduction({
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
        customer_id: data.customer_id,
        customer_name:
          customers.find((c) => c.id === data.customer_id)?.name || '',
        transaction_type: transactionType,
        payment_type: data.payment_type || 'Cash',
        payment_status: config.paymentStatus,
        total_amount: totalAmount,
        gl_number: data.gl_number,
        branch_id: selectedBranchId!,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit
        }))
      })

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed')
      }

      toast.success(result.message || config.successMessage)
      setCartItems([])
      form.reset()

      setTimeout(() => {
        router.push(config.redirectUrl)
      }, 100) // 100ms delay ensures toast shows before redirect
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Transaction failed')
    }
  }

  const addProductToCart = (productId: number, qty = 1) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    
    // Calculate price based on payment type
    const paymentType = form.watch('payment_type')
    const basePrice = product.selling_price
    const glPercent = product.gl_percent || 0
    const price = paymentType === 'GL' ? basePrice * (1 + glPercent / 100) : basePrice
    
    setCartItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        unit: product.unit ?? '',
        quantity: qty ?? 1, // ✅ default value here
        price: price,
        total: price * (qty ?? 1)
      }
    ])
  }

  const updateCartItemQuantity = (idx: number, qty: number) => {
    setCartItems((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          const product = products.find((p) => p.id === item.product_id)
          const maxStock = product?.stock_qty || 0
          const validQty = Math.min(Math.max(1, qty), maxStock)
          
          if (qty > maxStock) {
            toast.error(`Only ${maxStock} units available in stock`)
          }
          
          return { ...item, quantity: validQty, total: item.price * validQty }
        }
        return item
      })
    )
  }

  const updateCartItemPrice = (idx: number, price: number) => {
    setCartItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, price, total: price * item.quantity } : item
      )
    )
  }

  const removeCartItem = (idx: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // ---------- LOAD DROPDOWNS ----------
  useEffect(() => {
    const fetchData = async () => {
      const [c, p] = await Promise.all([
        supabase
          .from('customers')
          .select()
          .eq('branch_id', selectedBranchId)
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID),
        supabase
          .from('products')
          .select(
            '*,product_stocks:product_stocks(remaining_quantity,type,expiration_date,branch_id)'
          )
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      ])

      if (c.data) setCustomers(c.data)

      if (p.data) {
        const today = startOfToday()

        const formatted = p.data.map((product) => {
          const stock_qty =
            product.product_stocks
              ?.filter((s: ProductStock) => s.branch_id === selectedBranchId)
              .reduce((acc: number, s: ProductStock) => {
                // Parse expiration
                const exp = s.expiration_date ? parseISO(s.expiration_date) : null

                // Valid if no expiration OR expiration is after today
                const isNotExpired = !exp || isAfter(exp, today)
                if (!isNotExpired) return acc

                // Add or subtract quantity depending on type
                return s.type === 'in'
                  ? acc + s.remaining_quantity
                  : acc - s.remaining_quantity
              }, 0) ?? 0

          return {
            ...product,
            stock_qty
          }
        })

        // Include all products (even with zero stock)
        setProducts(formatted)
      }
    }
    fetchData()
  }, [selectedBranchId])

  const selectedCustomer = customers.find(
    (c: Customer) => c.id === form.watch('customer_id')
  )

  const filteredCustomers = customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // ✅ Recalculate cart prices when payment type changes (only if not consignment)
  const paymentType = form.watch('payment_type')
  
  useEffect(() => {
    if (config.allowPriceEdit) return // Skip for consignment as prices are manually set
    if (!paymentType) return
    
    setCartItems((prev) =>
      prev.map((item) => {
        const product = products.find((p) => p.id === item.product_id)
        if (!product) return item
        
        const basePrice = product.selling_price
        const glPercent = product.gl_percent || 0
        const newPrice = paymentType === 'GL' ? basePrice * (1 + glPercent / 100) : basePrice
        
        return {
          ...item,
          price: newPrice,
          total: newPrice * item.quantity
        }
      })
    )
  }, [paymentType, products, config.allowPriceEdit])

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

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{config.title}</h1>
            <p className="text-blue-100 text-sm mt-1">
              Point of Sale System
            </p>
          </div>
          
          {/* Customer Selection - Top Bar */}
          <Form {...form}>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <Popover
                  open={isAddCustomerOpen}
                  onOpenChange={setIsAddCustomerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="min-w-[280px] justify-between text-base font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {selectedCustomer ? (
                          <span>{selectedCustomer.name}</span>
                        ) : (
                          <span className="text-muted-foreground">Select Customer</span>
                        )}
                      </div>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[320px] p-0" align="end">
                    <Command filter={() => 1}>
                      <CommandInput
                        placeholder="Search customer..."
                        onValueChange={(value) => setSearchTerm(value)}
                      />
                      {filteredCustomers.length === 0 ? (
                        <CommandEmpty>
                          <div className="flex flex-col items-center justify-center gap-3 py-6">
                            <User className="h-12 w-12 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">No customer found</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAddCustomerOpen(true)
                                setIsAddCustomerOpen(false)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add New Customer
                            </Button>
                          </div>
                        </CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {filteredCustomers.map((c: Customer) => (
                            <CommandItem
                              key={c.id}
                              value={c.id.toString()}
                              onSelect={() => {
                                form.setValue('customer_id', Number(c.id))
                                setIsAddCustomerOpen(false)
                              }}
                              className="py-3"
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  c.id.toString() === field.value?.toString()
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {c.name}
                            </CommandItem>
                          ))}
                          <div className="border-t p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                setAddCustomerOpen(true)
                                setIsAddCustomerOpen(false)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add New Customer
                            </Button>
                          </div>
                        </CommandGroup>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />
          </Form>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDE - Cart Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Search Bar */}
          <div className="p-4 bg-white border-b">
            <div className="relative" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search products to add to cart..."
                value={productSearchTerm}
                onChange={(e) => {
                  setProductSearchTerm(e.target.value)
                  setShowProductResults(e.target.value.trim().length > 0)
                }}
                onFocus={() => setShowProductResults(productSearchTerm.trim().length > 0)}
                className="pl-10 h-12 text-base"
              />
              
              {/* Product Search Results Dropdown */}
              {showProductResults && filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
                  <div className="p-2">
                    {filteredProducts.map((product) => {
                      const alreadyInCart = cartItems.some(
                        (item) => item.product_id === product.id
                      )
                      const isOutOfStock = (product.stock_qty || 0) <= 0
                      const isDisabled = alreadyInCart || isOutOfStock
                      
                      return (
                        <button
                          key={product.id}
                          onClick={() => {
                            if (!isDisabled) {
                              addProductToCart(product.id, 1)
                              toast.success(`${product.name} added to cart`)
                              setProductSearchTerm('')
                              setShowProductResults(false)
                            } else if (isOutOfStock) {
                              toast.error(`${product.name} is out of stock`)
                            }
                          }}
                          disabled={isDisabled}
                          className={cn(
                            'w-full text-left p-3 rounded-md mb-1 transition-colors flex items-center justify-between',
                            isDisabled
                              ? 'bg-gray-50 border border-gray-200 cursor-not-allowed opacity-70'
                              : 'hover:bg-blue-50 border border-transparent hover:border-blue-200 cursor-pointer'
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">
                                {product.name}
                              </h3>
                              {alreadyInCart && (
                                <Badge variant="secondary" className="text-xs">
                                  In Cart
                                </Badge>
                              )}
                              {isOutOfStock && !alreadyInCart && (
                                <Badge variant="destructive" className="text-xs">
                                  Out of Stock
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">{product.category}</span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-gray-500">{product.unit}</span>
                              <span className="text-xs text-gray-500">•</span>
                              <Badge 
                                variant={isOutOfStock ? "destructive" : "outline"} 
                                className="text-xs"
                              >
                                Stock: {product.stock_qty || 0}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-base font-bold text-blue-600">
                              ₱{product.selling_price.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {showProductResults && filteredProducts.length === 0 && productSearchTerm.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-6 z-50 text-center">
                  <p className="text-gray-500">No products found for &quot;{productSearchTerm}&quot;</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto p-4 overflow-x-hidden">
            <div className="bg-white rounded-lg border shadow-sm">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ShoppingCart className="h-20 w-20 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Cart is Empty</h3>
                  <p className="text-sm text-gray-400">
                    Search and add products using the search bar above
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Product</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item, idx) => {
                      const product = products.find((p) => p.id === item.product_id)
                      return (
                        <TableRow key={idx}>
                          <TableCell className="max-w-0">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate" title={product?.name}>{product?.name}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-gray-500">{product?.category}</span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500">{product?.unit}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartItemQuantity(idx, item.quantity - 1)
                                }
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={product?.stock_qty}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartItemQuantity(idx, Number(e.target.value))
                                }
                                className="w-20 h-8 text-center text-sm font-medium"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartItemQuantity(idx, item.quantity + 1)
                                }
                                className="h-8 w-8 p-0"
                                disabled={item.quantity >= (product?.stock_qty || 0)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                updateCartItemPrice(idx, Number(e.target.value))
                              }
                              className="w-28 h-8 text-right text-sm font-semibold ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-base font-bold text-blue-600">
                              ₱{item.total.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeCartItem(idx)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Checkout Panel */}
        <div className="w-[400px] bg-white border-l shadow-xl flex flex-col overflow-hidden">
          {/* Checkout Header */}
          <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-lg">Checkout</h2>
              </div>
              <Badge variant="secondary" className="text-sm">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
          </div>

          {/* Payment & Checkout Form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                setFormValues(values)
                setConfirmOpen(true)
              })}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="p-4 space-y-4 flex-shrink-0">
                {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="payment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-gray-700">
                        Payment Method
                      </FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {[
                          { value: 'Cash', icon: Banknote, label: 'Cash' },
                          { value: 'Credit Card', icon: CreditCard, label: 'Card' },
                          { value: 'GCash', icon: Smartphone, label: 'GCash' },
                          { value: 'Maya', icon: Smartphone, label: 'Maya' },
                          { value: 'GL', icon: CreditCard, label: 'GL' }
                        ].map((method) => {
                          const Icon = method.icon
                          return (
                            <Button
                              key={method.value}
                              type="button"
                              variant={field.value === method.value ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => field.onChange(method.value)}
                              className={cn(
                                'h-14 flex flex-col items-center justify-center gap-1',
                                field.value === method.value &&
                                  'bg-blue-600 hover:bg-blue-700'
                              )}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-xs font-medium">{method.label}</span>
                            </Button>
                          )
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* GL Number */}
                {form.watch('payment_type') === 'GL' && (
                  <FormField
                    control={form.control}
                    name="gl_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">
                          GL Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter GL Number"
                            className="h-11 mt-2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Total & Checkout Button - Fixed at Bottom */}
              <div className="border-t bg-slate-50 p-4 space-y-3 flex-shrink-0">
                {/* Total Amount */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-blue-100 mb-1">Total Amount</p>
                      <p className="text-3xl font-bold">
                        ₱{totalAmount.toFixed(2)}
                      </p>
                    </div>
                    <ShoppingCart className="h-10 w-10 opacity-20" />
                  </div>
                </div>

                {/* Complete Transaction Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg"
                  disabled={cartItems.length === 0 || !form.watch('customer_id')}
                >
                  Complete Transaction
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Modals */}
      <AddCustomerModal
        isOpen={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        editData={null}
        onAdded={(data) => {
          const newCustomer = { ...data, id: Number(data.id) }
          setCustomers((prev) => [newCustomer, ...prev])
          form.setValue('customer_id', newCustomer.id)
        }}
      />

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => formValues && onSubmit(formValues)}
        message="Are you sure you want to complete this transaction?"
      />
    </div>
  )
}

