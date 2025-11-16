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
import { Textarea } from '@/components/ui/textarea'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Product } from '@/types'
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
  quantity: z.coerce.number().min(1, 'Quantity required'),
  transaction_date: z.string().min(1, 'Date is required'),
  remarks: z.string().optional()
})

type FormType = z.infer<typeof FormSchema>

export const RemoveStockModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)

  const dispatch = useAppDispatch()
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      product_id: 0,
      quantity: 1,
      transaction_date: '',
      remarks: ''
    }
  })

  // Load products from database
  useEffect(() => {
    if (!isOpen) return

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select()
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .order('name', { ascending: true })

      if (error) {
        console.error(error)
        toast.error('Failed to load products.')
      } else {
        setProducts(data || [])
      }
    }

    fetchProducts()
    form.reset({ product_id: 0, quantity: 1, remarks: '' })
  }, [form, isOpen])

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const newStock = {
        ...data,
        type: 'out',
        inventory_type: 'stock',
        transaction_date: data.transaction_date || null,
        remarks: data.remarks,
        branch_id: selectedBranchId,
        org_id: process.env.NEXT_PUBLIC_ORG_ID
      }

      const { data: inserted, error } = await supabase
        .from(table)
        .insert([newStock])
        .select()

      if (error) throw new Error(error.message)

      const product = products.find((p) => p.id === newStock.product_id)

      dispatch(
        addItem({
          ...inserted[0],
          product
        })
      )
      // dispatch(addItem(inserted[0]))

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
            <DialogTitle className="text-base font-medium">
              Remove Stock
            </DialogTitle>
          </div>

          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Product / Item</FormLabel>
                        <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-[250px] justify-between',
                                  !field.value && 'text-muted-foreground'
                                )}
                                onClick={() => setOpen(true)} // ensure it opens
                              >
                                {field.value
                                  ? products.find((p) => p.id === field.value)
                                      ?.name
                                  : 'Select product/item'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0">
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
                                        setOpen(false) // <-- close dropdown after select
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
                                      {p.name} ({p.unit})
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

                  {/*  DATE */}
                  <FormField
                    control={form.control}
                    name="transaction_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Date</FormLabel>
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

                  {/* Remarks */}
                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Remarks"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="app__modal_dialog_footer">
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
