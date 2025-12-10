/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { PaymentHistoryPrint } from '@/components/printables/PaymentHistoryPrint'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useAppDispatch } from '@/lib/redux/hook'
import { updateList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Printer, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'

interface Props {
  transaction: any
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export const ReceivePaymentModal = ({
  transaction,
  isOpen,
  onClose,
  onUpdated
}: Props) => {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [reference, setReference] = useState('')
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Cheque-specific fields
  const [chequeNumber, setChequeNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [chequeDate, setChequeDate] = useState('')

  const [payments, setPayments] = useState<any[]>([])
  const [totalPaid, setTotalPaid] = useState(0)
  const [balance, setBalance] = useState(0)
  const [printData, setPrintData] = useState<any>(null)

  const dispatch = useAppDispatch()

  // Load payments
  const loadPayments = async () => {
    const { data } = await supabase
      .from('transaction_payments')
      .select('*')
      .eq('transaction_id', transaction.id)
      .order('payment_date', { ascending: false })

    setPayments(data || [])

    const totalPaid = (data || []).reduce((sum, p) => sum + Number(p.amount), 0)

    const totalAmount = Number(transaction.total_amount || 0)
              const balance = totalAmount - totalPaid

              // Determine payment status based on totalPaid and balance
              let paymentStatus: 'Paid' | 'Partial' | 'Unpaid'
              
              if (balance <= 0) {
                paymentStatus = 'Paid'
                
              } else if (totalPaid > 0) {
                paymentStatus = 'Partial'
              } else {
                paymentStatus = 'Unpaid'
              }

              // Update Redux with the determined payment status
              dispatch(
                updateList({
                  ...transaction,
                  payment_status: paymentStatus,
                  id: transaction.id
                })
              )

    setTotalPaid(totalPaid)
    setBalance(Number(transaction.total_amount) - totalPaid)
  }

  useEffect(() => {
    if (isOpen) loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const savePayment = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Invalid amount')
      return
    }

    if (Number(amount) > balance) {
      toast.error('Payment cannot exceed remaining balance.')
      return
    }

    // Validate cheque fields if method is Cheque
    if (method === 'Cheque') {
      if (!chequeNumber.trim()) {
        toast.error('Please enter check number')
        return
      }
      if (!bankName.trim()) {
        toast.error('Please enter bank name')
        return
      }
      if (!chequeDate) {
        toast.error('Please select check date')
        return
      }
    }

    setLoading(true)

    // Prepare payment data
    const paymentData: any = {
      transaction_id: transaction.id,
      amount: Number(amount),
      payment_method: method,
      reference_number: method === 'Cheque' ? chequeNumber : (reference || null),
      remarks: method === 'Cheque' 
        ? JSON.stringify({
            cheque_number: chequeNumber,
            bank_name: bankName,
            cheque_date: chequeDate,
            amount: Number(amount)
          })
        : (remarks || null)
    }

    // If cheque date is today, we'll update payment status after saving
    const chequeDateObj = method === 'Cheque' ? new Date(chequeDate) : null
    const today = new Date()
    const isChequeDateToday = chequeDateObj && 
      chequeDateObj.toDateString() === today.toDateString()

    const { error } = await supabase.from('transaction_payments').insert(paymentData)

    if (error) {
      setLoading(false)
      toast.error('Error saving payment.')
      return
    }

    // Reload payments to get updated totalPaid
    await loadPayments()

    // If cheque date is today, update transaction payment status to Paid
    if (isChequeDateToday && method === 'Cheque') {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ payment_status: 'Paid' })
        .eq('id', transaction.id)

      if (!updateError) {
        dispatch(
          updateList({
            ...transaction,
            payment_status: 'Paid',
            id: transaction.id
          })
        )
      }
    }

    setLoading(false)
    toast.success('Payment recorded')
    
    // Pass totalPaid to onUpdated callback
    if (onUpdated) onUpdated()
    
    // Reset form
    setAmount('')
    setReference('')
    setRemarks('')
    setMethod('Cash')
    setChequeNumber('')
    setBankName('')
    setChequeDate('')
  }

  const removePayment = async (id: number) => {
    if (!confirm('Remove this payment?')) return

    const { error } = await supabase
      .from('transaction_payments')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to remove payment.')
      return
    }

    // Reload payments to get updated totalPaid
    await loadPayments()

    toast.success('Payment removed')
    
    // Pass totalPaid to onUpdated callback
    if (onUpdated) onUpdated()
  }

  const printPaymentHistory = async () => {
    // Clear print data first
    setPrintData(null)

    // Load customer data if customer_id exists
    let customerData = null
    if (transaction.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', transaction.customer_id)
        .single()

      if (!customerError && customer) {
        customerData = customer
      }
    }

    // Combine transaction data with customer
    const transactionWithCustomer = {
      ...transaction,
      customer: customerData
    }

    // Set print data after clearing
    setPrintData({ transaction: transactionWithCustomer, payments })

    // Wait for React to render the component
    setTimeout(() => {
      window.print()
      // Reset after print
      setTimeout(() => {
        setPrintData(null)
      }, 500)
    }, 300)
  }

  return (
    <Dialog open={isOpen} onClose={onClose} as="div" className="relative z-50">
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-600 opacity-80"
        aria-hidden="true"
      />

      {/* Centered panel container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="app__modal_dialog_panel">
          {/* Header */}
          <div className="app__modal_dialog_title_container">
            <DialogTitle className="text-base font-medium">
              Receive Payment
            </DialogTitle>
          </div>

          {/* Scrollable content */}
          <div className="app__modal_dialog_content ">
            <div className="flex gap-6">
              {/* Left form */}
              <div className="w-1/3 space-y-4 border-r pr-6">
                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">Amount</Label>
                  <Input
                    className="app__input_standard"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                  <p className="text-xs text-gray-500">
                    Balance: ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">
                    Payment Method
                  </Label>
                  <Select 
                    value={method} 
                    onValueChange={(value) => {
                      setMethod(value)
                      // Reset cheque fields when method changes
                      if (value !== 'Cheque') {
                        setChequeNumber('')
                        setBankName('')
                        setChequeDate('')
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="Maya">Maya</SelectItem>
                      <SelectItem value="GL">GL</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {method === 'Cheque' ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Check No.
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="Enter check number"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Bank Name
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Enter bank name"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Check Date
                      </Label>
                      <Input
                        className="app__input_standard"
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Reference Number
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Reference Number"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">Remarks</Label>
                      <Input
                        className="app__input_standard"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Remarks"
                      />
                    </div>
                  </>
                )}

                <Button
                  className="w-full mt-3"
                  onClick={savePayment}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Payment'}
                </Button>
              </div>

              {/* Right payment history table */}
              <div className="w-2/3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Payment History</h3>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={printPaymentHistory}
                    className="flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </Button>
                </div>
                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0">
                      <tr>
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Method</th>
                        <th className="p-2 border">Amount</th>
                        {(() => {
                          const hasChequePayment = payments.some((p) => p.payment_method === 'Cheque')
                          return hasChequePayment ? (
                            <>
                              <th className="p-2 border">Check No.</th>
                              <th className="p-2 border">Bank Name</th>
                              <th className="p-2 border">Check Date</th>
                            </>
                          ) : null
                        })()}
                        <th className="p-2 border">Ref #</th>
                        <th className="p-2 border w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const hasChequePayment = payments.some((p) => p.payment_method === 'Cheque')
                        const baseCols = 5 // Date, Method, Amount, Ref #, Action
                        const chequeCols = hasChequePayment ? 3 : 0 // Check No., Bank Name, Check Date
                        const totalCols = baseCols + chequeCols

                        if (payments.length === 0) {
                          return (
                            <tr>
                              <td
                                colSpan={totalCols}
                                className="text-center p-4 text-gray-500"
                              >
                                No payments yet
                              </td>
                            </tr>
                          )
                        }

                        return payments.map((p, i) => {
                          // Parse cheque details from remarks if payment method is Cheque
                          let chequeDetails = null
                          if (p.payment_method === 'Cheque' && p.remarks) {
                            try {
                              chequeDetails = JSON.parse(p.remarks)
                            } catch {
                              // If parsing fails, remarks might not be JSON
                            }
                          }

                          return (
                            <tr
                              key={p.id}
                              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                              <td className="p-2 border">
                                {new Date(p.payment_date).toLocaleString()}
                              </td>
                              <td className="p-2 border">{p.payment_method}</td>
                              <td className="p-2 border">
                                ₱{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              {hasChequePayment && (
                                <>
                                  <td className="p-2 border">
                                    {p.payment_method === 'Cheque' 
                                      ? (chequeDetails?.cheque_number || p.reference_number || '-')
                                      : '-'}
                                  </td>
                                  <td className="p-2 border">
                                    {p.payment_method === 'Cheque' 
                                      ? (chequeDetails?.bank_name || '-')
                                      : '-'}
                                  </td>
                                  <td className="p-2 border">
                                    {p.payment_method === 'Cheque' && chequeDetails?.cheque_date
                                      ? new Date(chequeDetails.cheque_date).toLocaleDateString()
                                      : '-'}
                                  </td>
                                </>
                              )}
                              <td className="p-2 border">
                                {p.payment_method !== 'Cheque' ? (p.reference_number || '-') : '-'}
                              </td>
                              <td className="p-2 border text-center">
                                <button
                                  onClick={() => removePayment(p.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm space-y-1">
                  <p>
                    Total Paid:{' '}
                    <b className="text-green-700">
                      ₱{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </b>
                  </p>
                  <p>
                    Remaining Balance:{' '}
                    <b className="text-red-600">₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </p>
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="app__modal_dialog_footer">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>

      {typeof window !== 'undefined' && createPortal(
        <PaymentHistoryPrint data={printData} />,
        document.body
      )}
    </Dialog>
  )
}
