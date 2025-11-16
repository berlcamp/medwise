'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils'
import { RootState, Service } from '@/types'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { AddModal } from './AddModal'

type ItemType = Service
const table = 'services'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null)

  // ✅ Group services by category and preserve parent → child order
  const grouped = useMemo(() => {
    const categoriesMap: Record<
      string,
      { id: number; name: string; parent_id: number | null }
    > = {}
    const servicesByCategory: Record<number, ItemType[]> = {}

    list.forEach((item) => {
      const cat = item.category
      if (!cat) return

      categoriesMap[cat.id] = cat
      if (!servicesByCategory[cat.id]) servicesByCategory[cat.id] = []
      servicesByCategory[cat.id].push(item)
    })

    // Sort by hierarchy: parents first, then children
    const sortedCategories = Object.values(categoriesMap).sort(
      (a, b) => (a.parent_id ?? 0) - (b.parent_id ?? 0)
    )

    return { sortedCategories, servicesByCategory }
  }, [list])

  const handleDeleteConfirmation = (item: ItemType) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleEdit = (item: ItemType) => {
    setSelectedItem(item)
    setModalAddOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', selectedItem.id)
    if (error) {
      if (error.code === '23503')
        toast.error('Selected record cannot be deleted.')
    } else {
      toast.success('Successfully deleted!')
      dispatch(deleteItem(selectedItem))
      setIsModalOpen(false)
    }
  }

  return (
    <div className="mt-4">
      {grouped.sortedCategories.map((cat) => (
        <div key={cat.id} className="mb-8">
          <h2
            className={`text-lg font-semibold ${
              cat.parent_id ? 'ml-6 text-gray-700' : 'text-gray-900'
            }`}
          >
            {cat.name}
          </h2>
          <table className="app__table mt-2 ml-6">
            <thead className="app__thead">
              <tr>
                <th className="app__th">Procedure Name</th>
                <th className="app__th">Per Session Price</th>
                <th className="app__th"></th>
              </tr>
            </thead>
            <tbody>
              {(grouped.servicesByCategory[cat.id] || []).map((item) => (
                <tr key={item.id} className="app__tr">
                  <td className="app__td">{item.name}</td>
                  <td className="app__td">
                    {formatMoney(item.base_price || 0)}
                  </td>
                  <td className="app__td text-center">
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
        </div>
      ))}

      {/* Modals */}
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
