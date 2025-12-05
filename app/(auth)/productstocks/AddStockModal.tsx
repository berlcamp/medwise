'use client'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
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
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { cn, formatMoney } from '@/lib/utils'
import { Product, Supplier } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

const table = 'product_stocks'

const FormSchema = z.object({
  product_id: z.coerce.number().min(1, 'Product required'),
  supplier_id: z.coerce.number().min(1, 'Supplier required'),
  quantity: z.coerce.number().min(1, 'Quantity required'),
  purchase_price: z.coerce.number().min(0, 'Purchase price required'),
  batch_no: z.string().min(1, 'Batch number required'),
  manufacturer: z.string().optional(),
  date_manufactured: z.string().min(1, 'Date manufactured required'),
  transaction_date: z.string().min(1, 'Date received required'),
  expiration_date: z.string().min(1, 'Expiration date required')
})

type FormType = z.infer<typeof FormSchema>

export const AddStockModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)

  const dispatch = useAppDispatch()
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      product_id: 0,
      supplier_id: 0,
      quantity: 1,
      purchase_price: 0,
      batch_no: '',
      manufacturer: '',
      date_manufactured: '',
      transaction_date: '',
      expiration_date: ''
    }
  })

  // Load products and suppliers
  useEffect(() => {
    if (!isOpen) return

    const fetchData = async () => {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select()
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .order('name', { ascending: true })

      if (prodError) toast.error('Failed to load products.')
      else setProducts(prodData || [])

      const { data: supData, error: supError } = await supabase
        .from('suppliers')
        .select()
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .order('name', { ascending: true })

      if (supError) toast.error('Failed to load suppliers.')
      else setSuppliers(supData || [])
    }

    fetchData()
    form.reset({
      product_id: 0,
      supplier_id: 0,
      quantity: 1,
      purchase_price: 0,
      batch_no: '',
      manufacturer: '',
      date_manufactured: '',
      transaction_date: '',
      expiration_date: ''
    })
  }, [form, isOpen])

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const newStock = {
        ...data,
        remaining_quantity: data.quantity,
        type: 'in',
        inventory_type: 'stock',
        branch_id: selectedBranchId,
        org_id: process.env.NEXT_PUBLIC_ORG_ID,
        transaction_date: data.transaction_date || null,
        expiration_date: data.expiration_date || null,
        date_manufactured: data.date_manufactured || null
      }

      const { data: inserted, error } = await supabase
        .from(table)
        .insert([newStock])
        .select()

      if (error) throw new Error(error.message)

      const product = products.find((p) => p.id === newStock.product_id)
      const supplier = suppliers.find((s) => s.id === newStock.supplier_id)

      dispatch(
        addItem({
          ...inserted[0],
          product,
          supplier
        })
      )

      toast.success('Stock added successfully!')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to add stock.')
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <Dialog open={isOpen} as="div" className="relative z-50" onClose={() => {}}>
      <div
        className="fixed inset-0 bg-gray-600 opacity-80"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="app__modal_dialog_panel_sm">
          <div className="app__modal_dialog_title_container">
            <DialogTitle as="h3" className="text-base font-medium">
              Add Stock
            </DialogTitle>
          </div>

          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* PRODUCT */}
                  <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product / Item</FormLabel>
                        <Popover
                          open={productOpen}
                          onOpenChange={setProductOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                              onClick={() => setProductOpen(true)}
                            >
                              {field.value
                                ? products.find((p) => p.id === field.value)
                                    ?.name
                                : 'Select product/item'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search product..." />
                              <CommandList>
                                <CommandEmpty>No product found.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        form.setValue('product_id', p.id)
                                        setProductOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          p.id === field.value
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {p.name} ({p.unit}) {formatMoney(p.selling_price)}  
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SUPPLIER */}
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Popover
                          open={supplierOpen}
                          onOpenChange={setSupplierOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                              onClick={() => setSupplierOpen(true)}
                            >
                              {field.value
                                ? suppliers.find((s) => s.id === field.value)
                                    ?.name
                                : 'Select supplier'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search supplier..." />
                              <CommandList>
                                <CommandEmpty>No supplier found.</CommandEmpty>
                                <CommandGroup>
                                  {suppliers.map((s) => (
                                    <CommandItem
                                      key={s.id}
                                      value={s.name}
                                      onSelect={() => {
                                        form.setValue('supplier_id', s.id)
                                        setSupplierOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          s.id === field.value
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {s.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* QUANTITY */}
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min={1} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* PURCHASE PRICE */}
                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} step="any" min={0} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* BATCH NO */}
                  <FormField
                    control={form.control}
                    name="batch_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch No</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Batch number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* MANUFACTURER */}
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Manufacturer name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* DATE MANUFACTURED */}
                  <FormField
                    control={form.control}
                    name="date_manufactured"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Manufactured</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* DATE RECEIVED */}
                  <FormField
                    control={form.control}
                    name="transaction_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Received</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* EXPIRATION DATE */}
                  <FormField
                    control={form.control}
                    name="expiration_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="app__modal_dialog_footer mt-4 flex justify-end gap-2">
                  <Button type="button" onClick={onClose} variant="outline">
                    Cancel
                  </Button>
                  <Button type="submit">
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
