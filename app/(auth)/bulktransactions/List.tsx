/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { DeliveryReceiptPrint } from '@/components/printables/DeliveryReceiptPrint'
import { InvoicePrint } from '@/components/printables/InvoicePrint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase/client'
import { RootState, Transaction } from '@/types'
import { format } from 'date-fns'
import { ChevronDown, CreditCard, Eye, FileText, Printer } from 'lucide-react'
import { useState } from 'react'
import Avatar from 'react-avatar'
import { useSelector } from 'react-redux'
import { DeliveryStatusDropdown } from './DeliveryStatusDropdown'
import { ReceivePaymentModal } from './PaymentStatusDropdown'
import { TransactionDetailsModal } from './TransactionDetailsModal'

export const List = () => {
  const list = useSelector((state: RootState) => state.list.value)
  const [selectedItem, setSelectedItem] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [printData, setPrintData] = useState<any>(null)
  const [printDeliveryData, setPrintDeliveryData] = useState<any>(null)
  const [printType, setPrintType] = useState<'invoice' | 'delivery' | null>(
    null
  )

  const handleView = (item: Transaction) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const printInvoice = async (item: Transaction) => {
    // Clear all print state immediately before starting new print
    setPrintData(null)
    setPrintDeliveryData(null)
    setPrintType(null)

    // Load transaction items with product data
    const { data: items, error: itemsError } = await supabase
      .from('transaction_items')
      .select(`*, product:product_id(name)`)
      .eq('transaction_id', item.id)

    if (itemsError) {
      console.error(itemsError)
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

    // Combine transaction data with customer
    const transactionWithCustomer = {
      ...item,
      customer: customerData
    }

    // Set invoice data after clearing
    setPrintData({ transaction: transactionWithCustomer, items })
    setPrintType('invoice')

    setTimeout(() => {
      window.print()
      // Reset after print
      setTimeout(() => {
        setPrintData(null)
        setPrintDeliveryData(null)
        setPrintType(null)
      }, 500)
    }, 200)
  }

  const printDeliveryReceipt = async (item: Transaction) => {
    // Clear all print state immediately before starting new print
    setPrintData(null)
    setPrintDeliveryData(null)
    setPrintType(null)

    // Load transaction items with product data
    const { data: items, error: itemsError } = await supabase
      .from('transaction_items')
      .select(`*, product:product_id(name)`)
      .eq('transaction_id', item.id)

    if (itemsError) {
      console.error(itemsError)
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

    // Combine transaction data with customer
    const transactionWithCustomer = {
      ...item,
      customer: customerData
    }

    // Set delivery receipt data after clearing
    setPrintDeliveryData({ transaction: transactionWithCustomer, items })
    setPrintType('delivery')

    setTimeout(() => {
      window.print()
      // Reset after print
      setTimeout(() => {
        setPrintData(null)
        setPrintDeliveryData(null)
        setPrintType(null)
      }, 500)
    }, 200)
  }

  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Transaction No.</th>
            <th className="app__th">Customer</th>
            <th className="app__th">Payment Method</th>
            <th className="app__th text-right">Amount</th>
            <th className="app__th text-center">Delivery Status</th>
            <th className="app__th text-center">Payment Status</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: Transaction) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div>
                  <div className="font-semibold">{item.transaction_number}</div>
                  <div className="text-xs text-gray-500">
                    {item.created_at &&
                      format(new Date(item.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              </td>
              <td className="app__td">
                {item.customer ? (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={item.customer.name}
                      size="30"
                      round={true}
                      textSizeRatio={3}
                      className="shrink-0"
                    />
                    <span className="text-gray-800 font-medium">
                      {item.customer.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="app__td">
                <div>
                  <span className="font-medium">{item.payment_type || '-'}</span>
                  {item.payment_type === 'GL' && (
                    <div className="text-xs text-gray-500">
                      GL: {item.gl_number || '-'}
                    </div>
                  )}
                </div>
              </td>
              <td className="app__td text-right">
                <span className="font-semibold text-gray-900">
                  ₱{Number(item.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </td>
              <td className="app__td text-center">
                <DeliveryStatusDropdown
                  transaction={item}
                  onUpdated={() => {
                    // optional: refresh list after update
                  }}
                />
              </td>
              <td className="app__td text-center">
                {item.payment_status === 'Paid' && (
                  <Badge variant="green">Paid</Badge>
                )}
                {item.payment_status === 'Partial' && (
                  <Badge variant="orange">Partial</Badge>
                )}
                {item.payment_status === 'Unpaid' && (
                  <Badge variant="red">Unpaid</Badge>
                )}
                {item.payment_status === 'Pending' && (
                  <Badge variant="orange">Pending</Badge>
                )}
                {!item.payment_status && (
                  <Badge variant="outline">-</Badge>
                )}
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
                    <DropdownMenuItem onClick={() => handleView(item)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedItem(item)
                        setIsPaymentOpen(true)
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Payments
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => printInvoice(item)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => printDeliveryReceipt(item)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Print Delivery Receipt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedItem && (
        <>
          <TransactionDetailsModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              setSelectedItem(null)
            }}
            transaction={selectedItem}
          />
          <ReceivePaymentModal
            transaction={selectedItem}
            isOpen={isPaymentOpen}
            onClose={() => {
              setIsPaymentOpen(false)
            }}
          />
        </>
      )}

      {printType === 'invoice' && printData && (
        <InvoicePrint key="invoice" data={printData} />
      )}
      {printType === 'delivery' && printDeliveryData && (
        <DeliveryReceiptPrint key="delivery" data={printDeliveryData} />
      )}
    </div>
  )
}
