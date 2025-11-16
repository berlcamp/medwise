'use client'

import { setBranch } from '@/lib/redux/branchSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { supabase } from '@/lib/supabase/client'
import { Branch } from '@/types'
import { useEffect, useState } from 'react'

export default function BranchSwitcher() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)
  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  )
  const [branches, setBranches] = useState<Branch[]>([])

  const [isSwitching, setIsSwitching] = useState(false)

  const handleSwitch = (id: number) => {
    setIsSwitching(true)
    dispatch(setBranch(Number(id)))

    // Give the overlay a moment to render before reload
    setTimeout(() => {
      window.location.reload()
    }, 200)
  }

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
      if (!error && data) setBranches(data)
    }
    if (user?.type === 'admin' || user?.type === 'super admin') fetchBranches()
  }, [user])

  if (user?.type !== 'admin' && user?.type !== 'super admin') return null

  return (
    <>
      {/* Blocking overlay */}
      {isSwitching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-lg shadow-lg">
            <p className="text-gray-700 dark:text-gray-200 font-medium">
              Switching branch, please wait...
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-500">Branch:</label>
        <select
          className="border border-gray-500 rounded-sm p-1 text-sm text-gray-200 outline-none"
          value={selectedBranchId ?? user?.branch_id ?? ''}
          onChange={(e) => handleSwitch(Number(e.target.value))}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
