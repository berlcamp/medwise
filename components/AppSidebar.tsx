'use client'

import {
  BarChart,
  Home,
  List,
  ListChecks,
  Loader2,
  ShoppingCart,
  StoreIcon,
  User,
  Users2
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { useAppSelector } from '@/lib/redux/hook'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NProgress from 'nprogress'

export function AppSidebar() {
  const user = useAppSelector((state) => state.user.user)
  const pathname = usePathname()
  const [loadingPath, setLoadingPath] = useState<string | null>(null)

  // Reset loading state when pathname changes
  useEffect(() => {
    setLoadingPath(null)
  }, [pathname])

  const handleLinkClick = (url: string) => {
    // Don't trigger if already on this page
    if (pathname === url) return
    
    // Start progress bar and set loading state
    NProgress.start()
    setLoadingPath(url)
  }

  // Menu items.
  const items = [
    {
      title: 'Home',
      url: '/home',
      icon: Home
    },
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: BarChart
    },
    {
      title: 'Retail Transactions',
      url: '/transactions',
      icon: ShoppingCart
    },
    {
      title: 'Bulk Transactions',
      url: '/bulktransactions',
      icon: ShoppingCart
    },
    {
      title: 'Consignments',
      url: '/consignments',
      icon: Users2
    },
    {
      title: 'Customers',
      url: '/customers',
      icon: User
    }
  ]

  const inventoryItems = [
    {
      title: 'Products',
      url: '/products',
      icon: ListChecks
    },
    {
      title: 'Stocks in/out',
      url: '/productstocks',
      icon: ListChecks
    },
    {
      title: 'Suppliers',
      url: '/suppliers',
      icon: StoreIcon
    },
    {
      title: 'Reports',
      url: '/reports',
      icon: List
    }
  ]

  const settingItems = [
    {
      title: 'Staff',
      url: '/staff',
      icon: User
    },
    {
      title: 'Branches',
      url: '/branches',
      icon: Home
    },
  ]

  return (
    <Sidebar className="pt-13">
      <SidebarContent className="bg-white border-r border-gray-200 text-gray-700">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url
                const isLoading = loadingPath === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        onClick={() => handleLinkClick(item.url)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                            : 'hover:bg-gray-50 text-gray-700'
                        } ${isLoading ? 'opacity-60' : ''}`}
                      >
                        {isLoading ? (
                          <Loader2 className="text-base text-blue-600 animate-spin" />
                        ) : (
                          <item.icon
                            className={`text-base ${
                              isActive ? 'text-blue-600' : 'text-gray-500'
                            }`}
                          />
                        )}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user?.type === 'bulk' ||
          user?.type === 'admin' ||
          user?.type === 'super admin') && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="border-t rounded-none border-gray-200 text-gray-500">
                Inventory
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {inventoryItems.map((item) => {
                    const isActive = pathname === item.url
                    const isLoading = loadingPath === item.url
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            onClick={() => handleLinkClick(item.url)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                              isActive
                                ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                                : 'hover:bg-gray-50 text-gray-700'
                            } ${isLoading ? 'opacity-60' : ''}`}
                          >
                            {isLoading ? (
                              <Loader2 className="text-base text-blue-600 animate-spin" />
                            ) : (
                              <item.icon
                                className={`text-base ${
                                  isActive ? 'text-blue-600' : 'text-gray-500'
                                }`}
                              />
                            )}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="border-t rounded-none border-gray-200 text-gray-500">
                Settings
              </SidebarGroupLabel>
              <SidebarGroupContent className="pb-0">
                <SidebarMenu>
                  {settingItems.map((item) => {
                    const isActive = pathname === item.url
                    const isLoading = loadingPath === item.url
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            onClick={() => handleLinkClick(item.url)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                              isActive
                                ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                                : 'hover:bg-gray-50 text-gray-700'
                            } ${isLoading ? 'opacity-60' : ''}`}
                          >
                            {isLoading ? (
                              <Loader2 className="text-base text-blue-600 animate-spin" />
                            ) : (
                              <item.icon
                                className={`text-base ${
                                  isActive ? 'text-blue-600' : 'text-gray-500'
                                }`}
                              />
                            )}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
