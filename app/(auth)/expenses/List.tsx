'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { Expense, RootState } from '@/types'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { AddModal } from './AddModal'

// Always update this on other pages
type ItemType = Expense
const table = 'expenses'

const money = (n: unknown) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export const List = ({}) => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalAddOpen, setModalAddOpen] = useState(false)

  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null)

  // Handle opening the confirmation modal for deleting an expense
  const handleDeleteConfirmation = (item: ItemType) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleEdit = (item: ItemType) => {
    setSelectedItem(item)
    setModalAddOpen(true)
  }

  // Delete Expense
  const handleDelete = async () => {
    if (selectedItem) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', selectedItem.id)

      if (error) {
        toast.error('Selected record cannot be deleted.')
      } else {
        toast.success('Successfully deleted!')

        // delete item to Redux
        dispatch(deleteItem(selectedItem))
        setIsModalOpen(false)
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Date</th>
            <th className="app__th">Category</th>
            <th className="app__th">Paid To</th>
            <th className="app__th">Description</th>
            <th className="app__th">Payment Method</th>
            <th className="app__th">Reference / OR No.</th>
            <th className="app__th text-right">Amount</th>
            <th className="app__th"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: ItemType) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                {item.expense_date
                  ? format(parseISO(item.expense_date), 'MMM dd, yyyy')
                  : '-'}
              </td>
              <td className="app__td">{item.category || '-'}</td>
              <td className="app__td">{item.payee || '-'}</td>
              <td className="app__td">{item.description || '-'}</td>
              <td className="app__td">{item.payment_method || '-'}</td>
              <td className="app__td">{item.reference_number || '-'}</td>
              <td className="app__td text-right font-medium">
                ₱{money(item.amount)}
              </td>
              <td className="app__td">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleEdit(item)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
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

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this?"
      />
      <AddModal
        isOpen={modalAddOpen}
        editData={selectedItem}
        onClose={() => setModalAddOpen(false)}
      />
    </div>
  )
}
