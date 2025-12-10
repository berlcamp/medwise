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
import { Agent } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Car, CheckCircle, MapPin, Phone, User, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

const table = 'agents'
const title = 'Agent'

const FormSchema = z.object({
  name: z.string().min(1, 'Agent Name is required'),
  area: z.string().optional(),
  contact_number: z.string().optional(),
  vehicle_plate_number: z.string().optional(),
  status: z.enum(['active', 'inactive'])
})

type FormType = z.infer<typeof FormSchema>

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: Agent | null
  onAdded?: (newAgent: Agent) => void
}

export const AddModal = ({
  isOpen,
  onClose,
  editData,
  onAdded
}: ModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dispatch = useAppDispatch()

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: editData ? editData.name : '',
      area: editData ? editData.area : '',
      contact_number: editData ? editData.contact_number : '',
      vehicle_plate_number: editData ? editData.vehicle_plate_number : '',
      status: editData ? editData.status : 'active'
    }
  })

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return

    if (!selectedBranchId) {
      toast.error('Please select a branch first')
      return
    }

    setIsSubmitting(true)

    try {
      // When editing, preserve the original branch_id to maintain branch-level isolation
      const branchIdToUse = editData?.branch_id || selectedBranchId

      const newData = {
        name: data.name.trim(),
        area: data.area || null,
        contact_number: data.contact_number || null,
        vehicle_plate_number: data.vehicle_plate_number || null,
        status: data.status,
        branch_id: branchIdToUse,
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID)
      }

      if (editData?.id) {
        const { error } = await supabase
          .from(table)
          .update(newData)
          .eq('id', editData.id)

        if (error) {
          throw new Error(error.message)
        } else {
          dispatch(updateList({ ...newData, id: editData.id }))
          onClose()
        }
      } else {
        const { data: inserted, error } = await supabase
          .from(table)
          .insert([newData])
          .select()
          .single()

        if (error) {
          throw new Error(error.message)
        } else {
          if (onAdded) {
            onAdded(inserted)
          } else {
            dispatch(addItem({ ...newData, id: inserted.id }))
          }
          onClose()
        }
      }

      toast.success('Successfully saved!')
    } catch (err) {
      console.error('Submission error:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      toast.error(`Failed to save: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (editData) {
      form.reset({
        name: editData.name,
        area: editData.area || '',
        contact_number: editData.contact_number || '',
        vehicle_plate_number: editData.vehicle_plate_number || '',
        status: editData.status
      })
    }
  }, [form, editData, isOpen])

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
            <DialogTitle as="h3" className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              {editData ? 'Edit' : 'Add'} {title}
            </DialogTitle>
          </div>
          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-5">
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <User className="h-4 w-4 text-gray-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Basic Information</h4>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            Agent Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Enter agent name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="area"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            Area
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Enter assigned area"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Contact & Vehicle Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <h4 className="text-sm font-semibold text-gray-700">Contact & Vehicle</h4>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="contact_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            Contact Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Enter contact number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="vehicle_plate_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard flex items-center gap-2">
                            <Car className="h-4 w-4 text-gray-400" />
                            Vehicle Plate Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="app__input_standard"
                              placeholder="Enter vehicle plate number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Status Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      {form.watch('status') === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-500" />
                      )}
                      <h4 className="text-sm font-semibold text-gray-700">Status</h4>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="app__formlabel_standard">Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="app__input_standard">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  Active
                                </div>
                              </SelectItem>
                              <SelectItem value="inactive">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-gray-500" />
                                  Inactive
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="app__modal_dialog_footer mt-6">
                  <Button type="button" onClick={onClose} variant="outline">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Saving...
                      </span>
                    ) : editData ? (
                      'Update Agent'
                    ) : (
                      'Create Agent'
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
