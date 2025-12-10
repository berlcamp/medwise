'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { PER_PAGE } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Filter } from './Filter'
import { List } from './List'
import { AddModal } from './AddModal'


export default function Page() {
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({
    keyword: ''
  })
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  useEffect(() => {
    let isMounted = true
    dispatch(addList([]))

    const fetchData = async () => {
      setLoading(true)
      let query = supabase
        .from('agents')
        .select('*', { count: 'exact' })
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .eq('branch_id', selectedBranchId)
        .order('id', { ascending: false })

      // Apply name filter if provided
      if (filter.keyword && filter.keyword.trim() !== '') {
        query = query.ilike('name', `%${filter.keyword}%`)
      }

      if (!filter.keyword) {
        query = query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
      }

      const { data, count, error } = await query

      if (!isMounted) return

      if (error) console.error(error)
      else {
        dispatch(addList(data))
        setTotalCount(count || 0)
      }

      setLoading(false)
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [page, filter, dispatch, selectedBranchId])

  if (user?.type === 'user' || user?.type === 'cashier') return <Notfoundpage />

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Agents</h1>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add Agent
          </Button>
          <Link href="/agent">
            <Button variant="green" size="sm">
              + New Agent Assignment
            </Button>
          </Link>
        </div>
      </div>
      <Filter filter={filter} setFilter={setFilter} />
      <div className="app__content">
        <div className="py-2 text-xs text-gray-500">
          Showing {Math.min((page - 1) * PER_PAGE + 1, totalCount)} to{' '}
          {Math.min(page * PER_PAGE, totalCount)} of {totalCount} results
        </div>

        <List />

        {loading && <LoadingSkeleton />}

        {totalCount === 0 && !loading && (
          <div className="mt-4 flex justify-center items-center space-x-2">
            No records found.
          </div>
        )}

        {totalCount > 0 && totalCount > PER_PAGE && (
          <div className="mt-4 text-xs flex justify-center items-center space-x-2">
            <Button
              size="xs"
              variant="blue"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              {'<<'}
            </Button>
            <p>
              Page {page} of {Math.ceil(totalCount / PER_PAGE)}
            </p>
            <Button
              size="xs"
              variant="blue"
              onClick={() => setPage(page + 1)}
              disabled={page * PER_PAGE >= totalCount}
            >
              {'>>'}
            </Button>
          </div>
        )}
      </div>

      <AddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}
