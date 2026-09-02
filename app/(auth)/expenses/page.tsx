'use client'

import LoadingSkeleton from '@/components/LoadingSkeleton'
import Notfoundpage from '@/components/Notfoundpage'
import { Button } from '@/components/ui/button'
import { PER_PAGE } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { addList } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { AddModal } from './AddModal'
import { ExpenseFilter, Filter } from './Filter'
import { ManageCategoriesModal } from './ManageCategoriesModal'
import { List } from './List'

export default function Page() {
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [page, setPage] = useState(1)
  const [modalAddOpen, setModalAddOpen] = useState(false)
  const [modalCategoriesOpen, setModalCategoriesOpen] = useState(false)
  // Bumped whenever categories change, so the filter dropdown reloads and the
  // list refetches (a rename cascades to existing expense rows).
  const [categoriesVersion, setCategoriesVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<ExpenseFilter>({
    keyword: '',
    category: '',
    dateFrom: '',
    dateTo: ''
  })

  const dispatch = useAppDispatch()

  const user = useAppSelector((state) => state.user.user)
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )

  const isAdmin = user?.type === 'admin' || user?.type === 'super admin'

  // Reset to page 1 whenever the filter or branch changes so the offset
  // never points past the end of a smaller result set.
  useEffect(() => {
    setPage(1)
  }, [filter, selectedBranchId])

  // Fetch data on page load
  useEffect(() => {
    if (!isAdmin || !selectedBranchId) return

    let isMounted = true
    dispatch(addList([])) // Reset the list first on page load

    // Shared filter clauses so the paged list and the running total always
    // describe the same set of rows.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const buildQuery = (columns: string, withCount: boolean) => {
      let q: any = supabase
        .from('expenses')
        .select(columns, withCount ? { count: 'exact' } : undefined)
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .eq('branch_id', selectedBranchId)

      if (filter.category) q = q.eq('category', filter.category)
      if (filter.dateFrom) q = q.gte('expense_date', filter.dateFrom)
      if (filter.dateTo) q = q.lte('expense_date', filter.dateTo)
      if (filter.keyword) {
        const kw = `%${filter.keyword}%`
        q = q.or(
          `payee.ilike.${kw},reference_number.ilike.${kw},description.ilike.${kw}`
        )
      }
      return q
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const fetchData = async () => {
      setLoading(true)

      const [listResult, totalsResult] = await Promise.all([
        buildQuery('*', true)
          .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
          .order('expense_date', { ascending: false })
          .order('id', { ascending: false }),
        buildQuery('amount', false)
      ])

      // Only update state if component is still mounted
      if (!isMounted) return

      if (listResult.error) {
        console.error(listResult.error)
      } else {
        // Update the list of expenses in Redux store
        dispatch(addList(listResult.data))
        setTotalCount(listResult.count || 0)
      }

      if (totalsResult.error) {
        console.error(totalsResult.error)
      } else {
        setTotalAmount(
          ((totalsResult.data || []) as unknown as { amount: number }[]).reduce(
            (sum, row) => sum + (Number(row.amount) || 0),
            0
          )
        )
      }

      setLoading(false)
    }

    fetchData()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [page, filter, dispatch, selectedBranchId, isAdmin, categoriesVersion])

  // Expenses are sensitive financials — admins only.
  if (!isAdmin) {
    return <Notfoundpage />
  }

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Expenses</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setModalCategoriesOpen(true)}
            size="xs"
          >
            Manage Categories
          </Button>
          <Button
            variant="green"
            onClick={() => setModalAddOpen(true)}
            size="xs"
          >
            Add Expense
          </Button>
        </div>
      </div>

      <Filter
        filter={filter}
        setFilter={setFilter}
        categoriesVersion={categoriesVersion}
      />
      <div className="app__content">
        <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <div>
            Showing {Math.min((page - 1) * PER_PAGE + 1, totalCount)} to{' '}
            {Math.min(page * PER_PAGE, totalCount)} of {totalCount} results
          </div>
          <div className="text-sm font-semibold text-gray-700">
            Total:{' '}
            <span className="text-red-600">
              ₱
              {totalAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
        </div>

        {/* Pass Redux data to List Table */}
        <List />

        {/* Loading Skeleton */}
        {loading && <LoadingSkeleton />}

        {!selectedBranchId && (
          <div className="mt-4 flex justify-center items-center space-x-2">
            Please select a branch.
          </div>
        )}

        {selectedBranchId && totalCount === 0 && !loading && (
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
        <ManageCategoriesModal
          isOpen={modalCategoriesOpen}
          onClose={() => setModalCategoriesOpen(false)}
          onChanged={() => setCategoriesVersion((v) => v + 1)}
        />
      </div>
    </div>
  )
}
