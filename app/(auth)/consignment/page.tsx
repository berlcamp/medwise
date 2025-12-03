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

export default function CreateTransactionPage() {
  //
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

  // ---------- SUBMIT ----------
  const onSubmit = async (data: any) => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty!')
      return
    }

    try {
      // 1️⃣ Create transaction number
      const todayPrefix = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')
      const { data: lastTransaction } = await supabase
        .from('transactions')
        .select('transaction_number')
        .like('transaction_number', `${todayPrefix}-%`)
        .order('transaction_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextSequence = lastTransaction?.transaction_number
        ? parseInt(lastTransaction.transaction_number.split('-')[1], 10) + 1
        : 1

      const transactionNumber = `${todayPrefix}-${nextSequence}`

      // 2️⃣ Insert transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert([
          {
            org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
            customer_name:
              customers.find((c) => c.id === data.customer_id)?.name || '',
            customer_id: data.customer_id,
            transaction_number: transactionNumber,
            transaction_type: 'consignment',
            payment_type: data.payment_type,
            payment_status: 'Pending',
            total_amount: totalAmount,
            gl_number: data.gl_number,
            branch_id: selectedBranchId
          }
        ])
        .select()
        .single()
      if (transactionError || !transactionData) throw transactionError

      const transactionId = transactionData.id

      // 3️⃣ Deduct stock FIFO and create transaction_items
      for (const item of cartItems) {
        let qtyToDeduct = item.quantity

        // Fetch available stock for this product, oldest first
        const { data: availableStocks } = await supabase
          .from('product_stocks')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('branch_id', selectedBranchId)
          .gt('remaining_quantity', 0)
          .order('date_manufactured', { ascending: true }) // FIFO

        if (!availableStocks || availableStocks.length === 0) {
          throw new Error(`No stock available for ${item.name}`)
        }

        for (const stock of availableStocks) {
          if (qtyToDeduct <= 0) break

          const remaining = stock.remaining_quantity
          const deductQty = Math.min(remaining, qtyToDeduct)

          // Insert transaction_items with batch info
          const { error: itemError } = await supabase
            .from('transaction_items')
            .insert({
              transaction_id: transactionId,
              product_id: item.product_id,
              batch_no: stock.batch_no,
              product_stock_id: stock.id, // <-- optional, recommended
              date_manufactured: stock.date_manufactured,
              expiration_date: stock.expiration_date,
              quantity: deductQty,
              price: item.price,
              total: deductQty * item.price
            })
          if (itemError) throw itemError

          // Update remaining_quantity in product_stocks
          const { error: stockError } = await supabase
            .from('product_stocks')
            .update({
              remaining_quantity: remaining - deductQty,
              consigned_quantity: deductQty
            })
            .eq('id', stock.id)
          if (stockError) throw stockError

          qtyToDeduct -= deductQty
        }

        if (qtyToDeduct > 0) {
          throw new Error(`Not enough stock for product ${item.name}`)
        }
      }

      toast.success('Transaction completed successfully!')
      setCartItems([])
      form.reset()

      setTimeout(() => {
        router.push('/consignments')
      }, 100) // 100ms delay ensures toast shows before redirect
    } catch (err) {
      console.error(err)
      toast.error(`Transaction failed: ${err}`)
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">New Consignment</h1>

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
                                  {/* <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      p.id === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  /> */}
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
                          max={
                            products.find((p) => p.id === item.product_id)
                              ?.stock_qty
                          }
                          onChange={(e) =>
                            updateCartItemQuantity(idx, Number(e.target.value))
                          }
                          className="w-20"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.price}
                          onChange={(e) =>
                            updateCartItemPrice(idx, Number(e.target.value))
                          }
                          className="w-20"
                        />
                      </div>
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
