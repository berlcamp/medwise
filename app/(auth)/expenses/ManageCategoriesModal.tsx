'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import {
  EXPENSE_CATEGORIES_TABLE,
  fetchExpenseCategories
} from '@/lib/utils/expenseCategories'
import { ExpenseCategory } from '@/types'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called after any change so callers can refresh their category lists. */
  onChanged: () => void
}

/**
 * Add, rename and remove expense categories.
 *
 * Expenses store the category NAME, so a rename is cascaded to existing
 * expense rows to keep reports grouped correctly, and a delete leaves
 * historical expenses untouched — the name simply stops being offered.
 */
export const ManageCategoriesModal = ({
  isOpen,
  onClose,
  onChanged
}: ModalProps) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null)
  const [deleteUsageCount, setDeleteUsageCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setCategories(await fetchExpenseCategories())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setNewName('')
      setEditingId(null)
      setEditingName('')
      load()
    }
  }, [isOpen, load])

  // Case-insensitive duplicate guard, mirroring the unique index on the table.
  const isDuplicate = (name: string, ignoreId?: number) =>
    categories.some(
      (c) =>
        c.id !== ignoreId && c.name.toLowerCase() === name.trim().toLowerCase()
    )

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (isDuplicate(name)) {
      toast.error('That category already exists.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from(EXPENSE_CATEGORIES_TABLE).insert([
      {
        name,
        org_id: process.env.NEXT_PUBLIC_ORG_ID
      }
    ])
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error('Failed to add category')
      return
    }

    toast.success('Category added!')
    setNewName('')
    await load()
    onChanged()
  }

  const handleRename = async (category: ExpenseCategory) => {
    const name = editingName.trim()
    if (!name) return
    if (name === category.name) {
      setEditingId(null)
      return
    }
    if (isDuplicate(name, category.id)) {
      toast.error('That category already exists.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from(EXPENSE_CATEGORIES_TABLE)
      .update({ name })
      .eq('id', category.id)

    if (error) {
      setSaving(false)
      console.error(error)
      toast.error('Failed to rename category')
      return
    }

    // Expenses store the category name, so carry the rename across to them.
    const { error: cascadeError } = await supabase
      .from('expenses')
      .update({ category: name })
      .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      .eq('category', category.name)

    setSaving(false)

    if (cascadeError) {
      console.error(cascadeError)
      toast.error(
        'Category renamed, but existing expenses kept the old name. Please try again.'
      )
    } else {
      toast.success('Category renamed!')
    }

    setEditingId(null)
    setEditingName('')
    await load()
    onChanged()
  }

  // Show how many expenses use a category before removing it.
  const handleDeleteConfirmation = async (category: ExpenseCategory) => {
    const { count, error } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      .eq('category', category.name)

    if (error) console.error(error)

    setDeleteUsageCount(count || 0)
    setDeleteTarget(category)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const { error } = await supabase
      .from(EXPENSE_CATEGORIES_TABLE)
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      console.error(error)
      toast.error('Failed to remove category')
      return
    }

    toast.success('Category removed!')
    setDeleteTarget(null)
    await load()
    onChanged()
  }

  return (
    <>
      <Dialog
        open={isOpen}
        as="div"
        className="relative z-40 focus:outline-none"
        onClose={() => {}}
      >
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-600 opacity-80"
          aria-hidden="true"
        />

        {/* Centered panel container */}
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <DialogPanel transition className="app__modal_dialog_panel_sm">
            {/* Sticky Header */}
            <div className="app__modal_dialog_title_container">
              <DialogTitle as="h3" className="text-base font-medium">
                Expense Categories
              </DialogTitle>
            </div>

            {/* Scrollable Content */}
            <div className="app__modal_dialog_content">
              {/* Add new */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    New Category
                  </label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAdd()
                      }
                    }}
                    placeholder="Ex. Fuel & Gas"
                  />
                </div>
                <Button
                  type="button"
                  variant="green"
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Existing list */}
              <div className="mt-4 border-t pt-3">
                {loading ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </div>
                ) : categories.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">
                    No categories yet. Add your first one above.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {categories.map((category) => (
                      <li
                        key={category.id}
                        className="flex items-center gap-2 py-2"
                      >
                        {editingId === category.id ? (
                          <>
                            <Input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleRename(category)
                                }
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="xs"
                              variant="green"
                              disabled={saving}
                              onClick={() => handleRename(category)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-700">
                              {category.name}
                            </span>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setEditingId(category.id)
                                setEditingName(category.name)
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="text-red-500"
                              onClick={() => handleDeleteConfirmation(category)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="app__modal_dialog_footer">
                <Button type="button" onClick={onClose} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={
          <div className="text-sm text-gray-700">
            <p>
              Remove <span className="font-semibold">{deleteTarget?.name}</span>{' '}
              from the category list?
            </p>
            {deleteUsageCount > 0 && (
              <p className="mt-2 text-amber-700">
                {deleteUsageCount} existing expense
                {deleteUsageCount === 1 ? '' : 's'} use this category. They will
                keep the name and stay in your reports — it just won&apos;t be
                selectable for new expenses.
              </p>
            )}
          </div>
        }
      />
    </>
  )
}
