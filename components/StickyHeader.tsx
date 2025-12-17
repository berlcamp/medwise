'use client'

import { useAppSelector } from '@/lib/redux/hook'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import BranchSwitcher from './BranchSwitcher'
import HeaderDropdown from './HeaderDropdownMenu'
import { Button } from './ui/button'
import { SidebarTrigger } from './ui/sidebar'

export default function StickyHeader() {
  const user = useAppSelector((state) => state.user.user)
  const isAgent = user?.type === 'agent'

  return (
    <header
      className="fixed w-full top-0 z-40 border-b border-[#2f5874] p-2 flex justify-start items-center gap-4"
      style={{
        backgroundColor: '#2a4f6e',
        backgroundImage: `
      linear-gradient(135deg, rgba(255,255,255,0.05) 25%, transparent 25%),
      linear-gradient(225deg, rgba(255,255,255,0.05) 25%, transparent 25%),
      linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
      linear-gradient(315deg, rgba(255,255,255,0.05) 25%, transparent 25%)
    `,
        backgroundSize: '8px 8px',
        backgroundBlendMode: 'overlay'
      }}
    >
      {!isAgent && <SidebarTrigger />}

      {/* Left section: Logo */}
      <div className="flex items-center">
        <div className="text-white font-semibold text-2xl flex items-center">
          <span style={{ fontFamily: 'Literaturnaya, serif' }}>MedWise</span>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Create Transaction button for agents */}
      {isAgent && (
        <Link href="/agent-transaction">
          <Button
            variant="default"
            className="mr-2 bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Transaction
          </Button>
        </Link>
      )}

      {user?.type === 'super admin' && <BranchSwitcher />}

      {/* Right section: Settings dropdown */}
      <HeaderDropdown />
    </header>
  )
}
