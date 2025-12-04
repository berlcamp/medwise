'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Customer, RootState, Transaction, TransactionItem } from '@/types'
import { format } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Avatar from 'react-avatar'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { AddModal } from './AddModal'
import PrintSOAButton from './PrintSOAButton'

type ItemType = Customer
const table = 'customers'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)
  const user = useAppSelector((state) => state.user.user)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null)
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)

  // 🧾 View Customer Transactions
  const handleViewTransactions = async (customer: Customer) => {
    setSelectedItem(customer)
    setTransactionsModalOpen(true)
    setLoadingTx(true)

    const { data, error } = await supabase
      .from('transactions')
      .select(
        `
        id,
        org_id,
        customer_name,
        total_amount,
        status,
        created_at,
        branch_id,
        customer_id,
        reference_number,
        payment_type,
        transaction_number,
        transaction_items:transaction_items (
          id,
          product_id,
          quantity,
          price,
          total,
          product:product_id( name )
        )
      `
      )
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast.error('Failed to fetch transactions')
    } else {
      setTransactions(data as unknown as Transaction[])
    }

    setLoadingTx(false)
  }

  // 🗑️ Confirm Delete
  const handleDeleteConfirmation = (item: ItemType) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleEdit = (item: ItemType) => {
    setSelectedItem(item)
    setModalAddOpen(true)
  }

  const handleDelete = async () => {
    if (selectedItem) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', selectedItem.id)

      if (error) {
        if (error.code === '23503') {
          toast.error(`Selected record cannot be deleted.`)
        }
      } else {
        toast.success('Successfully deleted!')
        dispatch(deleteItem(selectedItem))
        setIsModalOpen(false)
      }
    }
  }

  return (
    <div className="overflow-x-none">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Customer Name</th>
            <th className="app__th">Contact</th>
            <th className="app__th">Address</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: ItemType) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td space-y-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={item.name}
                      size="30"
                      round={true}
                      textSizeRatio={3}
                      className="shrink-0"
                    />
                    <span className="text-gray-800 font-medium">
                      {item.name}
                    </span>
                  </div>
                </div>
              </td>
              <td className="app__td">{item.contact_number}</td>
              <td className="app__td">{item.address}</td>
              <td className="app__td text-center">
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleViewTransactions(item)}
                  >
                    View Transactions
                  </Button>
                  {/* ⭐ ADD PRINT SOA BUTTON HERE */}
                  {(user?.type === 'super admin' ||
                    user?.type === 'bulk' ||
                    user?.type === 'admin') && (
                    <>
                      <PrintSOAButton customer={item} />
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-red-500"
                    onClick={() => handleDeleteConfirmation(item)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🧾 Transactions Modal */}
      <Dialog
        open={transactionsModalOpen}
        onOpenChange={setTransactionsModalOpen}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Transactions — {selectedItem?.name || 'Customer'}
            </DialogTitle>
          </DialogHeader>

          {loadingTx ? (
            <p>Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions found.</p>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border rounded-lg p-3 shadow-sm bg-white"
                >
                  <div className="flex justify-between text-sm border-b pb-2 mb-2">
                    <div>
                      <p>
                        <strong>Ref #:</strong>{' '}
                        {tx.reference_number || '(none)'}
                      </p>
                      <p>
                        <strong>Date:</strong>{' '}
                        {tx.created_at &&
                          format(new Date(tx.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p>
                        <strong>Total:</strong>{' '}
                        {formatMoney(tx.total_amount || 0)}
                      </p>
                      <p>
                        <strong>Payment:</strong> {tx.payment_type || '-'}
                      </p>
                    </div>
                  </div>

                  <table className="w-full text-xs border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-2">Item</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Price</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tx.transaction_items?.map((it: TransactionItem) => (
                        <tr key={it.id} className="border-t">
                          <td className="text-center capitalize">
                            {it.product?.name}
                          </td>
                          <td className="text-right">{it.quantity}</td>
                          <td className="text-right">
                            {formatMoney(it.price)}
                          </td>
                          <td className="text-right">
                            {formatMoney(it.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setTransactionsModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this customer?"
      />

      {/* Add/Edit Modal */}
      <AddModal
        isOpen={modalAddOpen}
        editData={selectedItem}
        onClose={() => setModalAddOpen(false)}
      />
    </div>
  )
}
