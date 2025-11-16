// components/FilterComponent.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'

interface FormType {
  keyword: string
}

export const Filter = ({
  filter,
  setFilter
}: {
  filter: string
  setFilter: (filter: string) => void
}) => {
  const { reset, register, handleSubmit } = useForm<FormType>()

  // Submit handler
  const onSubmit = async (data: FormType) => {
    setFilter(data.keyword)
  }

  const handleReset = () => {
    setFilter('')
    reset({
      keyword: ''
    })
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input
          {...register('keyword')}
          placeholder="Search procedure by name"
          className="mb-4 max-w-xs"
        />
        <div className="flex justify-start space-x-2">
          <Button
            variant="blue"
            type="submit"
            size="xs"
            onClick={() => setFilter(filter)}
          >
            Submit Filter
          </Button>
          <Button
            size="xs"
            type="button"
            variant="outline"
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  )
}
