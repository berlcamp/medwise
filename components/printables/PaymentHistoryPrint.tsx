/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { format } from 'date-fns'

export const PaymentHistoryPrint = ({ data }: { data: any }) => {
  if (!data) return null

  const { transaction, payments } = data

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

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
  const balance = Number(transaction.total_amount || 0) - totalPaid

  return (
    <div
      className="hidden print:block"
      id="payment-history-print-area"
      style={{
        width: '8.5in',
        maxWidth: '8.5in',
        margin: '0 auto',
        padding: '0.25in 0.5in 0.5in 0.5in',
        fontSize: '12px',
        lineHeight: '1.4',
        color: '#000',
        backgroundColor: '#fff',
        pageBreakBefore: 'avoid'
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
            PAYMENT HISTORY
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

        {/* TRANSACTION INFO */}
        <div
          className="flex justify-between"
          style={{ marginBottom: '20px', fontSize: '12px' }}
        >
          <div style={{ flex: '1' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Customer:</strong>{' '}
              {transaction.customer?.name || transaction.customer_name || 'Walk-in Customer'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Address:</strong>{' '}
              {transaction.customer?.address || '-'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>TIN:</strong>{' '}
              {transaction.customer?.tin || '_______________________________'}
            </p>
          </div>

          <div className="text-right" style={{ flex: '1' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Transaction No.:</strong> {transaction.transaction_number}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Date:</strong>{' '}
              {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Total Amount:</strong> {formatCurrency(transaction.total_amount)}
            </p>
          </div>
        </div>

        {/* PAYMENTS TABLE */}
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
            <tr style={{ backgroundColor: '#fff' }}>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '15%' }}
              >
                Date
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '20%' }}
              >
                Payment Method
              </th>
              <th
                className="border border-black p-2 text-right font-bold"
                style={{ width: '20%' }}
              >
                Amount
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '25%' }}
              >
                Reference/Check No.
              </th>
              <th
                className="border border-black p-2 text-left font-bold"
                style={{ width: '20%' }}
              >
                Bank Name
              </th>
            </tr>
          </thead>

          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-black p-2 text-center">
                  No payments recorded
                </td>
              </tr>
            ) : (
              payments.map((payment: any) => {
                let chequeDetails: any = null
                if (payment.payment_method === 'Cheque' && payment.remarks) {
                  try {
                    chequeDetails = JSON.parse(payment.remarks)
                  } catch {
                    // If parsing fails, use reference_number
                  }
                }

                return (
                  <tr
                    key={payment.id}
                    className="border-b border-black"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    <td className="border border-black p-2 text-left">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="border border-black p-2 text-left">
                      {payment.payment_method || '-'}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="border border-black p-2 text-left">
                      {payment.payment_method === 'Cheque'
                        ? (chequeDetails?.cheque_number || payment.reference_number || '-')
                        : (payment.reference_number || '-')}
                    </td>
                    <td className="border border-black p-2 text-left">
                      {payment.payment_method === 'Cheque'
                        ? (chequeDetails?.bank_name || '-')
                        : '-'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* SUMMARY */}
        <div
          className="flex justify-end"
          style={{ marginBottom: '25px', fontSize: '12px' }}
        >
          <div
            className="border-2 border-black"
            style={{
              width: '300px',
              padding: '10px',
              fontSize: '12px'
            }}
          >
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Total Amount:</span>
              <span className="font-semibold">
                {formatCurrency(transaction.total_amount)}
              </span>
            </div>
            <div
              className="flex justify-between"
              style={{ marginBottom: '5px' }}
            >
              <span>Total Paid:</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(totalPaid)}
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
              <span>Balance:</span>
              <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(balance)}
              </span>
            </div>
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
          <p style={{ margin: '4px 0' }}>Thank you!</p>
        </div>
      </div>
    </div>
  )
}
