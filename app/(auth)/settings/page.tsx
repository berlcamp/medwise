'use client'

import Notfoundpage from '@/components/Notfoundpage'
import { canManageSystemSettings } from '@/lib/constants'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hook'
import { setSettings, SettingsState } from '@/lib/redux/settingsSlice'
import { supabase } from '@/lib/supabase/client'
import { formatTime12h } from '@/lib/utils/systemClose'
import { useState } from 'react'
import toast from 'react-hot-toast'

function Switch({
  checked,
  label,
  disabled,
  onClick,
  activeClass = 'bg-green-600'
}: {
  checked: boolean
  label: string
  disabled: boolean
  onClick: () => void
  activeClass?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? activeClass : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function Page() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)
  const settings = useAppSelector((state) => state.settings)
  const [saving, setSaving] = useState(false)
  const [closedMessage, setClosedMessage] = useState(
    settings.systemClosedMessage
  )
  const [closeStart, setCloseStart] = useState(settings.closeStartTime)
  const [closeEnd, setCloseEnd] = useState(settings.closeEndTime)

  // Only super admins and the listed accounts can manage system settings
  if (!canManageSystemSettings(user?.type, user?.email)) {
    return <Notfoundpage />
  }

  const save = async (
    changes: Partial<SettingsState>,
    successMessage: string
  ) => {
    const next = { ...settings, ...changes }
    setSaving(true)

    const { error } = await supabase.from('org_settings').upsert({
      org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
      print_receipts_enabled: next.printReceiptsEnabled,
      system_closed: next.systemClosed,
      system_closed_message: next.systemClosedMessage.trim() || null,
      close_schedule_enabled: next.closeScheduleEnabled,
      close_start_time: next.closeStartTime,
      close_end_time: next.closeEndTime,
      updated_at: new Date().toISOString(),
      updated_by: user?.system_user_id
    })

    setSaving(false)

    if (error) {
      console.error(error)
      toast.error('Failed to save setting')
      return
    }

    dispatch(setSettings(changes))
    toast.success(successMessage)
  }

  const togglePrintReceipts = () => {
    const next = !settings.printReceiptsEnabled
    save(
      { printReceiptsEnabled: next },
      `Receipt printing turned ${next ? 'on' : 'off'}`
    )
  }

  const toggleSystemClosed = () => {
    const next = !settings.systemClosed
    if (
      next &&
      !confirm(
        'Close the system? Other users will be blocked from using MedWise until you open it again.'
      )
    ) {
      return
    }
    save(
      { systemClosed: next, systemClosedMessage: closedMessage },
      next ? 'System closed to other users' : 'System is open again'
    )
  }

  const validTimes = !!closeStart && !!closeEnd && closeStart !== closeEnd

  const toggleCloseSchedule = () => {
    const next = !settings.closeScheduleEnabled
    if (next && !validTimes) {
      toast.error('Set different start and end times first')
      return
    }
    save(
      {
        closeScheduleEnabled: next,
        closeStartTime: closeStart,
        closeEndTime: closeEnd
      },
      next
        ? `System will close daily from ${formatTime12h(closeStart)} to ${formatTime12h(closeEnd)}`
        : 'Scheduled close turned off'
    )
  }

  const scheduleChanged =
    closeStart !== settings.closeStartTime || closeEnd !== settings.closeEndTime

  const messageChanged =
    closedMessage.trim() !== settings.systemClosedMessage.trim()

  return (
    <div>
      <div className="app__title">
        <h1 className="text-3xl font-normal">Settings</h1>
      </div>

      <div className="app__content">
        <div className="max-w-2xl divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-6 p-4">
            <div>
              <div className="font-medium text-gray-900">Print receipts</div>
              <p className="mt-1 text-sm text-gray-500">
                Allow printing of sales invoices and delivery receipts. When
                off, all invoice and delivery receipt print buttons are hidden
                for every user.
              </p>
            </div>
            <Switch
              checked={settings.printReceiptsEnabled}
              label="Print receipts"
              disabled={saving}
              onClick={togglePrintReceipts}
            />
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="font-medium text-gray-900">
                  Close system
                  {settings.systemClosed && (
                    <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Closed
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Close now: when on, other users can&apos;t use the system — after
                  signing in they see a &quot;system is currently closed&quot;
                  message. Super admins and accounts allowed to manage system
                  settings can still use it.
                </p>
              </div>
              <Switch
                checked={settings.systemClosed}
                label="Close system"
                disabled={saving}
                onClick={toggleSystemClosed}
                activeClass="bg-red-600"
              />
            </div>

            <div className="space-y-3 rounded-md border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Close automatically every day
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    The system closes at the start time and opens again at the
                    end time (Philippine time).
                  </p>
                </div>
                <Switch
                  checked={settings.closeScheduleEnabled}
                  label="Close automatically every day"
                  disabled={saving}
                  onClick={toggleCloseSchedule}
                  activeClass="bg-red-600"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-gray-700">
                  Close at
                  <input
                    type="time"
                    value={closeStart}
                    onChange={(e) => setCloseStart(e.target.value)}
                    className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Open at
                  <input
                    type="time"
                    value={closeEnd}
                    onChange={(e) => setCloseEnd(e.target.value)}
                    className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                {scheduleChanged && (
                  <button
                    type="button"
                    disabled={saving || !validTimes}
                    onClick={() =>
                      save(
                        { closeStartTime: closeStart, closeEndTime: closeEnd },
                        'Schedule saved'
                      )
                    }
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Save times
                  </button>
                )}
              </div>
              {!validTimes && (
                <p className="text-sm text-red-600">
                  Start and end times must be different.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="system-closed-message"
                className="text-sm font-medium text-gray-700"
              >
                Message shown to users (optional)
              </label>
              <textarea
                id="system-closed-message"
                rows={3}
                value={closedMessage}
                onChange={(e) => setClosedMessage(e.target.value)}
                placeholder="The system is temporarily unavailable. Please check back later or contact your administrator."
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {messageChanged && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      save(
                        { systemClosedMessage: closedMessage },
                        'Message saved'
                      )
                    }
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Save message
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
