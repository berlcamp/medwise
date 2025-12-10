'use client'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAppDispatch } from '@/lib/redux/hook'
import { updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { ProductStock } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

const table = 'product_stocks'

const FormSchema = z.object({
  purchase_price: z.coerce.number().min(0, 'Purchase price required'),
  batch_no: z.string().optional(),
  manufacturer: z.string().optional(),
  date_manufactured: z.string().optional(),
  expiration_date: z.string().optional(),
  remarks: z.string().optional()
})

type FormType = z.infer<typeof FormSchema>

export const EditStockModal = ({
  isOpen,
  onClose,
  selectedItem
}: {
  isOpen: boolean
  onClose: () => void
  selectedItem: ProductStock | null
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dispatch = useAppDispatch()

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      purchase_price: 0,
      batch_no: '',
      manufacturer: '',
      date_manufactured: '',
      expiration_date: '',
      remarks: ''
    }
  })

  useEffect(() => {
    if (selectedItem && isOpen) {
      form.reset({
        purchase_price: selectedItem.purchase_price || 0,
        batch_no: selectedItem.batch_no || '',
        manufacturer: selectedItem.manufacturer || '',
        date_manufactured: selectedItem.date_manufactured || '',
        expiration_date: selectedItem.expiration_date || '',
        remarks: selectedItem.remarks || ''
      })
    }
  }, [selectedItem, isOpen, form])

  const onSubmit = async (data: FormType) => {
    if (!selectedItem) return
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const updateData: {
        purchase_price: number
        batch_no: string | null
        manufacturer: string | null
        remarks: string | null
        date_manufactured?: string
        expiration_date?: string
      } = {
        purchase_price: data.purchase_price,
        batch_no: data.batch_no || null,
        manufacturer: data.manufacturer || null,
        remarks: data.remarks || null
      }

      // Only update dates if provided
      if (data.date_manufactured) {
        updateData.date_manufactured = data.date_manufactured
      }
      if (data.expiration_date) {
        updateData.expiration_date = data.expiration_date
      }

      const { data: updated, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', selectedItem.id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      dispatch(updateList({ ...updated, id: selectedItem.id }))
      toast.success('Stock updated successfully!')
      onClose()
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      toast.error(`Failed to update: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      as="div"
      className="relative z-50 focus:outline-none"
      onClose={() => {}}
    >
      <div className="fixed inset-0 bg-gray-600 opacity-80" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel transition className="app__modal_dialog_panel_sm">
          <div className="app__modal_dialog_title_container">
            <DialogTitle as="h3" className="text-base font-medium">
              Edit Stock
            </DialogTitle>
          </div>
          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="purchase_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Purchase Price
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="batch_no"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Batch Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Batch Number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Manufacturer
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Manufacturer"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="date_manufactured"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Date Manufactured
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              type="date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="expiration_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Expiration Date
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              type="date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Remarks
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Remarks"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="app__modal_dialog_footer">
                  <Button type="button" onClick={onClose} variant="outline">
                    Cancel
                  </Button>
                  <Button type="submit">
                    {isSubmitting ? 'Updating...' : 'Update'}
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
