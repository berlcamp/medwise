'use client'

import { canManageSystemSettings } from '@/lib/constants'
import { setSettings } from '@/lib/redux/settingsSlice'
import {
  DEFAULT_CLOSE_END,
  DEFAULT_CLOSE_START,
  formatTime12h,
  isWithinCloseSchedule,
  toHHMM
} from '@/lib/utils/systemClose'
import { setUser } from '@/lib/redux/userSlice'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import LoadingSkeleton from './LoadingSkeleton'
import SystemClosed from './SystemClosed'

// How often signed-in users re-check whether the system has been closed
// (manually or by the close schedule).
const SETTINGS_REFRESH_MS = 30_000

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  // Set when the system is closed and this user may not bypass it.
  const [closed, setClosed] = useState<{
    message: string
    reopensAt?: string
  } | null>(null)
  const router = useRouter()
  const dispatch = useDispatch()

  useEffect(() => {
    let canBypassClosed = false
    let userLoaded = false

    // Org-wide toggles; keep the defaults if the row is missing. Re-run
    // periodically so users already signed in are shut out (or let back in)
    // when the system is closed or reopened.
    const refreshSettings = async () => {
      const { data: orgSettings } = await supabase
        .from('org_settings')
        .select(
          'print_receipts_enabled, system_closed, system_closed_message, close_schedule_enabled, close_start_time, close_end_time'
        )
        .eq('org_id', process.env.NEXT_PUBLIC_ORG_ID)
        .maybeSingle()

      if (!orgSettings) return

      const closeStartTime =
        toHHMM(orgSettings.close_start_time) || DEFAULT_CLOSE_START
      const closeEndTime =
        toHHMM(orgSettings.close_end_time) || DEFAULT_CLOSE_END

      dispatch(
        setSettings({
          printReceiptsEnabled: orgSettings.print_receipts_enabled,
          systemClosed: !!orgSettings.system_closed,
          systemClosedMessage: orgSettings.system_closed_message ?? '',
          closeScheduleEnabled: !!orgSettings.close_schedule_enabled,
          closeStartTime,
          closeEndTime
        })
      )

      const manuallyClosed = !!orgSettings.system_closed
      const scheduleClosed =
        !!orgSettings.close_schedule_enabled &&
        isWithinCloseSchedule(closeStartTime, closeEndTime)

      setClosed(
        (manuallyClosed || scheduleClosed) && !canBypassClosed
          ? {
              message: orgSettings.system_closed_message ?? '',
              reopensAt: manuallyClosed
                ? undefined
                : formatTime12h(closeEndTime)
            }
          : null
      )
    }

    const loadSessionAndUser = async () => {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        console.error('No session found:', sessionError)
        router.replace('/auth/unverified') // Or login
        setLoading(false)
        return
      }

      const { data: systemUser, error: userError } = await supabase
        .from('users')
        .select()
        .eq('email', session.user.email)
        .eq('is_active', true)
        .single()

      if (userError || !systemUser) {
        console.error('System user not found or inactive:', userError)
        await supabase.auth.signOut()
        router.replace('/auth/unverified')
        setLoading(false)
        return
      }

      // Fetch locations the user is allowed to access
      try {
        dispatch(
          setUser({
            ...session.user,
            system_user_id: systemUser.id,
            name: systemUser.name,
            type: systemUser.type,
            branch_id: systemUser.branch_id,
            address: systemUser.address,
            report_access: systemUser.report_access,
            module_access: systemUser.module_access
          })
        )
      } catch (error) {
        console.error('Failed to load locations:', error)
      }

      canBypassClosed = canManageSystemSettings(
        systemUser.type,
        session.user.email
      )
      await refreshSettings()
      userLoaded = true

      setLoading(false)
    }

    loadSessionAndUser()

    const recheck = () => {
      if (userLoaded && document.visibilityState === 'visible') {
        refreshSettings()
      }
    }
    const interval = setInterval(recheck, SETTINGS_REFRESH_MS)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)

    // Optional: handle logout cases live
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace('/auth/unverified')
        }
      }
    )

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
      authListener?.subscription.unsubscribe()
    }
  }, [dispatch, router])

  if (loading) return <LoadingSkeleton />
  if (closed)
    return <SystemClosed message={closed.message} reopensAt={closed.reopensAt} />
  return <>{children}</>
}
