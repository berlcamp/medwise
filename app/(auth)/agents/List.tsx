'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { Agent, RootState } from '@/types'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Avatar from 'react-avatar'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { AddModal } from './AddModal'
import { AgentDetailsModal } from './AgentDetailsModal'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)
  const [selectedItem, setSelectedItem] = useState<Agent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const handleView = (item: Agent) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleEdit = (item: Agent) => {
    setSelectedItem(item)
    setIsEditModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    const { error } = await supabase
      .from('agents')
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
    setIsDeleteModalOpen(false)
  }

  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Agent Name</th>
            <th className="app__th">Area</th>
            <th className="app__th">Contact</th>
            <th className="app__th">Vehicle Plate</th>
            <th className="app__th text-center">Status</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: Agent) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={item.name}
                    size="30"
                    round={true}
                    textSizeRatio={3}
                    className="shrink-0"
                  />
                  <span className="text-gray-800 font-medium">{item.name}</span>
                </div>
              </td>
              <td className="app__td">{item.area || '-'}</td>
              <td className="app__td">{item.contact_number || '-'}</td>
              <td className="app__td">{item.vehicle_plate_number || '-'}</td>
              <td className="app__td text-center">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {item.status?.toUpperCase() || '-'}
                </span>
              </td>
              <td className="app__td text-center">
                <div className="flex justify-center gap-2">
                  <Button
                    variant="blue"
                    size="xs"
                    onClick={() => handleView(item)}
                  >
                    Manage
                  </Button>
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
                    onClick={() => {
                      setSelectedItem(item)
                      setIsDeleteModalOpen(true)
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

      {selectedItem && (
        <>
          <AgentDetailsModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              window.location.reload()
            }}
            agent={selectedItem}
          />
          <AddModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedItem(null)
            }}
            editData={selectedItem}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedItem(null)
            }}
            onConfirm={handleDelete}
            message="Are you sure you want to delete this agent?"
          />
        </>
      )}
    </div>
  )
}
