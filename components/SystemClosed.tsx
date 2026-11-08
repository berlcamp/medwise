'use client'

import { supabase } from '@/lib/supabase/client'
import { Lock } from 'lucide-react'

export default function SystemClosed({
  message,
  reopensAt
}: {
  message?: string
  // e.g. "7:00 AM", when closed by the daily schedule
  reopensAt?: string
}) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-10 text-center shadow-lg">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <Lock className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          <span style={{ fontFamily: 'Literaturnaya, serif' }}>MedWise</span>
        </h1>
        <h2 className="mb-4 text-2xl font-semibold text-gray-800">
          System is currently closed
        </h2>
        <p className="mb-6 whitespace-pre-line leading-relaxed text-gray-600">
          {message?.trim() ||
            'The system is temporarily unavailable. Please check back later or contact your administrator.'}
        </p>
        {reopensAt && (
          <p className="mb-6 text-sm font-medium text-gray-700">
            The system opens again at {reopensAt}.
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
