/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { format } from 'date-fns'

export const QuotationPrint = ({ data }: { data: any }) => {
  if (!data || !data.quotation || !data.items) return null

  const { quotation, items } = data

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
      id="quotation-print-area"
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
            QUOTATION
          </h1>

          {/* Business Info */}
          <p className="font-semibold" style={{ fontSize: '12px', margin: '2px 0' }}>
            FEB SACOTE RECORBA
          </p>
          <p style={{ fontSize: '11px', margin: '2px 0' }}>
            Barangay 1, 8501 San Francisco, Agusan del Sur, Philippines
          </p>
          <p style={{ fontSize: '11px', margin: '2px 0' }}>
            VAT Reg. TIN: 313-697-244-00000
          </p>
          <p className="font-semibold" style={{ fontSize: '12px', marginTop: '4px' }}>
            MEDWISE PHARMACEUTICAL PRODUCTS TRADING
          </p>
        </div>

        {/* CUSTOMER + QUOTATION INFO */}
        <div
          className="flex justify-between"
          style={{ marginBottom: '15px', fontSize: '11px' }}
        >
          <div style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>Quoted To:</strong>{' '}
              {quotation.customer?.name || quotation.customer_name || 'Customer'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Address:</strong>{' '}
              {quotation.customer?.address || '______________________'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Contact:</strong>{' '}
              {quotation.customer?.contact_number || '-'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>TIN:</strong>{' '}
              {quotation.customer?.tin || '______________________'}
            </p>
          </div>

          <div className="text-right" style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>Quotation No.:</strong> {quotation.quotation_number || '-'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Date:</strong>{' '}
              {formatDate(quotation.quotation_date)}
            </p>
            {quotation.valid_until && (
              <p style={{ margin: '3px 0' }}>
                <strong>Valid Until:</strong>{' '}
                {formatDate(quotation.valid_until)}
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
            {items.map((it: any, index: number) => (
              <tr key={it.id || index} className="border-b border-black">
                <td className="border border-black p-2 text-left">
                  {it.quantity}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.product?.unit || it.unit || 'pcs'}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.product?.name || it.product_name || '-'}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.unit_price || it.price)}
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
              className="flex justify-between border-t border-black pt-2 mt-2 font-bold"
              style={{
                borderTop: '1px solid #000',
                paddingTop: '8px',
                marginTop: '8px'
              }}
            >
              <span>Total Amount Due:</span>
              <span>{formatCurrency(quotation.total_amount)}</span>
            </div>
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
            THIS IS A QUOTATION ONLY - NOT AN INVOICE
          </p>
          <p style={{ margin: '3px 0' }}>Thank you for your interest!</p>
        </div>
      </div>
    </div>
  )
}
