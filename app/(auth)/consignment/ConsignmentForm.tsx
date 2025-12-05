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
  createConsignment,
  getCurrentMonthYear,
  getMonthName
} from '@/lib/utils/consignment'
import { Consignment, Customer, Product, ProductStock } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAfter, parseISO, startOfToday } from 'date-fns'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

const FormSchema = z.object({
  customer_id: z.coerce
    .number({ invalid_type_error: 'Customer required' })
    .min(1, 'Customer required'),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020),
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

export default function ConsignmentForm() {
  const router = useRouter()
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear()

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      month: currentMonth,
      year: currentYear
    }
  })

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isProductOpen, setIsProductOpen] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formValues, setFormValues] = useState<FormType | null>(null)
  const [previousBalance, setPreviousBalance] = useState<Consignment | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )
  const user = useAppSelector((state) => state.user.user)

  const totalAmount = cartItems.reduce((acc, i) => acc + i.total, 0)

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  )

  // Load previous month's balance when customer and period change
  useEffect(() => {
    const loadPreviousBalance = async () => {
      const customerId = form.watch('customer_id')
      const month = form.watch('month')
      const year = form.watch('year')

      if (!customerId || !month || !year) return

      setLoadingBalance(true)

      // Calculate previous month
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year

      try {
        const { data, error } = await supabase
          .from('consignments')
          .select(
            `
            *,
            consignment_items (
              *,
              product:products (id, name, selling_price, unit)
            )
          `
          )
          .eq('customer_id', customerId)
          .eq('branch_id', selectedBranchId)
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .eq('status', 'active')
          .single()

        if (!error && data) {
          setPreviousBalance(data)
        } else {
          setPreviousBalance(null)
        }
      } catch (err) {
        console.error('Error loading previous balance:', err)
        setPreviousBalance(null)
      }

      setLoadingBalance(false)
    }

    loadPreviousBalance()
  }, [
    form.watch('customer_id'),
    form.watch('month'),
    form.watch('year'),
    selectedBranchId
  ])

  const onSubmit = async (data: FormType) => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one product to the consignment')
      return
    }

    try {
      const customer = customers.find((c) => c.id === data.customer_id)

      const result = await createConsignment({
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
        branch_id: selectedBranchId!,
        customer_id: data.customer_id,
        customer_name: customer?.name || '',
        month: data.month,
        year: data.year,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create consignment')
      }

      toast.success(result.message || 'Consignment created successfully!')
      setCartItems([])
      form.reset()

      setTimeout(() => {
        router.push('/consignments')
      }, 100)
    } catch (err) {
      const error = err as Error
      console.error(error)
      toast.error(error.message || 'Failed to create consignment')
    }
  }

  const addProductToCart = (productId: number, qty = 1) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    setCartItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        unit: product.unit ?? '',
        quantity: qty ?? 1,
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

  const selectedMonth = form.watch('month')
  const selectedYear = form.watch('year')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">New Consignment</h1>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            setFormValues(values)
            setConfirmOpen(true)
          })}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Customer */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
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
                                  setIsAddCustomerOpen(false)
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

            {/* Month */}
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Month</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {getMonthName(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Year */}
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map(
                        (y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Previous Balance Info */}
          {previousBalance && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Previous Month Balance
              </h3>
              <p className="text-sm text-blue-800">
                {previousBalance.current_balance_qty} items remaining from{' '}
                {getMonthName(previousBalance.month)} {previousBalance.year}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                These items will be automatically included in the new
                consignment.
              </p>
            </div>
          )}

          {loadingBalance && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">
                Checking for previous balance...
              </p>
            </div>
          )}

          {/* Product Selection */}
          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Add Products to Consignment</FormLabel>
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
                      Select product to add
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
                                disabled={alreadyInCart}
                                onSelect={() => {
                                  if (alreadyInCart) return
                                  field.onChange(p.id)
                                  addProductToCart(p.id, 1)
                                  setIsProductOpen(false)
                                }}
                                className={cn(
                                  alreadyInCart &&
                                    'opacity-50 cursor-not-allowed'
                                )}
                              >
                                <div className="flex flex-col">
                                  <span
                                    className={cn(
                                      alreadyInCart && 'opacity-50 line-through'
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

          {/* Cart Table */}
          <div className="my-8 border border-gray-300 rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">
              New Items for {getMonthName(selectedMonth)} {selectedYear}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No items added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  cartItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>

            <div className="text-right mt-4 space-y-1">
              {previousBalance && (
                <div className="text-sm text-gray-600">
                  Previous Balance: {previousBalance.current_balance_qty} items
                </div>
              )}
              <div className="text-sm text-gray-600">
                New Items: {cartItems.reduce((sum, item) => sum + item.quantity, 0)} items
              </div>
              <div className="font-bold text-lg">
                Total Value: {formatMoney(totalAmount)}
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" className="mt-4" size="lg">
            Create Consignment
          </Button>
        </form>
      </Form>

      {/* Add Customer Modal */}
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
        onConfirm={async () => {
          if (formValues) {
            await onSubmit(formValues)
          }
        }}
        message="Are you sure you want to create this consignment?"
      />
    </div>
  )
}
