/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { format } from 'date-fns'

export const InvoicePrint = ({ data }: { data: any }) => {
  if (!data) return null

  const { transaction, items } = data

  return (
    <div
      className="hidden print:block p-2"
      id="invoice-print-area"
      style={{ width: '5in', fontSize: '10px', lineHeight: '1.2' }}
    >
      <div className="text-black">
        {/* HEADER */}
        <div className="text-center pb-2 border-b border-black">
          <h1 className="font-bold uppercase text-sm">SALES INVOICE</h1>

          {/* Business Info */}
          <p className="font-semibold mt-1 text-xs">FEB SACOTE RECORBA</p>
          <p className="text-xs">
            Barangay 1, 8501 San Francisco, Agusan del Sur, Philippines
          </p>
          <p className="text-xs">Non-VAT Reg. TIN: 313-697-244-00000</p>
          <p className="font-semibold mt-1 text-xs">
            MEDWISE PHARMACEUTICAL PRODUCTS TRADING
          </p>
        </div>

        {/* CUSTOMER + INVOICE INFO */}
        <div className="flex justify-between mt-2 text-xs">
          <div>
            <p>
              <b>Sold To:</b> {transaction.customer?.name || 'Walk-in Customer'}
            </p>
            <p>
              <b>Address:</b> ______________________
            </p>
            <p>
              <b>TIN:</b> ______________________
            </p>
          </div>

          <div className="text-right">
            <p>
              <b>SI No.:</b> {transaction.transaction_number}
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
          className="w-full mt-2 border border-black text-xs"
          style={{ borderCollapse: 'collapse' }}
        >
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="border-r border-black p-1 text-left">Qty</th>
              <th className="border-r border-black p-1 text-left">Unit</th>
              <th className="border-r border-black p-1 text-left">
                Description
              </th>
              <th className="border-r border-black p-1 text-right">
                Unit Price
              </th>
              <th className="p-1 text-right">Amount</th>
            </tr>
          </thead>

          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-b border-black">
                <td className="border-r border-black p-1">{it.quantity}</td>
                <td className="border-r border-black p-1">pcs</td>
                <td className="border-r border-black p-1">
                  {it.product?.name}
                </td>
                <td className="border-r border-black p-1 text-right">
                  {Number(it.price).toFixed(2)}
                </td>
                <td className="p-1 text-right">
                  {Number(it.total).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS SECTION */}
        <div className="flex justify-end mt-2 text-xs">
          <div className="w-[120px] border border-black p-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{Number(transaction.total_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between mt-1">
              <span>VAT (12%):</span>
              {/* <span>{(transaction.total_amount * 0.12).toFixed(2)}</span> */}
            </div>

            <div className="flex justify-between font-bold mt-1 border-t pt-1">
              <span>Total Amount Due:</span>
              <span>{Number(transaction.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="mt-4 flex justify-between text-xs">
          <div>
            <p>____________________</p>
            <p>Authorized Representative</p>
          </div>

          <div>
            <p>____________________</p>
            <p>Customer{"'"}s Signature</p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-black mt-2 pt-1 text-center text-[8px]">
          <p>THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </div>
  )
}
