'use client'

import { AppSidebar } from '@/components/AppSidebar'
import { AuthGuard } from '@/components/AuthGuard'
import LoadingSkeleton from '@/components/LoadingSkeleton'
import { OfflineDetector } from '@/components/OfflineDetector'
import StickyHeader from '@/components/StickyHeader'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Providers } from '@/lib/redux/providers'
import { Suspense } from 'react'
import { Toaster } from 'react-hot-toast'

export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Toaster />
      <OfflineDetector />
      <Providers>
        <Suspense fallback={<LoadingSkeleton />}>
          <AuthGuard>
            <SidebarProvider>
              <AppSidebar />
              <StickyHeader />
              <main className="w-full">
                <div className="p-4 mt-14">{children}</div>
              </main>
            </SidebarProvider>
          </AuthGuard>
        </Suspense>
      </Providers>
    </>
  )
}
