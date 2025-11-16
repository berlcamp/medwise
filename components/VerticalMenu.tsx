'use client'

import { useAppSelector } from '@/lib/redux/hook'
import Link from 'next/link'

export default function VerticalMenu({ activeTab }: { activeTab: string }) {
  const location = useAppSelector((state) => state.location.selectedLocation)

  return (
    <div className="border-b flex gap-2 px-4 mt-4">
      <Link href={`/${location?.id}`}>
        <button
          className={`py-2 px-2 text-sm -mb-px cursor-pointer ${
            activeTab === 'overview'
              ? 'border-b-2 font-bold border-gray-500 text-gray-700 dark:text-gray-400'
              : 'text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Overview
        </button>
      </Link>
      <Link href={`/households/${location?.id}`}>
        <button
          className={`py-2 px-2 text-sm -mb-px cursor-pointer ${
            activeTab === 'households'
              ? 'border-b-2 font-bold border-gray-500 text-gray-700 dark:text-gray-400'
              : 'text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Households
        </button>
      </Link>
    </div>
  )
}
