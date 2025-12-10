/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { QuotationPrint } from '@/components/printables/QuotationPrint'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Quotation, RootState } from '@/types'
import { format } from 'date-fns'
import { ChevronDown, Printer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Avatar from 'react-avatar'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { QuotationStatusDropdown } from './QuotationStatusDropdown'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)
  const [printData, setPrintData] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)

  const printQuotation = async (item: Quotation) => {
    // Load quotation items with product data
    const { data: items, error: itemsError } = await supabase
      .from('quotation_items')
      .select(`*, product:product_id(name, unit)`)
      .eq('quotation_id', item.id)

    if (itemsError) {
      console.error(itemsError)
      toast.error('Failed to load quotation items')
      return
    }

    // Load customer data if customer_id exists
    let customerData = null
    if (item.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', item.customer_id)
        .single()

      if (!customerError && customer) {
        customerData = customer
      }
    }

    // Combine quotation data with customer
    const quotationWithCustomer = {
      ...item,
      customer: customerData
    }

    setPrintData({ quotation: quotationWithCustomer, items: items || [] })

    // Use requestAnimationFrame to ensure DOM is updated before printing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print()
          setTimeout(() => {
            setPrintData(null)
          }, 500)
        }, 100)
      })
    })
  }

  const handleDeleteConfirmation = (quotation: Quotation) => {
    setSelectedQuotation(quotation)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedQuotation) return

    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', selectedQuotation.id)

    if (error) {
      if (error.code === '23503') {
        toast.error('Selected quotation cannot be deleted.')
      } else {
        toast.error(error.message)
      }
      return
    }

    toast.success('Quotation deleted successfully!')
    dispatch(deleteItem(selectedQuotation))
    setIsDeleteModalOpen(false)
    setSelectedQuotation(null)
  }


  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Quotation No.</th>
            <th className="app__th">Customer</th>
            <th className="app__th">Date</th>
            <th className="app__th">Valid Until</th>
            <th className="app__th text-right">Amount</th>
            <th className="app__th text-center">Status</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: Quotation) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div>
                  <div className="font-semibold">{item.quotation_number}</div>
                </div>
              </td>
              <td className="app__td">
                {item.customer ? (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={item.customer_name}
                      size="30"
                      round={true}
                      textSizeRatio={3}
                      className="shrink-0"
                    />
                    <span className="text-gray-800 font-medium">
                      {item.customer_name}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">{item.customer_name}</span>
                )}
              </td>
              <td className="app__td">
                {item.quotation_date &&
                  format(new Date(item.quotation_date), 'MMM dd, yyyy')}
              </td>
              <td className="app__td">
                {item.valid_until
                  ? format(new Date(item.valid_until), 'MMM dd, yyyy')
                  : '-'}
              </td>
              <td className="app__td text-right">
                <span className="font-semibold text-gray-900">
                  {formatMoney(item.total_amount)}
                </span>
              </td>
              <td className="app__td text-center">
                <QuotationStatusDropdown quotation={item} />
              </td>
              <td className="app__td text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="blue">
                      Actions
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => printQuotation(item)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Quotation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteConfirmation(item)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Quotation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <QuotationPrint data={printData} />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedQuotation(null)
        }}
        onConfirm={handleDelete}
        message={
          <div>
            <p className="text-sm text-gray-700">
              Are you sure you want to delete quotation{' '}
              <span className="font-semibold">
                {selectedQuotation?.quotation_number}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This action cannot be undone. All associated items will also be deleted.
            </p>
          </div>
        }
      />
    </div>
  )
}
