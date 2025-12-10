'use client'

import { Greeting } from '@/components/Greeting'
import { useAppSelector } from '@/lib/redux/hook'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Page() {
  const user = useAppSelector((state) => state.user.user)
  const router = useRouter()

  useEffect(() => {
    // Redirect agent users to agent dashboard
    if (user?.type === 'agent') {
      router.push('/agent-dashboard')
    }
  }, [user?.type, router])

  // Don't render home page for agents (they'll be redirected)
  if (user?.type === 'agent') {
    return null
  }

  return (
    <div className="w-full">
      <div className="mt-20 grid gap-4">
        <div className="text-center">
          <Greeting name={user?.name ?? ''} />
        </div>
      </div>
    </div>
  )
}
