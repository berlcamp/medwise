'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { PER_PAGE } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { ProductStock } from '@/types'
import { useEffect, useState } from 'react'
import { AddModal } from './AddModal'
import { Filter } from './Filter'
import { List } from './List'

export default function Page() {
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({
    keyword: '',
    category: ''
  })

  const user = useAppSelector((state) => state.user.user)
  const dispatch = useAppDispatch()

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      dispatch(addList([])) // reset list

      const { data, count, error } = await supabase
        .from('products')
        .select(
          `
  id,
  name,
  unit,
  category,
  selling_price,
  product_stocks:product_stocks (branch_id,quantity, type,expiration_date)
`,
          { count: 'exact' }
        )
        .eq('type', 'for sale')
        // .eq('branch_id', selectedBranchId)
        .ilike('name', `%${filter.keyword}%`)
        .ilike('category', `%${filter.category}%`)
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
        .order('id', { ascending: false })

      if (error) {
        console.error('Error fetching products:', error)
      } else {
        console.log('xx', data)
        // calculate stock
        const formatted = (data || []).map((p) => {
          const stocks = (p.product_stocks as ProductStock[]) || []

          // Define today's date (ignore time for safety)
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          // Separate valid (not expired) and expired stocks
          const validStocks = stocks.filter(
            (s) =>
              s.branch_id === selectedBranchId &&
              (!s.expiration_date || new Date(s.expiration_date) > today)
          )
          const expiredStocks = stocks.filter(
            (s) =>
              s.branch_id === selectedBranchId &&
              s.expiration_date &&
              new Date(s.expiration_date) <= today
          )

          // Compute total quantity (excluding expired)
          const stock_qty = validStocks.reduce(
            (acc: number, s) =>
              s.type === 'in' ? acc + s.quantity : acc - s.quantity,
            0
          )

          // Compute total expired
          const total_expired = expiredStocks.reduce(
            (acc: number, s) => acc + s.quantity,
            0
          )

          return { ...p, stock_qty, total_expired }
        })

        dispatch(addList(formatted || []))
        setTotalCount(count || 0)
      }

      setLoading(false)
    }

    fetchData()
  }, [page, filter, dispatch, selectedBranchId])

  if (user?.type === 'user') {
    return <Notfoundpage />
  }

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Products</h1>
        {user?.type === 'super admin' && (
          <Button
            variant="blue"
            onClick={() => setModalAddOpen(true)}
            className="ml-auto"
          >
            Add Product
          </Button>
        )}
      </div>
      <Filter filter={filter} setFilter={setFilter} />
      <div className="app__content">
        <div className="mt-4 py-2 text-xs border-t border-gray-200 text-gray-500">
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

        <AddModal
          isOpen={modalAddOpen}
          onClose={() => setModalAddOpen(false)}
        />
      </div>
    </div>
  )
}
