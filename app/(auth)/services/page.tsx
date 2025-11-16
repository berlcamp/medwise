'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { AddModal } from './AddModal'
import { CategoryModal } from './CategoryModal'
import { Filter } from './Filter'
import { List } from './List'

export default function Page() {
  const [loading, setLoading] = useState(false)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [openCategoryModal, setOpenCategoryModal] = useState(false)
  const [filter, setFilter] = useState('')

  const user = useAppSelector((state) => state.user.user)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      dispatch(addList([]))

      const { data, error } = await supabase
        .from('services')
        .select('*, category:category_id(id, name, parent_id)')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .ilike('name', `%${filter}%`)
        .order('category_id', { ascending: true })

      if (error) console.error(error)
      else dispatch(addList(data))

      setLoading(false)
    }

    fetchData()
  }, [filter, dispatch])

  if (user?.type === 'user') return <Notfoundpage />

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Procedures</h1>
        <div className="flex gap-2 ml-auto">
          <Button onClick={() => setOpenCategoryModal(true)} variant="outline">
            Manage Categories
          </Button>
          <Button onClick={() => setModalAddOpen(true)}>Add Procedure</Button>
        </div>
      </div>

      <div className="app__content">
        <Filter filter={filter} setFilter={setFilter} />

        {loading && <LoadingSkeleton />}

        {!loading && <List />}

        {!loading && (
          <AddModal
            isOpen={modalAddOpen}
            onClose={() => setModalAddOpen(false)}
          />
        )}
        <CategoryModal
          isOpen={openCategoryModal}
          onClose={() => setOpenCategoryModal(false)}
        />
      </div>
    </div>
  )
}
