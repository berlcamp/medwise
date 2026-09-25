'use client'

import Notfoundpage from '@/components/Notfoundpage'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { setSettings } from '@/lib/redux/settingsSlice'
import { supabase } from '@/lib/supabase/client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function Page() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)
  const printReceiptsEnabled = useAppSelector(
    (state) => state.settings.printReceiptsEnabled
  )
  const [saving, setSaving] = useState(false)

  // Only super admin can manage system settings
  if (user?.type !== 'super admin') {
    return <Notfoundpage />
  }

  const togglePrintReceipts = async () => {
    const next = !printReceiptsEnabled
    setSaving(true)

    const { error } = await supabase.from('org_settings').upsert({
      org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
      print_receipts_enabled: next,
      updated_at: new Date().toISOString(),
      updated_by: user.system_user_id
    })

    setSaving(false)

    if (error) {
      console.error(error)
      toast.error('Failed to save setting')
      return
    }

    dispatch(setSettings({ printReceiptsEnabled: next }))
    toast.success(`Receipt printing turned ${next ? 'on' : 'off'}`)
  }

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Settings</h1>
      </div>

      <div className="app__content">
        <div className="max-w-2xl rounded-md border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-6 p-4">
            <div>
              <div className="font-medium text-gray-900">
                Print receipts
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Allow printing of sales invoices and delivery receipts. When
                off, all invoice and delivery receipt print buttons are hidden
                for every user.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={printReceiptsEnabled}
              aria-label="Print receipts"
              onClick={togglePrintReceipts}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                printReceiptsEnabled ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  printReceiptsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
