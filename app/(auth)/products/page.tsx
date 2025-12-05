'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { PER_PAGE } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { ProductStock } from '@/types'
import { isAfter, isBefore, isEqual, startOfToday } from 'date-fns'
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
    let isMounted = true

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
  gl_percent,
  category,
  selling_price,
  product_stocks:product_stocks (branch_id,remaining_quantity, type,expiration_date)
`,
          { count: 'exact' }
        )
        .eq('type', 'for sale')
        // .eq('branch_id', selectedBranchId)
        .ilike('name', `%${filter.keyword}%`)
        .ilike('category', `%${filter.category}%`)
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
        .order('id', { ascending: false })

      // Only update state if component is still mounted
      if (!isMounted) return

      if (error) {
        console.error('Error fetching products:', error)
      } else {
        console.log('xx', data)
        // calculate stock
        const formatted = (data || []).map((p) => {
          const stocks = (p.product_stocks as ProductStock[]) || []

          // Define today's date (ignore time for safety)
          const today = startOfToday()

          const validStocks = stocks.filter((s) => {
            if (s.branch_id !== selectedBranchId) return false

            // If no expiration date → treat as valid
            if (!s.expiration_date) return true

            const exp = new Date(s.expiration_date)
            return isAfter(exp, today) // exp > today
          })

          const expiredStocks = stocks.filter((s) => {
            if (s.branch_id !== selectedBranchId) return false

            if (!s.expiration_date) return false

            const exp = new Date(s.expiration_date)
            return isBefore(exp, today) || isEqual(exp, today) // exp <= today
          })

          // Compute total quantity (excluding expired)
          const stock_qty = validStocks.reduce(
            (acc: number, s) =>
              s.type === 'in'
                ? acc + s.remaining_quantity
                : acc - s.remaining_quantity,
            0
          )

          // Compute total expired
          const total_expired = expiredStocks.reduce(
            (acc: number, s) => acc + s.remaining_quantity,
            0
          )

          return { ...p, stock_qty, total_expired }
        })
        console.log('formatted', formatted)
        dispatch(addList(formatted || []))
        setTotalCount(count || 0)
      }

      setLoading(false)
    }

    fetchData()

    // Cleanup function
    return () => {
      isMounted = false
    }
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
            variant="green"
            onClick={() => setModalAddOpen(true)}
            className="ml-auto"
            size="xs"
          >
            Add Product
          </Button>
        )}
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

        <AddModal
          isOpen={modalAddOpen}
          onClose={() => setModalAddOpen(false)}
        />
      </div>
    </div>
  )
}
