'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { Product, RootState } from '@/types'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { AddModal } from './AddModal'

// view table
const table = 'products'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)
  const user = useAppSelector((state) => state.user.user)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)

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
            <th className="app__th">Category</th>
            <th className="app__th text-right">Price</th>
            <th className="app__th text-right">Stock</th>
            <th className="app__th text-right">Expired Stocks</th>
            <th className="app__th"> </th>
          </tr>
        </thead>
        <tbody>
          {list.map((item) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                {item.name} ({item.unit})
              </td>
              <td className="app__td">
                {' '}
                {typeof item.category === 'object'
                  ? item.category?.name
                  : item.category || '-'}
              </td>
              <td className="app__td text-right">
                {formatMoney(item.selling_price)}
              </td>
              <td
                className={`app__td text-right ${
                  item.total_remaining <= (item.reorder_point || 0)
                    ? 'text-red-500 font-semibold'
                    : ''
                }`}
              >
                {item.stock_qty}
              </td>
              <td className="app__td text-right">{item.total_expired}</td>
              <td className="app__td">
                {user?.type === 'super admin' && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        setSelectedItem(item)
                        setModalAddOpen(true)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
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
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this product?"
      />

      <AddModal
        isOpen={modalAddOpen}
        editData={selectedItem}
        onClose={() => setModalAddOpen(false)}
      />
    </div>
  )
}
