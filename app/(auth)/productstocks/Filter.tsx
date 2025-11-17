'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { productCategories } from '@/lib/constants'
import { Search } from 'lucide-react'
import { useForm } from 'react-hook-form'

interface FormType {
  keyword: string
  category: string
}

export const Filter = ({
  filter,
  setFilter
}: {
  filter: { keyword: string; category: string }
  setFilter: (filter: { keyword: string; category: string }) => void
}) => {
  const { reset, register, handleSubmit } = useForm<FormType>({
    defaultValues: filter
  })

  const onSubmit = (data: FormType) => {
    setFilter({
      keyword: data.keyword || '',
      category: data.category || ''
    })
  }

  const handleReset = () => {
    reset({ keyword: '', category: '' })
    setFilter({ keyword: '', category: '' })
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
            Product Name
          </label>
          <div className="flex items-center border rounded-md px-2">
            <Search size={16} className="text-gray-400" />
            <Input
              {...register('keyword')}
              placeholder="Search product..."
              className="border-0 focus-visible:ring-0 text-sm"
            />
          </div>
        </div>

        {/* Category Select */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Category
          </label>
          <div className="flex items-center border rounded-md px-2">
            {/* <CalendarIcon size={16} className="text-gray-400" /> */}
            <select
              {...register('category')}
              className="border-0 focus-visible:ring-0 text-sm w-full py-2 bg-transparent"
            >
              <option value="">Select Category</option>
              {productCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 ml-auto">
          <Button
            variant="blue"
            type="submit"
            size="sm"
            className="rounded-md shadow-sm"
          >
            Apply Filter
          </Button>
          <Button
            size="sm"
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
