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
import { Textarea } from '@/components/ui/textarea'
import { expensePaymentMethods } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addItem, updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { fetchExpenseCategoryNames } from '@/lib/utils/expenseCategories'
import { Expense } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

// Always update this on other pages
type ItemType = Expense

const table = 'expenses'
const title = 'Expense'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: ItemType | null // Optional prop for editing existing item
}

const FormSchema = z.object({
  expense_date: z.string().min(1, 'Date is required'),
  category: z.string().min(1, 'Category is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: 'Amount must be greater than 0'
    }),
  payee: z.string().optional(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  description: z.string().optional()
})
type FormType = z.infer<typeof FormSchema>

// Local YYYY-MM-DD so the date input never shifts a day via UTC conversion.
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`
}

const toFormValues = (editData?: ItemType | null): FormType => ({
  expense_date: editData?.expense_date || today(),
  category: editData?.category || '',
  amount: editData ? String(editData.amount ?? '') : '',
  payee: editData?.payee || '',
  payment_method: editData?.payment_method || '',
  reference_number: editData?.reference_number || '',
  description: editData?.description || ''
})

export const AddModal = ({ isOpen, onClose, editData }: ModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const dispatch = useAppDispatch()

  const user = useAppSelector((state) => state.user.user)
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: toFormValues(editData)
  })

  // Keep the record's own category selectable even if it was since removed
  // from the list, so editing an old expense never silently blanks it.
  const editCategory = editData?.category
  const categoryOptions =
    editCategory && !categories.includes(editCategory)
      ? [...categories, editCategory]
      : categories

  // Submit handler
  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return // 🚫 Prevent double-submit
    if (!selectedBranchId) {
      toast.error('Please select a branch')
      return
    }
    setIsSubmitting(true)

    try {
      const newData = {
        expense_date: data.expense_date,
        category: data.category,
        amount: Number(data.amount),
        payee: data.payee?.trim() || null,
        payment_method: data.payment_method || null,
        reference_number: data.reference_number?.trim() || null,
        description: data.description?.trim() || null,
        branch_id: selectedBranchId,
        org_id: process.env.NEXT_PUBLIC_ORG_ID
      }

      // If exists (editing), update it
      if (editData?.id) {
        const { error } = await supabase
          .from(table)
          .update(newData)
          .eq('id', editData.id)

        if (error) {
          throw new Error(error.message)
        } else {
          // Update list on redux
          dispatch(updateList({ ...editData, ...newData, id: editData.id }))
          onClose()
        }
      } else {
        // Add new one
        const { data: inserted, error } = await supabase
          .from(table)
          .insert([{ ...newData, created_by: user?.name || null }])
          .select()

        if (error) {
          throw new Error(error.message)
        } else {
          // Insert new item to Redux
          dispatch(addItem({ ...newData, id: inserted[0].id }))
          onClose()
        }
      }

      toast.success('Successfully saved!')
    } catch (err) {
      console.error('Submission error:', err)
      toast.error('Failed to save expense')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    form.reset(toFormValues(editData))
  }, [form, editData, isOpen])

  // Reload on open so a category added from "Manage Categories" appears here
  // without a page refresh.
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    fetchExpenseCategoryNames().then((names) => {
      if (isMounted) setCategories(names)
    })
    return () => {
      isMounted = false
    }
  }, [isOpen])

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
                  {/* Date */}
                  <FormField
                    control={form.control}
                    name="expense_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Date <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryOptions.map((cat) => (
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

                  {/* Amount */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Amount <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payee */}
                  <FormField
                    control={form.control}
                    name="payee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid To</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex. Meralco, Juan Dela Cruz"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Method */}
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {expensePaymentMethods.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reference / OR Number */}
                  <FormField
                    control={form.control}
                    name="reference_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference / OR No.</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex. OR-000123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="What was this expense for?"
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving..'
                      : editData
                      ? 'Update'
                      : 'Save'}
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
