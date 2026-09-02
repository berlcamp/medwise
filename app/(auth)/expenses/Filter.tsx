'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { fetchExpenseCategoryNames } from '@/lib/utils/expenseCategories'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

export interface ExpenseFilter {
  keyword: string
  category: string
  dateFrom: string
  dateTo: string
}

interface FormType {
  keyword: string
  dateFrom: string
  dateTo: string
}

const ALL = 'All'

export const Filter = ({
  filter,
  setFilter,
  categoriesVersion = 0
}: {
  filter: ExpenseFilter
  setFilter: (filter: ExpenseFilter) => void
  /** Bumped by the parent after categories change, to reload the dropdown. */
  categoriesVersion?: number
}) => {
  const [category, setCategory] = useState(filter.category || ALL)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    fetchExpenseCategoryNames().then((names) => {
      if (isMounted) setCategories(names)
    })
    return () => {
      isMounted = false
    }
  }, [categoriesVersion])

  const { reset, register, handleSubmit } = useForm<FormType>({
    defaultValues: {
      keyword: filter.keyword,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo
    }
  })

  const onSubmit = (data: FormType) => {
    setFilter({
      keyword: data.keyword || '',
      category: category === ALL ? '' : category,
      dateFrom: data.dateFrom || '',
      dateTo: data.dateTo || ''
    })
  }

  const handleReset = () => {
    reset({ keyword: '', dateFrom: '', dateTo: '' })
    setCategory(ALL)
    setFilter({ keyword: '', category: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div className="mt-4 border border-gray-200 bg-white rounded-sm mb-4 shadow-sm p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-3"
      >
        {/* Keyword Search */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Search
          </label>
          <div className="flex items-center border rounded-md px-2">
            <Search size={16} className="text-gray-400" />
            <Input
              {...register('keyword')}
              placeholder="Payee, reference, description..."
              className="border-0 focus-visible:ring-0 text-sm"
            />
          </div>
        </div>

        {/* Category */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Category
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">From</label>
          <Input type="date" {...register('dateFrom')} className="text-sm" />
        </div>

        {/* Date To */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">To</label>
          <Input type="date" {...register('dateTo')} className="text-sm" />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 ml-auto">
          <Button
            variant="blue"
            type="submit"
            size="xs"
            className="rounded-md shadow-sm"
          >
            Apply Filter
          </Button>
          <Button
            size="xs"
            type="button"
            variant="outline"
            className="rounded-md"
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  )
}
