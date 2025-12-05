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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { cn, formatMoney } from '@/lib/utils'
import {
  createTransactionWithStockDeduction,
  validateCartItems
} from '@/lib/utils/transaction'
import { Customer, Product, ProductStock } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAfter, parseISO, startOfToday } from 'date-fns'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

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

  const [isProductOpen, setIsProductOpen] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formValues, setFormValues] = useState<any>(null)

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  )

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
          paymentStatus: 'Paid',
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
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: qty, total: item.price * qty } : item
      )
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
            '*,product_stocks:product_stocks(remaining_quantity,type,expiration_date)'
          )
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      ])

      if (c.data) setCustomers(c.data)

      if (p.data) {
        const today = startOfToday()

        const formatted = p.data.map((product) => {
          const stock_qty =
            product.product_stocks?.reduce((acc: number, s: ProductStock) => {
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

        // Only include products with a positive stock quantity
        setProducts(formatted.filter((item) => item.stock_qty > 0))
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
  useEffect(() => {
    if (config.allowPriceEdit) return // Skip for consignment as prices are manually set
    
    const paymentType = form.watch('payment_type')
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
  }, [form.watch('payment_type'), products, config.allowPriceEdit])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{config.title}</h1>

      {/* Disabled Notice */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 font-semibold">
              Transaction Form Currently Disabled
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              This form is temporarily unavailable while inventory adjustments are being processed. Please check back shortly.
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            setFormValues(values)
            setConfirmOpen(true)
          })}
        >
          {/* ---------- Customer ---------- */}
          <div>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Customer</FormLabel>
                  <Popover
                    open={isAddCustomerOpen}
                    onOpenChange={setIsAddCustomerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={true}
                        className={cn(
                          'w-full justify-between',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {selectedCustomer
                          ? selectedCustomer.name
                          : 'Select customer'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0">
                      <Command filter={() => 1}>
                        <CommandInput
                          placeholder="Search customer..."
                          onValueChange={(value) => setSearchTerm(value)}
                        />
                        {filteredCustomers.length === 0 ? (
                          <CommandEmpty>
                            <div className="flex flex-col items-center justify-center gap-2 py-3">
                              <span>No customer found.</span>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  setAddCustomerOpen(true)
                                  setIsAddCustomerOpen(false)
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" /> Add new
                                customer
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
                                  setIsAddCustomerOpen(false) // ✅ hide dropdown on select
                                }}
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
                            <div className="border-t mt-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                className="w-full justify-start mt-1"
                                onClick={() => {
                                  setAddCustomerOpen(true)
                                  setIsAddCustomerOpen(false)
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" /> Add new
                                customer
                              </Button>
                            </div>
                          </CommandGroup>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ---------- Product Field ---------- */}
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Product Purchased</FormLabel>
                  <Popover open={isProductOpen} onOpenChange={setIsProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'w-full justify-between',
                          !field.value && 'text-muted-foreground'
                        )}
                        type="button"
                      >
                        Select product
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search product..."
                          onValueChange={(v) => setProductSearchTerm(v)}
                        />
                        {filteredProducts.length === 0 ? (
                          <CommandEmpty>No products found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {filteredProducts.map((p) => {
                              const alreadyInCart = cartItems.some(
                                (item) => item.product_id === p.id
                              )
                              return (
                                <CommandItem
                                  key={p.id}
                                  value={p.id.toString()}
                                  disabled={alreadyInCart} // ✅ disable if in cart
                                  onSelect={() => {
                                    if (alreadyInCart) return // prevent selection
                                    field.onChange(p.id)
                                    addProductToCart(p.id, 1)
                                    setIsProductOpen(false)
                                  }}
                                  className={cn(
                                    alreadyInCart &&
                                      'opacity-50 cursor-not-allowed' // visual cue
                                  )}
                                >
                                  <div className="flex flex-col">
                                    <span
                                      className={cn(
                                        alreadyInCart &&
                                          'opacity-50 line-through'
                                      )}
                                    >
                                      {p.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.category} • ₱{p.selling_price} • Stock:{' '}
                                      {p.stock_qty}
                                    </span>
                                  </div>
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* ---------- Cart Table ---------- */}
          <div className="my-8 border border-gray-600 p-2 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="space-x-2">
                        <span>
                          {products.find((p) => p.id === item.product_id)?.name}
                        </span>
                        <span>
                          (
                          {products.find((p) => p.id === item.product_id)?.unit}
                        </span>
                        )
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={
                            products.find((p) => p.id === item.product_id)
                              ?.stock_qty
                          }
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItemQuantity(idx, Number(e.target.value))
                          }
                          className="w-20"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.allowPriceEdit ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              updateCartItemPrice(idx, Number(e.target.value))
                            }
                            className="w-24"
                          />
                        </div>
                      ) : (
                        formatMoney(item.price)
                      )}
                    </TableCell>
                    <TableCell>{formatMoney(item.total)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => removeCartItem(idx)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="text-right mt-2 font-bold">
              Total: {formatMoney(totalAmount)}
            </div>
          </div>

          {/* PAYMENT TYPE DROPDOWN */}
          <FormField
            control={form.control}
            name="payment_type"
            render={({ field }) => (
              <FormItem className="my-4 w-full">
                <FormLabel className="app__formlabel_standard">
                  Payment Method
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl className="bg-white">
                    <SelectTrigger className="app__input_standard">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="GCash">GCash</SelectItem>
                    <SelectItem value="Maya">Maya</SelectItem>
                    <SelectItem value="GL">GL</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Conditional GL Number Input */}
          {form.watch('payment_type') === 'GL' && (
            <FormField
              control={form.control}
              name="gl_number"
              render={({ field }) => (
                <FormItem className="my-4 w-full">
                  <FormLabel className="app__formlabel_standard">
                    GL Number
                  </FormLabel>
                  <FormControl className="bg-white">
                    <Input {...field} placeholder="Enter GL Number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* ---------- Submit ---------- */}
          <Button type="submit" className="mt-4" size="lg" disabled={true}>
            Complete Transaction
          </Button>
        </form>
      </Form>

      {/* ---------- Add Customer Modal ---------- */}
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

