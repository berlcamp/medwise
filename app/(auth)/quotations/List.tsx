/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { QuotationPrint } from '@/components/printables/QuotationPrint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Quotation, RootState } from '@/types'
import { format } from 'date-fns'
import { ChevronDown, Printer } from 'lucide-react'
import { useState } from 'react'
import Avatar from 'react-avatar'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'

export const List = () => {
  const list = useSelector((state: RootState) => state.list.value)
  const [printData, setPrintData] = useState<any>(null)

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>
      case 'sent':
        return <Badge variant="blue">Sent</Badge>
      case 'accepted':
        return <Badge variant="green">Accepted</Badge>
      case 'rejected':
        return <Badge variant="red">Rejected</Badge>
      case 'expired':
        return <Badge variant="orange">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
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
                {getStatusBadge(item.status)}
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <QuotationPrint data={printData} />
    </div>
  )
}
