/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { format } from 'date-fns'

export const InvoicePrint = ({ data }: { data: any }) => {
  if (!data) return null

  const { transaction, items } = data

  const formatCurrency = (amount: number | string) => {
    return `₱${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.total || 0),
    0
  )

  return (
    <div
      className="hidden print:block"
      id="invoice-print-area"
      style={{
        width: '8.5in',
        maxWidth: '8.5in',
        margin: '0 auto',
        padding: '0.25in 0.5in 0.5in 0.5in', /* top right bottom left - smaller top padding */
        fontSize: '11px',
        lineHeight: '1.4',
        color: '#000',
        backgroundColor: '#fff'
      }}
    >
      <div className="text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* HEADER */}
        <div
          className="text-center pb-3 border-b-2 border-black"
          style={{ marginBottom: '15px' }}
        >
          <h1
            className="font-bold uppercase"
            style={{ fontSize: '18px', marginBottom: '8px' }}
          >
            SALES INVOICE
          </h1>

          {/* Business Info */}
          <p className="font-semibold" style={{ fontSize: '12px', margin: '2px 0' }}>
            FEB SACOTE RECORBA
          </p>
          <p style={{ fontSize: '11px', margin: '2px 0' }}>
            Barangay 1, 8501 San Francisco, Agusan del Sur, Philippines
          </p>
          <p style={{ fontSize: '11px', margin: '2px 0' }}>
            Non-VAT Reg. TIN: 313-697-244-00000
          </p>
          <p className="font-semibold" style={{ fontSize: '12px', marginTop: '4px' }}>
            MEDWISE PHARMACEUTICAL PRODUCTS TRADING
          </p>
        </div>

        {/* CUSTOMER + INVOICE INFO */}
        <div
          className="flex justify-between"
          style={{ marginBottom: '15px', fontSize: '11px' }}
        >
          <div style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>Sold To:</strong>{' '}
              {transaction.customer?.name || 'Walk-in Customer'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Address:</strong>{' '}
              {transaction.customer?.address || '______________________'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>TIN:</strong> ______________________
            </p>
          </div>

          <div className="text-right" style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>SI No.:</strong> {transaction.transaction_number}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Date:</strong>{' '}
              {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
            </p>
            {transaction.reference_number && (
              <p style={{ margin: '3px 0' }}>
                <strong>Reference:</strong> {transaction.reference_number}
              </p>
            )}
          </div>
        </div>

        {/* ITEMS TABLE */}
        <table
          className="w-full border-2 border-black"
          style={{
            borderCollapse: 'collapse',
            marginBottom: '15px',
            fontSize: '10px'
          }}
        >
          <thead>
            <tr
              style={{ backgroundColor: '#fff' }}
            >
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '8%' }}
              >
                Qty
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '10%' }}
              >
                Unit
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '42%' }}
              >
                Description
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '20%' }}
              >
                Unit Price
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '20%' }}
              >
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-b border-black">
                <td className="border border-black p-2 text-left">
                  {it.quantity}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.unit || 'pcs'}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.product?.name || it.products?.name || '-'}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.price)}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS SECTION */}
        <div className="flex justify-end" style={{ marginBottom: '20px' }}>
          <div
            className="border-2 border-black"
            style={{
              width: '280px',
              padding: '10px',
              fontSize: '11px'
            }}
          >
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Subtotal:</span>
              <span className="font-semibold">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div
              className="flex justify-between border-t border-black pt-2 mt-2 font-bold"
              style={{
                borderTop: '1px solid #000',
                paddingTop: '8px',
                marginTop: '8px'
              }}
            >
              <span>Total Amount Due:</span>
              <span>{formatCurrency(transaction.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* SIGNATURE */}
        <div
          className="flex justify-between"
          style={{
            marginTop: '30px',
            marginBottom: '15px',
            fontSize: '11px',
            pageBreakInside: 'avoid'
          }}
        >
          <div>
            <p style={{ marginBottom: '5px', marginTop: 0 }}>_____________________________</p>
            <p style={{ marginTop: 0 }}>Authorized Representative</p>
          </div>

          <div>
            <p style={{ marginBottom: '5px', marginTop: 0 }}>_____________________________</p>
            <p style={{ marginTop: 0 }}>Customer{"'"}s Signature</p>
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="border-t-2 border-black text-center"
          style={{
            borderTop: '2px solid #000',
            paddingTop: '10px',
            marginTop: '20px',
            fontSize: '9px',
            pageBreakInside: 'avoid'
          }}
        >
          <p style={{ margin: '3px 0', fontWeight: 'bold' }}>
            THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX
          </p>
          <p style={{ margin: '3px 0' }}>Thank you for your business!</p>
        </div>
      </div>
    </div>
  )
}
