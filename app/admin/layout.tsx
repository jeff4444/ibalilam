'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Store,
  Package,
  ShoppingCart,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  Home,
  Shield
} from 'lucide-react'

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {}
})

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'FICA Review', href: '/admin/fica-review', icon: FileCheck },
  { name: 'Shops', href: '/admin/shops', icon: Store },
  { name: 'Listings', href: '/admin/listings', icon: Package },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Transactions', href: '/admin/transactions', icon: CreditCard },
  { name: 'Wallet', href: '/admin/wallet', icon: Wallet },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

function NavItem({ item, collapsed }: { item: typeof navItems[0], collapsed: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  const Icon = item.icon

  return (
    <Link href={item.href}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-slate-800',
          isActive ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-300 hover:text-white',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
        {!collapsed && <span>{item.name}</span>}
      </div>
    </Link>
  )
}

function SidebarContent({ collapsed, onCollapse, setCollapsed }: { collapsed: boolean, onCollapse?: () => void, setCollapsed?: (collapsed: boolean) => void }) {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Header */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-800 px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-500" />
            <span className="text-lg font-bold text-white">Admin</span>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed?.(false)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            title="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
        {onCollapse && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed?.(true)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className={cn(
        'border-t border-slate-800 p-4',
        collapsed && 'flex flex-col items-center gap-2'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" />
              <AvatarFallback className="bg-emerald-600 text-white">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
        )}
        
        <div className={cn('flex gap-2', collapsed ? 'flex-col' : 'flex-row')}>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            asChild
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Main Site</span>}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={handleSignOut}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </div>

      {/* Expand button for collapsed state */}
      {onCollapse && collapsed && (
        <div className="p-2 border-t border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
            title="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return
      
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single()

        if (error || !profile?.is_admin) {
          setIsAdmin(false)
          router.push('/dashboard')
          return
        }

        setIsAdmin(true)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [user, authLoading, router, supabase])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You do not have admin privileges.</p>
          <Button asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-screen bg-slate-950">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-slate-800 transition-all duration-300',
            collapsed ? 'w-[70px]' : 'w-64'
          )}
        >
          <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} setCollapsed={setCollapsed} />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-800">
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <header className="lg:hidden flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 h-16">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="text-slate-400 hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-500" />
              <span className="font-bold text-white">Admin Panel</span>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-slate-950">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}

