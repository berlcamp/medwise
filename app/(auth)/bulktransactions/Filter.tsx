'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { DateRangePicker } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import { useState } from 'react'

interface FormType {
  keyword: string
  transaction_number: string
  payment_status: string
  delivery_status: string
  date_from: string
  date_to: string
}

export const Filter = ({
  filter,
  setFilter
}: {
  filter: { 
    keyword: string
    transaction_number: string
    payment_status: string
    delivery_status: string
    date_from: string
    date_to: string
  }
  setFilter: (filter: {
    keyword: string
    transaction_number: string
    payment_status: string
    delivery_status: string
    date_from: string
    date_to: string
  }) => void
}) => {
  const [dateRange, setDateRange] = useState([
    {
      startDate: filter.date_from ? new Date(filter.date_from) : undefined,
      endDate: filter.date_to ? new Date(filter.date_to) : undefined,
      key: 'selection'
    }
  ])

  const { reset, register, handleSubmit, control, watch } = useForm<FormType>({
    defaultValues: {
      ...filter,
      payment_status: filter.payment_status || 'all',
      delivery_status: filter.delivery_status || 'all'
    }
  })

  const onSubmit = (data: FormType) => {
    setFilter({
      keyword: data.keyword || '',
      transaction_number: data.transaction_number || '',
      payment_status: data.payment_status === 'all' ? '' : (data.payment_status || ''),
      delivery_status: data.delivery_status === 'all' ? '' : (data.delivery_status || ''),
      date_from: data.date_from || '',
      date_to: data.date_to || ''
    })
  }

  const handleReset = () => {
    reset({ 
      keyword: '', 
      transaction_number: '',
      payment_status: 'all',
      delivery_status: 'all',
      date_from: '',
      date_to: ''
    })
    setDateRange([{
      startDate: undefined,
      endDate: undefined,
      key: 'selection'
    }])
    setFilter({ 
      keyword: '', 
      transaction_number: '',
      payment_status: '',
      delivery_status: '',
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

          {/* Payment Status */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">
              Payment Status
            </label>
            <Controller
              control={control}
              name="payment_status"
              render={({ field }) => (
                <Select value={field.value || 'all'} onValueChange={field.onChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Delivery Status */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">
              Delivery Status
            </label>
            <Controller
              control={control}
              name="delivery_status"
              render={({ field }) => (
                <Select value={field.value || 'all'} onValueChange={field.onChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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

        {/* Date Range Picker */}
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
      </form>
    </div>
  )
}
