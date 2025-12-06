'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { PER_PAGE } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { AddStockModal } from './AddStockModal'
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
    dispatch(addList([])) // reset list

    const fetchData = async () => {
      setLoading(true)

      let productIds: number[] = []

      // Only fetch matching product IDs if there's a filter
      if (filter.keyword || filter.category) {
        const { data: matchingProducts, error: productError } = await supabase
          .from('products')
          .select('id')
          .ilike('name', filter.keyword ? `%${filter.keyword}%` : '%')
          .ilike('category', filter.category ? `%${filter.category}%` : '%')

        if (productError) {
          console.error('Error fetching products:', productError)
          if (isMounted) setLoading(false)
          return
        }

        productIds = matchingProducts?.map((p) => p.id) || []
        // If no matching products, avoid querying stocks
        if (productIds.length === 0) {
          if (isMounted) {
            dispatch(addList([]))
            setTotalCount(0)
            setLoading(false)
          }
          return
        }
      }

      // Fetch product_stocks
      let query = supabase
        .from('product_stocks')
        .select(
          `
        *,
        product:products (
          id,
          name,
          category,
          unit
        ),
        supplier:supplier_id(name)
      `,
          { count: 'exact' }
        )
        .eq('inventory_type', 'stock')
        .eq('branch_id', selectedBranchId)

      // Apply product filter only if there are matching IDs
      if (productIds.length > 0) {
        query = query.in('product_id', productIds)
      } else {
        query = query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
      }

      const { data, count, error } = await query.order('created_at', {
        ascending: false
      })

      // Only update state if component is still mounted
      if (!isMounted) return

      if (error) {
        console.error('Error fetching stocks:', error)
      } else {
        dispatch(addList(data))
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

  if (user?.type === 'user' || user?.type === 'cashier') return <Notfoundpage />

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Product Stocks</h1>
        <div className="ml-auto space-x-2">
          <Button
            variant="green"
            onClick={() => setModalAddOpen(true)}
            size="xs"
          >
            Add Stock
          </Button>
        </div>
      </div>
      <Filter filter={filter} setFilter={setFilter} />
      <div className="app__content">
        <div className="py-2 text-xs  text-gray-500">
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

        <AddStockModal
          isOpen={modalAddOpen}
          onClose={() => setModalAddOpen(false)}
        />
      </div>
    </div>
  )
}
