// components/AddItemTypeModal.tsx
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
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem, updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'

import { Service, ServiceCategory } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

// Always update this on other pages
type ItemType = Service
const table = 'services'
const title = 'Procedure'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: ItemType | null // Optional prop for editing existing item
}

const FormSchema = z.object({
  name: z.string().min(1, 'Service Name is required'),
  category_id: z.string().min(1, 'Category is required'),
  base_price: z.coerce.number().min(0, 'Base Price is required') // ✅ coercion fixes string->number from inputs
})
type FormType = z.infer<typeof FormSchema>

export const AddModal = ({ isOpen, onClose, editData }: ModalProps) => {
  //
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(
    []
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dispatch = useAppDispatch()

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: editData ? editData.name : '',
      category_id: editData ? editData.category_id.toString() : '',
      base_price: editData ? editData.base_price : 0
    }
  })

  // Submit handler
  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return // 🚫 Prevent double-submit
    setIsSubmitting(true)

    try {
      const newData = {
        name: data.name.trim(),
        base_price: data.base_price,
        category_id: data.category_id,
        branch_id: selectedBranchId,
        org_id: process.env.NEXT_PUBLIC_ORG_ID
      }

      if (editData?.id) {
        // ---- UPDATE ----
        const { error } = await supabase
          .from(table)
          .update(newData)
          .eq('id', editData.id)

        if (error) throw new Error(error.message)

        // ✅ Fetch updated record with category join
        const { data: updated } = await supabase
          .from(table)
          .select('*, category:category_id(name)')
          .eq('id', editData.id)
          .single()

        if (updated) {
          dispatch(updateList(updated))
        }

        onClose()
      } else {
        // ---- INSERT ----
        const { data: inserted, error } = await supabase
          .from(table)
          .insert([newData])
          .select('*, category:category_id(name)') // ✅ include join

        if (error) throw new Error(error.message)

        if (inserted?.[0]) {
          dispatch(addItem(inserted[0]))
        }

        onClose()
      }

      toast.success('Successfully saved!')
    } catch (err) {
      console.error('Submission error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------- LOAD DROPDOWNS ----------
  useEffect(() => {
    const fetchData = async () => {
      const [s] = await Promise.all([
        supabase
          .from('service_categories')
          .select()
          .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
          .order('name', { ascending: true })
      ])

      if (s.data) setServiceCategories(s.data)
    }
    fetchData()
  }, [])

  useEffect(() => {
    form.reset({
      name: editData?.name || '',
      base_price: editData?.base_price || 0,
      category_id: editData?.category_id.toString()
    })
  }, [form, editData, isOpen])

  // ---------- DERIVED CATEGORY STRUCTURE ----------
  const mainCategories = serviceCategories.filter((c) => !c.parent_id)
  const subcategories = (parentId: number) =>
    serviceCategories.filter((c) => c.parent_id === parentId)

  return (
    <Dialog
      open={isOpen}
      as="div"
      className="relative z-50 focus:outline-none"
      onClose={() => {}}
    >
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-600 opacity-80"
        aria-hidden="true"
      />

      {/* Centered panel container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel transition className="app__modal_dialog_panel_sm">
          {/* Sticky Header */}
          <div className="app__modal_dialog_title_container">
            <DialogTitle as="h3" className="text-base font-medium">
              {editData ? 'Edit' : 'Add'} {title}
            </DialogTitle>
          </div>
          {/* Scrollable Form Content */}
          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Procedure Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder=""
                              type="text"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* CATEGORY DROPDOWN */}
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="app__formlabel_standard">
                          Category
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value?.toString() ?? ''}
                        >
                          <FormControl>
                            <SelectTrigger className="app__input_standard">
                              <SelectValue placeholder="Select category or subcategory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mainCategories.map((main) => (
                              <div key={main.id}>
                                <SelectItem value={main.id.toString()}>
                                  {main.name}
                                </SelectItem>

                                {/* Subcategories (indented + prefixed) */}
                                {subcategories(main.id).map((sub) => (
                                  <SelectItem
                                    key={sub.id}
                                    value={sub.id.toString()}
                                    className="pl-6 text-gray-600"
                                  >
                                    ↳ {sub.name}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormField
                      control={form.control}
                      name="base_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">
                            Per Session Price
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Price"
                              type="number"
                              step="any"
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
                    {editData ? (
                      'Update'
                    ) : (
                      <span>{isSubmitting ? 'Saving..' : 'Save'}</span>
                    )}
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
