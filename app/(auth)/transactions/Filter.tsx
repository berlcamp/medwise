'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DateRangePicker } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import { useForm } from 'react-hook-form'

interface FormType {
  keyword: string
  transaction_number: string
  date_from: string
  date_to: string
}

export const Filter = ({
  filter,
  setFilter
}: {
  filter: { keyword: string; transaction_number: string; date_from: string; date_to: string }
  setFilter: (filter: { keyword: string; transaction_number: string; date_from: string; date_to: string }) => void
}) => {
  // Determine initial date mode based on existing filter
  const getInitialDateMode = () => {
    if (filter.date_from && filter.date_to) {
      return 'custom'
    }
    return 'all'
  }

  const [dateMode, setDateMode] = useState<'all' | 'today' | 'last_week' | 'last_month' | 'custom'>(getInitialDateMode())
  const [dateRange, setDateRange] = useState([
    {
      startDate: filter.date_from ? new Date(filter.date_from) : undefined,
      endDate: filter.date_to ? new Date(filter.date_to) : undefined,
      key: 'selection'
    }
  ])

  const { reset, register, handleSubmit, watch, setValue } = useForm<FormType>({
    defaultValues: {
      ...filter
    }
  })

  // Handle date mode changes
  useEffect(() => {
    if (dateMode === 'custom') {
      // Keep existing custom dates
      return
    }

    const today = new Date()
    let startDate: Date | undefined
    let endDate: Date | undefined

    switch (dateMode) {
      case 'today':
        startDate = new Date(today)
        endDate = new Date(today)
        break
      case 'last_week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
        endDate = new Date(today)
        break
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'all':
      default:
        startDate = undefined
        endDate = undefined
        break
    }

    setDateRange([{
      startDate,
      endDate,
      key: 'selection'
    }])
    setValue('date_from', startDate ? startDate.toISOString() : '')
    setValue('date_to', endDate ? endDate.toISOString() : '')
  }, [dateMode, setValue])

  const onSubmit = (data: FormType) => {
    setFilter({
      keyword: data.keyword || '',
      transaction_number: data.transaction_number || '',
      date_from: data.date_from || '',
      date_to: data.date_to || ''
    })
  }

  const handleReset = () => {
    reset({ 
      keyword: '', 
      transaction_number: '',
      date_from: '',
      date_to: ''
    })
    setDateMode('all')
    setDateRange([{
      startDate: undefined,
      endDate: undefined,
      key: 'selection'
    }])
    setFilter({ 
      keyword: '', 
      transaction_number: '',
      date_from: '',
      date_to: ''
    })
  }

  return (
    <div className="mt-4 border border-gray-200 bg-white rounded-sm mb-4 shadow-sm p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-end gap-3">
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

          {/* Tran No Search */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">
              Transaction No
            </label>
            <div className="flex items-center border rounded-md px-2">
              <Input
                {...register('transaction_number')}
                placeholder="Transaction No..."
                className="border-0 focus-visible:ring-0 text-sm"
              />
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">
              Date Range
            </label>
            <Select value={dateMode} onValueChange={(value) => setDateMode(value as typeof dateMode)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
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
        </div>

        {/* Date Range Picker - Only show when Custom is selected */}
        {dateMode === 'custom' && (
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">
              Transaction Date Range
            </label>
            <div className="inline-block">
              <DateRangePicker
                onChange={(item) => {
                  const newRange = [{
                    startDate: item.selection.startDate ?? undefined,
                    endDate: item.selection.endDate ?? undefined,
                    key: 'selection'
                  }]
                  setDateRange(newRange)
                  if (newRange[0].startDate && newRange[0].endDate) {
                    reset({
                      ...watch(),
                      date_from: newRange[0].startDate.toISOString(),
                      date_to: newRange[0].endDate.toISOString()
                    })
                  }
                }}
                moveRangeOnFirstSelection={false}
                ranges={dateRange}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
