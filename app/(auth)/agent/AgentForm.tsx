'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { cn, formatMoney } from '@/lib/utils'
import { createAgentAssignment } from '@/lib/utils/agent'
import { Agent, Product } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, DollarSign, Loader2, Package, Plus, Search, ShoppingCart, Trash2, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

const FormSchema = z.object({
  agent_id: z.coerce
    .number({ invalid_type_error: 'Agent required' })
    .min(1, 'Agent required'),
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
  stock_qty: number
}

export default function AgentForm() {
  const router = useRouter()
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema)
  })

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  // Load agents
  useEffect(() => {
    if (!selectedBranchId) return
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (data) setAgents(data)
    }
    fetchAgents()
  }, [selectedBranchId])

  // Load products
  useEffect(() => {
    if (!selectedBranchId || !debouncedSearchTerm.trim()) {
      setProducts([])
      return
    }

    setLoadingProducts(true)
    const fetchProducts = async () => {
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .ilike('name', `%${debouncedSearchTerm}%`)
        .limit(20)

      if (productsData) {
        // Get stock quantities for each product
        const productsWithStock = await Promise.all(
          productsData.map(async (product) => {
            const { data: stocks } = await supabase
              .from('product_stocks')
              .select('remaining_quantity')
              .eq('product_id', product.id)
              .eq('branch_id', selectedBranchId)
              .gt('remaining_quantity', 0)

            const stockQty = stocks?.reduce((sum, s) => sum + s.remaining_quantity, 0) || 0

            return { ...product, stock_qty: stockQty }
          })
        )

        setProducts(productsWithStock)
      }
      setLoadingProducts(false)
    }

    fetchProducts()
  }, [debouncedSearchTerm, selectedBranchId])

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

  const addToCart = (product: Product & { stock_qty?: number }) => {
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
          total: product.selling_price,
          stock_qty: product.stock_qty || 0
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
    const item = cartItems.find((i) => i.product_id === productId)
    if (item && quantity > item.stock_qty) {
      toast.error(`Quantity exceeds available stock (${item.stock_qty})`)
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
      const result = await createAgentAssignment({
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
        branch_id: selectedBranchId,
        agent_id: data.agent_id,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        created_by: user?.name || 'System'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create assignment')
      }

      toast.success('Agent assignment created successfully!')
      router.push('/agents')
    } catch (err: unknown) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create assignment'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredAgents = searchTerm.trim()
    ? agents.filter((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : agents

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <User className="h-8 w-8 text-blue-600" />
            New Agent Assignment
          </h1>
          <p className="text-gray-600 mt-2">Assign products to an agent for delivery</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Agent Selection Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Select Agent
                </CardTitle>
                <CardDescription>
                  Choose the agent who will handle this assignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base font-medium">Agent</FormLabel>
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
                                  ? agents.find((a) => a.id === field.value)?.name
                                  : 'Select agent...'}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search agent..."
                              value={searchTerm}
                              onValueChange={setSearchTerm}
                            />
                            <CommandEmpty>No agent found.</CommandEmpty>
                            <CommandGroup>
                              {filteredAgents.map((agent) => (
                                <CommandItem
                                  value={agent.name}
                                  key={agent.id}
                                  onSelect={() => {
                                    form.setValue('agent_id', agent.id)
                                    setSearchTerm('')
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === agent.id
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{agent.name}</span>
                                    {agent.area && (
                                      <span className="text-xs text-gray-500">{agent.area}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  Search and add products to assign to the agent
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
                                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                        <span>{formatMoney(product.selling_price)} / {product.unit}</span>
                                        <Badge variant={product.stock_qty && product.stock_qty > 0 ? "default" : "secondary"}>
                                          Stock: {product.stock_qty || 0}
                                        </Badge>
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
                    Assigned Products
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
                          <TableHead className="text-center font-semibold">Stock</TableHead>
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
                              <Badge variant={item.stock_qty > 0 ? "default" : "destructive"}>
                                {item.stock_qty}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="1"
                                max={item.stock_qty}
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
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Create Assignment
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
