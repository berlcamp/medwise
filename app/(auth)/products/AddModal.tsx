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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { productCategories, productUnits } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem, updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

// Always update this on other pages
type ItemType = Product
const table = 'products'
const title = 'Product'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: ItemType | null // Optional prop for editing existing item
}

const FormSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  selling_price: z.coerce.number().min(0, 'Price is required'),
  reorder_point: z.coerce.number().min(0, 'Reorder level required')
})

type FormType = z.infer<typeof FormSchema>

export const AddModal = ({ isOpen, onClose, editData }: ModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dispatch = useAppDispatch()

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      category: '',
      selling_price: 0,
      reorder_point: 5
    }
  })

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const newData = {
        ...data,
        type: 'for sale',
        branch_id: selectedBranchId,
        org_id: process.env.NEXT_PUBLIC_ORG_ID
      }

      if (editData?.id) {
        const { error } = await supabase
          .from(table)
          .update(newData)
          .eq('id', editData.id)

        if (error) throw new Error(error.message)
        dispatch(updateList({ ...newData, id: editData.id }))
        toast.success('Successfully updated!')
      } else {
        const { data: inserted, error } = await supabase
          .from(table)
          .insert([newData])
          .select()

        if (error) throw new Error(error.message)
        dispatch(addItem(inserted[0]))
        toast.success('Successfully added!')
      }

      onClose()
    } catch (err) {
      console.error('Error:', err)
      toast.error('Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    form.reset({
      name: editData?.name || '',
      category: editData?.category || '',
      unit: editData?.unit || '',
      selling_price: editData?.selling_price || 0,
      reorder_point: editData?.reorder_point || 5
    })
  }, [form, editData, isOpen])

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
              {editData ? 'Edit' : 'Add'} {title}
            </DialogTitle>
          </div>

          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Product Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex. Biogesic Tablet"
                            className="app__input_standard"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* CATEGORY DROPDOWN */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Category
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="app__input_standard">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* UNIT DROPDOWN */}
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Unit
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="app__input_standard">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productUnits.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="selling_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Price
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="any"
                            className="app__input_standard"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reorder_point"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Reorder Level
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="app__input_standard"
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
