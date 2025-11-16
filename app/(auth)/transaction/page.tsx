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
import { Customer, Product, ProductStock } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAfter, parseISO } from 'date-fns'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
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

export default function CreateTransactionPage() {
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

  // ---------- SUBMIT ----------
  const onSubmit = async (data: any) => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty!')
      return
    }

    try {
      // 1️⃣ Create transaction
      const todayPrefix = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '') // e.g. "20251108"
      const transactionPrefix = todayPrefix // "20251108"

      // ✅ Fetch last transaction_number for today
      const { data: lastTransaction } = await supabase
        .from('transactions')
        .select('transaction_number')
        .like('transaction_number', `${transactionPrefix}-%`)
        .order('transaction_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextSequence = 1

      if (lastTransaction?.transaction_number) {
        const lastNum = parseInt(
          lastTransaction.transaction_number.split('-')[1],
          10
        )
        if (!isNaN(lastNum)) {
          nextSequence = lastNum + 1
        }
      }

      const newTransactionNumber = `${transactionPrefix}-${nextSequence}`

      // ✅ Insert new transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert([
          {
            org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
            customer_name:
              customers.find((c) => c.id === data.customer_id)?.name || '',
            customer_id: data.customer_id,
            transaction_number: newTransactionNumber,
            payment_type: data.payment_type,
            total_amount: totalAmount,
            gl_number: data.gl_number,
            branch_id: selectedBranchId
          }
        ])
        .select()
        .single()

      if (transactionError || !transactionData) throw transactionError

      const transactionId = transactionData.id

      // 2️⃣ Insert transaction items
      const transactionItems = cartItems.map((item) => ({
        ...item,
        transaction_id: transactionId
      }))

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems)

      if (itemsError) throw itemsError

      // 3️⃣ Insert product stocks for products
      const productStocks = cartItems.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        type: 'out',
        inventory_type: 'transaction',
        transaction_date: new Date(),
        branch_id: selectedBranchId,
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
        transaction_id: transactionId
      }))

      if (productStocks.length > 0) {
        const { error: stockError } = await supabase
          .from('product_stocks')
          .insert(productStocks)
        if (stockError) throw stockError
      }

      toast.success('Transaction completed successfully!')
      setCartItems([])
      form.reset()
    } catch (err) {
      toast.error(`Transaction failed: ${err}`)
      console.error(err)
    }
  }

  const addProductToCart = (productId: number, qty = 1) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setCartItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        unit: product.unit ?? '',
        quantity: qty ?? 1, // ✅ default value here
        price: product.selling_price,
        total: product.selling_price * (qty ?? 1)
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
            '*,product_stocks:product_stocks(quantity,type,expiration_date)'
          )
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      ])

      if (c.data) setCustomers(c.data)
      if (p.data) {
        const formatted = p.data.map((p) => ({
          ...p,
          stock_qty:
            p.product_stocks?.reduce((acc: number, s: ProductStock) => {
              const isNotExpired =
                !s.expiration_date ||
                isAfter(parseISO(s.expiration_date), new Date())
              if (!isNotExpired) return acc

              return s.type === 'in' ? acc + s.quantity : acc - s.quantity
            }, 0) || 0
        }))

        setProducts(formatted.filter((p) => p.stock_qty > 0))
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">New Transaction</h1>

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
                                size="sm"
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
                                size="sm"
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
                  <FormLabel>Product Purhcased</FormLabel>
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
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      p.id === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  />
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
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItemQuantity(idx, Number(e.target.value))
                          }
                          className="w-20"
                        />
                      </div>
                    </TableCell>
                    <TableCell>{formatMoney(item.price)}</TableCell>
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

          {/* CATEGORY DROPDOWN */}
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
                      <SelectValue placeholder="Select category" />
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
          <Button type="submit" className="mt-4" size="lg">
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
