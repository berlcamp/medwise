/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

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
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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

  const [payments, setPayments] = useState<any[]>([])
  const [totalPaid, setTotalPaid] = useState(0)
  const [balance, setBalance] = useState(0)

  // Load payments
  const loadPayments = async () => {
    const { data } = await supabase
      .from('transaction_payments')
      .select('*')
      .eq('transaction_id', transaction.id)
      .order('payment_date', { ascending: false })

    setPayments(data || [])

    const total = (data || []).reduce((sum, p) => sum + Number(p.amount), 0)
    setTotalPaid(total)
    setBalance(Number(transaction.total_amount) - total)
  }

  useEffect(() => {
    if (isOpen) loadPayments()
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

    setLoading(true)

    const { error } = await supabase.from('transaction_payments').insert({
      transaction_id: transaction.id,
      amount: Number(amount),
      payment_method: method,
      reference_number: reference || null,
      remarks: remarks || null
    })

    setLoading(false)

    if (error) {
      toast.error('Error saving payment.')
      return
    }

    toast.success('Payment recorded')
    if (onUpdated) onUpdated()
    setAmount('')
    setReference('')
    setRemarks('')
    setMethod('Cash')
    loadPayments()
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

    toast.success('Payment removed')
    if (onUpdated) onUpdated()
    loadPayments()
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
                    Balance: ₱{balance.toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">
                    Payment Method
                  </Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="Maya">Maya</SelectItem>
                      <SelectItem value="GL">GL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                <h3 className="font-semibold mb-2">Payment History</h3>
                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0">
                      <tr>
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Method</th>
                        <th className="p-2 border">Amount</th>
                        <th className="p-2 border">Ref #</th>
                        <th className="p-2 border w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center p-4 text-gray-500"
                          >
                            No payments yet
                          </td>
                        </tr>
                      ) : (
                        payments.map((p, i) => (
                          <tr
                            key={p.id}
                            className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          >
                            <td className="p-2 border">
                              {new Date(p.payment_date).toLocaleString()}
                            </td>
                            <td className="p-2 border">{p.payment_method}</td>
                            <td className="p-2 border">
                              ₱{Number(p.amount).toLocaleString()}
                            </td>
                            <td className="p-2 border">
                              {p.reference_number || '-'}
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm space-y-1">
                  <p>
                    Total Paid:{' '}
                    <b className="text-green-700">
                      ₱{totalPaid.toLocaleString()}
                    </b>
                  </p>
                  <p>
                    Remaining Balance:{' '}
                    <b className="text-red-600">₱{balance.toLocaleString()}</b>
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
    </Dialog>
  )
}
