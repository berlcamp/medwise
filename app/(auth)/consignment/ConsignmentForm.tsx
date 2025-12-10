'use client'

import { AddModal as AddCustomerModal } from '@/app/(auth)/customers/AddModal'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Badge } from '@/components/ui/badge'
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
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formValues, setFormValues] = useState<FormType | null>(null)
  const [previousBalance, setPreviousBalance] = useState<Consignment | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )
  const user = useAppSelector((state) => state.user.user)

  const totalAmount = cartItems.reduce((acc, i) => acc + i.total, 0)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(productSearchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [productSearchTerm])

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
  }, [form, selectedBranchId])

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

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from('customers')
        .select()
        .eq('branch_id', selectedBranchId)
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)

      if (data) setCustomers(data)
    }
    fetchCustomers()
  }, [selectedBranchId])

  // Fetch products with search and debouncing
  useEffect(() => {
    const fetchProducts = async () => {
      // Don't fetch if there's no search term and results aren't showing
      if (!debouncedSearchTerm.trim() && !showProductResults) {
        setProducts([])
        return
      }

      // Only fetch if there's a search term
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

  const selectedCustomer = customers.find(
    (c: Customer) => c.id === form.watch('customer_id')
  )

  const filteredCustomers = customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedMonth = form.watch('month')
  const selectedYear = form.watch('year')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">New Consignment</h1>
        <p className="text-muted-foreground">Create a new consignment for a customer</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            setFormValues(values)
            setConfirmOpen(true)
          })}
          className="space-y-8"
        >
          {/* Section 1: Basic Information */}
          <div className="bg-card border rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Consignment Details</h2>
              <p className="text-sm text-muted-foreground">Select customer and consignment period</p>
            </div>

            <div className="space-y-4">
              {/* Customer - Full Width */}
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Customer *</FormLabel>
                    <Popover
                      open={isAddCustomerOpen}
                      onOpenChange={setIsAddCustomerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between h-11',
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

              {/* Period - Month and Year side by side */}
              <div className="space-y-2">
                <label className="text-base font-medium">Consignment Period *</label>
                <div className="grid grid-cols-2 gap-4">
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
                            <SelectTrigger className="bg-background h-11">
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
                            <SelectTrigger className="bg-background h-11">
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
              </div>
            </div>

            {/* Previous Balance Info */}
            {previousBalance && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
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
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  Checking for previous balance...
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Products */}
          <div className="bg-card border rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Products</h2>
              <p className="text-sm text-muted-foreground">Add products to this consignment</p>
            </div>

            {/* Product Selection */}
            <div>
              <FormLabel className="text-base mb-2 block">Add Products</FormLabel>
              <div className="relative" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search products to add to consignment..."
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value)
                    setShowProductResults(e.target.value.trim().length > 0)
                  }}
                  onFocus={() => setShowProductResults(productSearchTerm.trim().length > 0)}
                  className="pl-10 h-12 text-base"
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
                        const alreadyInCart = cartItems.some(
                          (item) => item.product_id === product.id
                        )
                        const isDisabled = alreadyInCart
                        
                        return (
                          <button
                            key={product.id}
                            onClick={() => {
                              if (!isDisabled) {
                                addProductToCart(product.id, 1)
                                toast.success(`${product.name} added to cart`)
                                setProductSearchTerm('')
                                setDebouncedSearchTerm('')
                                setShowProductResults(false)
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
                                ₱{product.selling_price.toFixed(2)}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {products.length === 50 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground text-center border-t">
                        Showing first 50 results. Refine your search for more specific results.
                      </div>
                    )}
                  </div>
                )}
                
                {showProductResults && !loadingProducts && products.length === 0 && productSearchTerm.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-6 z-50 text-center">
                    <p className="text-gray-500">No products found for &quot;{productSearchTerm}&quot;</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Table */}
            {cartItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b">
                  <h3 className="font-semibold">
                    Items for {getMonthName(selectedMonth)} {selectedYear}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
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
                        <TableCell className="font-medium">{formatMoney(item.total)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeCartItem(idx)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Summary */}
                <div className="bg-muted/30 px-4 py-4 border-t space-y-2">
                  {previousBalance && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Previous Balance:</span>
                      <span className="font-medium">{previousBalance.current_balance_qty} items</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>New Items:</span>
                    <span className="font-medium">
                      {cartItems.reduce((sum, item) => sum + item.quantity, 0)} items
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total Value:</span>
                    <span>{formatMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <p className="text-muted-foreground">
                  No items added yet. Select products above to add them to this consignment.
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              size="lg"
              onClick={() => router.push('/consignments')}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="lg"
              disabled={cartItems.length === 0}
            >
              Create Consignment
            </Button>
          </div>
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
