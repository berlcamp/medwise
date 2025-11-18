'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { useForm } from 'react-hook-form'

interface FormType {
  keyword: string
}

export const Filter = ({
  filter,
  setFilter
}: {
  filter: { keyword: string }
  setFilter: (filter: { keyword: string }) => void
}) => {
  const { reset, register, handleSubmit } = useForm<FormType>({
    defaultValues: filter
  })

  const onSubmit = (data: FormType) => {
    setFilter({
      keyword: data.keyword || ''
    })
  }

  const handleReset = () => {
    reset({ keyword: '' })
    setFilter({ keyword: '' })
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
            Customer
          </label>
          <div className="flex items-center border rounded-md px-2">
            <Search size={16} className="text-gray-400" />
            <Input
              {...register('keyword')}
              placeholder="Search name..."
              className="border-0 focus-visible:ring-0 text-sm"
            />
          </div>
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
