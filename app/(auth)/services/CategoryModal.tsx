'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { ServiceCategory } from '@/types'
import { useEffect, useState } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CategoryModal({ isOpen, onClose }: ModalProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [selectedParent, setSelectedParent] = useState<number | null>(null)

  // Fetch categories and subcategories (same table)
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      .order('name', { ascending: true })

    if (!error && data) {
      setCategories(data)
    }
  }

  useEffect(() => {
    if (isOpen) fetchCategories()
  }, [isOpen])

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    setLoading(true)
    const { error } = await supabase.from('service_categories').insert({
      name: newCategory.trim(),
      org_id: process.env.NEXT_PUBLIC_ORG_ID,
      parent_id: null
    })
    if (!error) {
      setNewCategory('')
      await fetchCategories()
    }
    setLoading(false)
  }

  const handleAddSubcategory = async (parentId: number) => {
    if (!newSubcategory.trim()) return
    setLoading(true)
    const { error } = await supabase.from('service_categories').insert({
      name: newSubcategory.trim(),
      org_id: process.env.NEXT_PUBLIC_ORG_ID,
      parent_id: parentId
    })
    if (!error) {
      setNewSubcategory('')
      setSelectedParent(null)
      await fetchCategories()
    }
    setLoading(false)
  }

  const mainCategories = categories.filter((c) => !c.parent_id)
  const subcategories = (parentId: number) =>
    categories.filter((c) => c.parent_id === parentId)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new main category */}
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button onClick={handleAddCategory} disabled={loading}>
              Add
            </Button>
          </div>

          {/* Category List */}
          <div className="border-t pt-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {mainCategories.map((cat) => (
              <div key={cat.id} className="border-b pb-2">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-sm">{cat.name}</div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      setSelectedParent(
                        selectedParent === cat.id ? null : cat.id
                      )
                    }
                  >
                    + Subcategory
                  </Button>
                </div>

                {/* Subcategories */}
                <ul className="ml-4 text-sm font-medium mt-1">
                  {subcategories(cat.id).map((sub) => (
                    <li key={sub.id}>• {sub.name}</li>
                  ))}
                </ul>

                {/* Add subcategory input */}
                {selectedParent === cat.id && (
                  <div className="flex gap-2 mt-2 ml-4">
                    <Input
                      placeholder="Subcategory name"
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                    />
                    <Button
                      onClick={() => handleAddSubcategory(cat.id)}
                      disabled={loading}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
