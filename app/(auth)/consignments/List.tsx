/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { Button } from '@/components/ui/button'
import { RootState, Transaction } from '@/types'
import { format } from 'date-fns'
import { useState } from 'react'
import Avatar from 'react-avatar'
import { useSelector } from 'react-redux'
import { PaymentStatusDropdown } from './PaymentStatusDropdown'
import { ReturnsModal } from './ReturnsModal'
import { TransactionDetailsModal } from './TransactionDetailsModal'

export const List = () => {
  const list = useSelector((state: RootState) => state.list.value)
  const [selectedItem, setSelectedItem] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)

  const handleView = (item: Transaction) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleReturn = (item: Transaction) => {
    setSelectedItem(item)
    setReturnModalOpen(true)
  }

  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Transaction No.</th>
            <th className="app__th">Customer</th>
            <th className="app__th">Payment Method</th>
            <th className="app__th text-right">Amount</th>
            <th className="app__th text-right">Payment Status</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: Transaction) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div>
                  <div className="font-semibold">{item.transaction_number}</div>
                  <div className="text-xs text-gray-500">
                    {item.created_at &&
                      format(new Date(item.created_at), 'MMMM dd, yyyy')}
                  </div>
                </div>
              </td>
              <td className="app__td">
                {item.customer ? (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={item.customer.name}
                      size="30"
                      round={true}
                      textSizeRatio={3}
                      className="shrink-0"
                      // color="#2a4f6e" // denim base color
                    />
                    <span className="text-gray-800 font-medium">
                      {item.customer.name}
                    </span>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td className="app__td space-x-2">
                <span>{item.payment_type}</span>
                {item.payment_type === 'GL' && <span>({item.gl_number})</span>}
              </td>
              <td className="app__td text-right">
                ₱{Number(item.total_amount).toLocaleString()}
              </td>
              <td className="app__td text-right">
                <PaymentStatusDropdown
                  transaction={item}
                  onUpdated={() => {
                    // optional: refresh list after update
                  }}
                />
              </td>
              <td className="app__td text-center space-x-2">
                <Button
                  variant="blue"
                  size="xs"
                  className=""
                  onClick={() => handleReturn(item)}
                >
                  Update Quantities
                </Button>
                <Button
                  variant="blue"
                  size="xs"
                  className=""
                  onClick={() => handleView(item)}
                >
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedItem && (
        <>
          <TransactionDetailsModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            transaction={selectedItem}
          />
          <ReturnsModal
            isOpen={returnModalOpen}
            onClose={() => setReturnModalOpen(false)}
            transaction={selectedItem}
          />
        </>
      )}
    </div>
  )
}
