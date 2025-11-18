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
import {
  productCategories,
  productSubcategories,
  productUnits
} from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem, updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { generateSKU } from '@/lib/utils'
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
  generic_name: z.string().optional(),
  brand_name: z.string().optional(),
  fda_reg_no: z.string().optional(),
  dosage: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  prescription_log_book: z.boolean().optional(),
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
      subcategory: '',
      generic_name: '',
      brand_name: '',
      fda_reg_no: '',
      dosage: '',
      unit: '',
      prescription_log_book: false, // ✅ FIXED
      selling_price: 0,
      reorder_point: 5
    }
  })

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // Only generate SKU for new product
      const sku = editData?.id ? editData.sku : await generateSKU(data)

      const newData = {
        ...data,
        sku,
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
          .insert(newData)
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
      selling_price: editData?.selling_price ?? 0,
      reorder_point: editData?.reorder_point ?? 5,
      prescription_log_book: editData?.prescription_log_book ?? false,
      subcategory: editData?.subcategory || '',
      generic_name: editData?.generic_name || '',
      brand_name: editData?.brand_name || '',
      fda_reg_no: editData?.fda_reg_no || '',
      dosage: editData?.dosage || ''
    })
  }, [form, editData, isOpen])

  const selectedCategory = form.watch('category')
  const hasSub =
    selectedCategory &&
    productSubcategories[selectedCategory] &&
    productSubcategories[selectedCategory].length > 0

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
                <div className="space-y-6">
                  {/* PRODUCT DETAILS */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 border-b pb-1">
                      Product Details
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Product Name */}
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Product Name{' '}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex. Biogesic Tablet"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Generic Name */}
                      <FormField
                        control={form.control}
                        name="generic_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Generic Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex. Paracetamol" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Brand Name */}
                      <FormField
                        control={form.control}
                        name="brand_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex. Biogesic" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Dosage */}
                      <FormField
                        control={form.control}
                        name="dosage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dosage</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex. 500mg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Category <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
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

                      {/* Subcategory */}
                      {hasSub && (
                        <FormField
                          control={form.control}
                          name="subcategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subcategory</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select subcategory" />
                                  </SelectTrigger>
                                </FormControl>

                                <SelectContent>
                                  {productSubcategories[selectedCategory].map(
                                    (sub) => (
                                      <SelectItem key={sub} value={sub}>
                                        {sub}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                  {/* REGULATORY SECTION */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 border-b pb-1">
                      Regulatory Information
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* FDA Reg No */}
                      <FormField
                        control={form.control}
                        name="fda_reg_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>FDA Registration No.</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex. CFR-1234567" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Prescription Logbook */}
                      <FormField
                        control={form.control}
                        name="prescription_log_book"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-2 mt-6">
                            <FormControl>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={field.value}
                                onChange={(e) =>
                                  field.onChange(e.target.checked)
                                }
                              />
                            </FormControl>
                            <FormLabel className="m-0">
                              Requires Prescription Logbook
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* INVENTORY SECTION */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 border-b pb-1">
                      Inventory Information
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Unit */}
                      <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Unit <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
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

                      {/* Price */}
                      <FormField
                        control={form.control}
                        name="selling_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Selling Price</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="any" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Reorder Level */}
                      <FormField
                        control={form.control}
                        name="reorder_point"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reorder Level</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="app__modal_dialog_footer mt-6">
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
