'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { ProductStock, RootState } from '@/types'
import { format, isBefore, parseISO } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'

// view table
const table = 'product_stocks'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [selectedItem, setSelectedItem] = useState<ProductStock | null>(null)

  const handleDelete = async () => {
    if (!selectedItem) return
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', selectedItem.id)
    if (error) {
      if (error.code === '23503')
        toast.error('Selected record cannot be deleted.')
      else toast.error(error.message)
      return
    }
    toast.success('Successfully deleted!')
    dispatch(deleteItem(selectedItem))
    setIsModalOpen(false)
  }

  return (
    <div className="overflow-x-none">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Product Name</th>
            <th className="app__th">Transaction Date</th>
            <th className="app__th">Type</th>
            <th className="app__th">Quantity</th>
            <th className="app__th">Remarks</th>
            <th className="app__th"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: ProductStock) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div className="font-semibold">{item.product?.name}</div>
                <div className="text-xs">({item.product?.category})</div>

                {item.expiration_date &&
                  (() => {
                    const expDate = parseISO(item.expiration_date)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)

                    const isExpired = isBefore(expDate, today)

                    const formattedDate = format(expDate, 'MMM dd, yyyy')
                    // Example: Jan 05, 2025

                    return (
                      <div
                        className={`text-xs ${
                          isExpired
                            ? 'text-red-600 font-semibold'
                            : 'text-gray-600'
                        }`}
                      >
                        Expiration: {formattedDate}
                        {isExpired && (
                          <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">
                            Expired
                          </span>
                        )}
                      </div>
                    )
                  })()}
              </td>

              <td className="app__td">{item.transaction_date}</td>
              <td className="app__td uppercase">
                {item.type === 'in' ? (
                  <Badge variant="green">{item.type}</Badge>
                ) : (
                  <Badge variant="blue">{item.type}</Badge>
                )}
              </td>
              <td className="app__td">{item.quantity}</td>
              <td className="app__td">{item.remarks}</td>
              <td className="app__td">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-red-500"
                    onClick={() => {
                      setSelectedItem(item)
                      setIsModalOpen(true)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this?"
      />
    </div>
  )
}
