import {
  BarChart,
  Home,
  List,
  ListChecks,
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

export function AppSidebar() {
  const user = useAppSelector((state) => state.user.user)
  const pathname = usePathname()

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
    {
      title: 'Suppliers',
      url: '/suppliers',
      icon: StoreIcon
    }
  ]

  return (
    <Sidebar className="pt-13">
      <SidebarContent className="bg-white border-r border-gray-200 text-gray-700">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <item.icon
                          className={`text-base ${
                            isActive ? 'text-blue-600' : 'text-gray-500'
                          }`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user?.type === 'admin' || user?.type === 'super admin') && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="border-t rounded-none border-gray-200 text-gray-500">
                Inventory
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {inventoryItems.map((item) => {
                    const isActive = pathname === item.url
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                              isActive
                                ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <item.icon
                              className={`text-base ${
                                isActive ? 'text-blue-600' : 'text-gray-500'
                              }`}
                            />
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
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                              isActive
                                ? 'bg-gray-100 text-gray-900 font-medium' // Active item
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <item.icon
                              className={`text-base ${
                                isActive ? 'text-blue-600' : 'text-gray-500'
                              }`}
                            />
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
