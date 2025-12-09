/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { TransactionItem } from '@/types'
import { format } from 'date-fns'

export const DeliveryReceiptPrint = ({ data }: { data: any }) => {
  if (!data) return null

  const { transaction, items } = data

  const formatCurrency = (amount: number | string) => {
    return `₱${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  return (
    <div
      className="hidden print:block"
      id="delivery-print-area"
      style={{
        width: '8.5in',
        maxWidth: '8.5in',
        margin: '0 auto',
        padding: '0.25in 0.5in 0.5in 0.5in', /* top right bottom left - smaller top padding */
        fontSize: '12px',
        lineHeight: '1.4',
        color: '#000',
        backgroundColor: '#fff'
      }}
    >
      <div className="text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* HEADER */}
        <div
          className="text-center pb-3 border-b-2 border-black"
          style={{ marginBottom: '20px' }}
        >
          <h1
            className="font-bold uppercase"
            style={{ fontSize: '20px', marginBottom: '10px' }}
          >
            DELIVERY RECEIPT
          </h1>

          <p className="font-semibold" style={{ fontSize: '13px', margin: '3px 0' }}>
            FEB SACOTE RECORBA
          </p>
          <p style={{ fontSize: '12px', margin: '3px 0' }}>
            Barangay 1, 8501 San Francisco, Agusan del Sur, Philippines
          </p>
          <p style={{ fontSize: '12px', margin: '3px 0' }}>
            VAT Reg. TIN: 313-697-244-00000
          </p>

          <p className="font-semibold" style={{ fontSize: '13px', marginTop: '6px' }}>
            MEDWISE PHARMACEUTICAL PRODUCTS TRADING
          </p>
        </div>

        {/* CUSTOMER INFO */}
        <div
          className="flex justify-between"
          style={{ marginBottom: '20px', fontSize: '12px' }}
        >
          <div style={{ flex: '1' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Delivered To:</strong>{' '}
              {transaction.customer?.name || 'Walk-in Customer'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Address:</strong>{' '}
              {transaction.customer?.address || '-'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>TIN:</strong> _______________________________
            </p>
          </div>

          <div className="text-right" style={{ flex: '1' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>DR No.:</strong> {transaction.transaction_number}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Date:</strong>{' '}
              {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Terms:</strong> _______________________
            </p>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <table
          className="w-full border-2 border-black"
          style={{
            borderCollapse: 'collapse',
            marginBottom: '15px',
            fontSize: '11px',
            pageBreakInside: 'auto'
          }}
        >
          <thead style={{ display: 'table-header-group' }}>
            <tr
              style={{ backgroundColor: '#fff' }}
            >
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '30%' }}
              >
                Item Description/Nature of Service
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '10%' }}
              >
                Quantity
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '15%' }}
              >
                Unit Cost/Price
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '15%' }}
              >
                Lot/Batch No
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '15%' }}
              >
                Expiry Date
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '15%' }}
              >
                AMOUNT
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((it: TransactionItem) => (
              <tr
                key={it.id}
                className="border-b border-black"
                style={{ pageBreakInside: 'avoid' }}
              >
                <td className="border border-black p-2 text-left">
                  {it.product?.name || it.products?.name || '-'}
                </td>
                <td className="border border-black p-2 text-center">
                  {it.quantity}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.price)}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.batch_no || '-'}
                </td>
                <td className="border border-black p-2 text-left">
                  {formatDate(it.expiration_date)}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL ITEMS AND AMOUNT */}
        <div
          className="flex justify-between items-start"
          style={{ marginBottom: '25px', fontSize: '12px' }}
        >
          <div>
            <p>
              <strong>Total Items:</strong> {items.length}
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong>Total Amount:</strong>{' '}
              {formatCurrency(transaction.total_amount)}
            </p>
          </div>
        </div>

        {/* SIGNATURES */}
        <div
          className="flex justify-between"
          style={{
            marginTop: '40px',
            marginBottom: '20px',
            fontSize: '12px',
            pageBreakInside: 'avoid'
          }}
        >
          <div>
            <p style={{ marginBottom: '5px', marginTop: 0 }}>
              _____________________________
            </p>
            <p style={{ marginTop: 0 }}>Delivered By</p>
          </div>

          <div>
            <p style={{ marginBottom: '5px', marginTop: 0 }}>
              _____________________________
            </p>
            <p style={{ marginTop: 0 }}>Received By</p>
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="border-t-2 border-black text-center"
          style={{
            borderTop: '2px solid #000',
            paddingTop: '12px',
            marginTop: '25px',
            fontSize: '10px',
            pageBreakInside: 'avoid'
          }}
        >
          <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
            THIS IS NOT AN OFFICIAL RECEIPT
          </p>
          <p style={{ margin: '4px 0' }}>Thank you!</p>
        </div>
      </div>
    </div>
  )
}
