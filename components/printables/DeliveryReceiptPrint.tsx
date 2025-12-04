/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { TransactionItem } from '@/types'
import { format } from 'date-fns'

export const DeliveryReceiptPrint = ({ data }: { data: any }) => {
  if (!data) return null

  const { transaction, items } = data

  return (
    <div
      className="hidden print:block p-4"
      id="delivery-print-area"
      style={{
        width: '8.27in', // A4 width
        fontSize: '12px',
        lineHeight: '1.25'
      }}
    >
      <div className="text-black">
        {/* HEADER */}
        <div className="text-center pb-2 border-b border-black">
          <h1 className="font-bold uppercase text-lg">DELIVERY RECEIPT</h1>

          <p className="font-semibold mt-1">FEB SACOTE RECORBA</p>
          <p>Barangay 1, 8501 San Francisco, Agusan del Sur, Philippines</p>
          <p>Non-VAT Reg. TIN: 313-697-244-00000</p>

          <p className="font-semibold mt-1">
            MEDWISE PHARMACEUTICAL PRODUCTS TRADING
          </p>
        </div>

        {/* CUSTOMER INFO */}
        <div className="flex justify-between mt-3 text-sm">
          <div>
            <p>
              <b>Delivered To:</b>{' '}
              {transaction.customer?.name || 'Walk-in Customer'}
            </p>
            <p>
              <b>Address:</b> _______________________________
            </p>
            <p>
              <b>TIN:</b> _______________________________
            </p>
          </div>

          <div className="text-right">
            <p>
              <b>DR No.:</b> {transaction.transaction_number}
            </p>
            <p>
              <b>Date:</b>{' '}
              {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
            </p>
            <p>
              <b>Reference:</b> {transaction.reference_number || 'N/A'}
            </p>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <table
          className="w-full mt-4 border border-black"
          style={{
            borderCollapse: 'collapse',
            pageBreakInside: 'auto' // important for breaking
          }}
        >
          <thead style={{ display: 'table-header-group' }}>
            <tr className="border-b border-black bg-gray-100">
              <th className="border-r border-black p-2 text-left">
                Item Description/Nature of Service
              </th>
              <th className="border-r border-black p-2 text-left">Quantity</th>
              <th className="border-r border-black p-2 text-left">
                Unit Cost/Price
              </th>
              <th className="border-r border-black p-2 text-left">
                Lot/Batch No
              </th>
              <th className="border-r border-black p-2 text-left">
                Expiry Date
              </th>
              <th className="p-2 text-right">AMOUNT</th>
            </tr>
          </thead>

          <tbody>
            {items.map((it: TransactionItem) => (
              <tr
                key={it.id}
                className="border-b border-black"
                style={{ pageBreakInside: 'avoid' }}
              >
                <td className="border-r border-black p-2">
                  {it.product?.name}
                </td>
                <td className="border-r border-black p-2">{it.quantity}</td>
                <td className="border-r border-black p-2">{it.price}</td>
                <td className="border-r border-black p-2">{it.batch_no}</td>
                <td className="border-r border-black p-2">
                  {it.expiration_date}
                </td>
                <td className="p-2 text-right">{it.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL ITEMS */}
        <div className="flex justify-end mt-3 text-sm">
          <p>
            <b>Total Items: </b> {items.length}
          </p>
        </div>

        {/* SIGNATURES */}
        <div
          className="mt-8 flex justify-between text-sm"
          style={{ pageBreakInside: 'avoid' }}
        >
          <div>
            <p>_____________________________</p>
            <p>Delivered By</p>
          </div>

          <div>
            <p>_____________________________</p>
            <p>Received By</p>
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="border-t border-black mt-6 pt-2 text-center text-xs"
          style={{ pageBreakInside: 'avoid' }}
        >
          <p>THIS IS NOT AN OFFICIAL RECEIPT</p>
          <p>Thank you!</p>
        </div>
      </div>
    </div>
  )
}
