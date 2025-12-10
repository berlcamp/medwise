/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatConsignmentPeriod } from '@/lib/utils/consignment'
import { format } from 'date-fns'

export const ConsignmentPrint = ({ data }: { data: any }) => {
  if (!data || !data.consignment || !data.items) return null

  const { consignment, items } = data

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
      id="consignment-print-area"
      style={{
        width: '8.5in',
        maxWidth: '8.5in',
        margin: '0 auto',
        padding: '0.25in 0.5in 0.5in 0.5in',
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
            CONSIGNMENT RECORD
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

        {/* CUSTOMER + CONSIGNMENT INFO */}
        <div
          className="flex justify-between"
          style={{ marginBottom: '15px', fontSize: '11px' }}
        >
          <div style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>Consigned To:</strong>{' '}
              {consignment.customer?.name || consignment.customer_name || 'Customer'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Address:</strong>{' '}
              {consignment.customer?.address || '______________________'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Contact:</strong>{' '}
              {consignment.customer?.contact_number || '-'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>TIN:</strong>{' '}
              {consignment.customer?.tin || '______________________'}
            </p>
          </div>

          <div className="text-right" style={{ flex: '1' }}>
            <p style={{ margin: '3px 0' }}>
              <strong>Consignment No.:</strong> {consignment.consignment_number || '-'}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Period:</strong>{' '}
              {formatConsignmentPeriod(consignment.month, consignment.year)}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Date Created:</strong>{' '}
              {formatDate(consignment.created_at)}
            </p>
            <p style={{ margin: '3px 0' }}>
              <strong>Status:</strong>{' '}
              {consignment.status?.toUpperCase() || '-'}
            </p>
          </div>
        </div>

        {/* SUMMARY SECTION */}
        <div
          className="border-2 border-black p-3 mb-4"
          style={{ fontSize: '10px', marginBottom: '15px' }}
        >
          <h2 className="font-bold mb-2" style={{ fontSize: '12px', marginBottom: '8px' }}>
            SUMMARY
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p style={{ margin: '2px 0' }}>
                <strong>Previous Balance:</strong> {consignment.previous_balance_qty || 0} items
              </p>
              <p style={{ margin: '2px 0' }}>
                <strong>New Items Added:</strong> {consignment.new_items_qty || 0} items
              </p>
            </div>
            <div>
              <p style={{ margin: '2px 0' }}>
                <strong>Items Sold:</strong> {consignment.sold_qty || 0} items
              </p>
              <p style={{ margin: '2px 0' }}>
                <strong>Items Returned:</strong> {consignment.returned_qty || 0} items
              </p>
            </div>
            <div>
              <p style={{ margin: '2px 0' }}>
                <strong>Current Balance:</strong> {consignment.current_balance_qty || 0} items
              </p>
            </div>
            <div>
              <p style={{ margin: '2px 0' }}>
                <strong>Balance Due:</strong> {formatCurrency(consignment.balance_due || 0)}
              </p>
            </div>
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
            <tr style={{ backgroundColor: '#fff' }}>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '5%' }}
              >
                #
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '30%' }}
              >
                Product
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '8%' }}
              >
                Prev Bal
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '8%' }}
              >
                Added
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '8%' }}
              >
                Sold
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '8%' }}
              >
                Returned
              </th>
              <th
                className="border border-black p-2 text-center font-bold"
                style={{ width: '8%' }}
              >
                Current
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '12%' }}
              >
                Unit Price
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '13%' }}
              >
                Total Value
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((it: any, index: number) => (
              <tr key={it.id || index} className="border-b border-black">
                <td className="border border-black p-2 text-center">
                  {index + 1}
                </td>
                <td className="border border-black p-2 text-left">
                  {it.product?.name || '-'}
                  {it.batch_no && (
                    <div className="text-xs text-gray-600">
                      Batch: {it.batch_no}
                    </div>
                  )}
                </td>
                <td className="border border-black p-2 text-center">
                  {it.previous_balance || 0}
                </td>
                <td className="border border-black p-2 text-center">
                  {it.quantity_added || 0}
                </td>
                <td className="border border-black p-2 text-center">
                  {it.quantity_sold || 0}
                </td>
                <td className="border border-black p-2 text-center">
                  {it.quantity_returned || 0}
                </td>
                <td className="border border-black p-2 text-center font-semibold">
                  {it.current_balance || 0}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.unit_price || 0)}
                </td>
                <td className="border border-black p-2 text-right">
                  {formatCurrency(it.total_value || 0)}
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
              width: '300px',
              padding: '10px',
              fontSize: '11px'
            }}
          >
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Total Consigned Value:</span>
              <span>{formatCurrency(consignment.total_consigned_value || 0)}</span>
            </div>
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Total Sold Value:</span>
              <span>{formatCurrency(consignment.total_sold_value || 0)}</span>
            </div>
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Total Paid:</span>
              <span>{formatCurrency(consignment.total_paid || 0)}</span>
            </div>
            <div
              className="flex justify-between border-t border-black pt-2 mt-2 font-bold"
              style={{
                borderTop: '1px solid #000',
                paddingTop: '8px',
                marginTop: '8px'
              }}
            >
              <span>Balance Due:</span>
              <span>{formatCurrency(consignment.balance_due || 0)}</span>
            </div>
          </div>
        </div>

        {/* NOTES */}
        {consignment.notes && (
          <div
            className="border border-black p-3 mb-4"
            style={{ fontSize: '10px', marginBottom: '15px' }}
          >
            <p className="font-bold mb-1" style={{ marginBottom: '4px' }}>
              Notes:
            </p>
            <p>{consignment.notes}</p>
          </div>
        )}

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
            CONSIGNMENT AGREEMENT
          </p>
          <p style={{ margin: '3px 0' }}>
            Products are consigned to the customer and remain property of the company until sold or returned.
          </p>
        </div>
      </div>
    </div>
  )
}
