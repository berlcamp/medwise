'use client'

import { supabase } from '@/lib/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LoadingSkeleton from './LoadingSkeleton'

interface LoginBoxProps {
  message?: string
}

export default function LoginBox({ message }: LoginBoxProps) {
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) console.warn('Auth error:', error.message)
      if (data.user) router.push('/home')
      setCheckingSession(false)
    }

    checkSession()
  }, [router])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          prompt: 'select_account'
        },
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      setErrorMessage(error.message)
      setIsLoading(false)
    }
  }

  if (checkingSession) {
    return <LoadingSkeleton />
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Logo (optional replace with your own) */}
        {/* <div className="flex justify-center">
          <Image
            src="/logo.svg"
            alt="Asenso Logo"
            width={120}
            height={40}
            priority
          />
        </div> */}

        <h1 className="text-4xl font-semibold text-gray-900">
          <span style={{ fontFamily: 'Literaturnaya, serif' }}>MedWise</span>
        </h1>
        <p className="text-sm text-gray-600">To get started, please sign in</p>

        {errorMessage && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {message}
          </div>
        )}

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full border border-gray-300 rounded-md py-2 px-4 flex items-center justify-center gap-2 text-gray-800 bg-white hover:bg-gray-100 transition disabled:opacity-60"
        >
          <Image
            src="/icons8-google-100.svg"
            alt="Google"
            width={20}
            height={20}
          />
          {isLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>
      </div>
    </main>
  )
}
