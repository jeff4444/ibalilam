'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  LayoutDashboard,
  Package,
  Plus,
  CreditCard,
  Wallet,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  User,
  Store,
  Search,
  ShoppingCart,
  Heart,
  ChevronDown,
  Cpu
} from 'lucide-react'

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {}
})

const sellerNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Add Part', href: '/sell', icon: Plus },
  { name: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'Messages', href: '/messages', icon: MessageCircle },
]

const buyerNavItems = [
  { name: 'Browse Parts', href: '/parts', icon: Search },
  { name: 'My Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Favorites', href: '/favorites', icon: Heart },
]

function NavItem({ item, collapsed }: { item: typeof sellerNavItems[0], collapsed: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || 
    (item.href !== '/dashboard' && item.href !== '/sell' && pathname.startsWith(item.href))
  const Icon = item.icon

  return (
    <Link href={item.href}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-slate-800',
          isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-300 hover:text-white',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
        {!collapsed && <span>{item.name}</span>}
      </div>
    </Link>
  )
}

function SidebarContent({ 
  collapsed, 
  onCollapse, 
  setCollapsed,
  onNavigate 
}: { 
  collapsed: boolean
  onCollapse?: () => void
  setCollapsed?: (collapsed: boolean) => void
  onNavigate?: () => void
}) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [buyerSectionOpen, setBuyerSectionOpen] = useState(true)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleNavClick = () => {
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Header */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-800 px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2" onClick={handleNavClick}>
            <Store className="h-8 w-8 text-blue-500" />
            <span className="text-lg font-bold text-white">Seller Hub</span>
          </Link>
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
          {/* Seller Navigation */}
          {!collapsed && (
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Seller Tools
            </div>
          )}
          {sellerNavItems.map((item) => (
            <div key={item.href} onClick={handleNavClick}>
              <NavItem item={item} collapsed={collapsed} />
            </div>
          ))}

          {/* Buyer Section */}
          {!collapsed ? (
            <Collapsible open={buyerSectionOpen} onOpenChange={setBuyerSectionOpen} className="mt-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400">
                <span>Buyer Mode</span>
                <ChevronDown className={cn(
                  'h-4 w-4 transition-transform',
                  buyerSectionOpen && 'rotate-180'
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                {buyerNavItems.map((item) => (
                  <div key={item.href} onClick={handleNavClick}>
                    <NavItem item={item} collapsed={collapsed} />
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="mt-4 space-y-1">
              {buyerNavItems.map((item) => (
                <div key={item.href} onClick={handleNavClick}>
                  <NavItem item={item} collapsed={collapsed} />
                </div>
              ))}
            </div>
          )}
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
              <AvatarFallback className="bg-blue-600 text-white">
                {user?.email?.charAt(0).toUpperCase() || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-slate-400">Seller Account</p>
            </div>
          </div>
        )}
        
        <div className={cn('flex gap-2', collapsed ? 'flex-col' : 'flex-row')}>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            asChild
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={handleNavClick}
          >
            <Link href="/profile">
              <User className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Profile</span>}
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
    </div>
  )
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isSeller, setIsSeller] = useState<boolean | null>(null)
  const [isFicaVerified, setIsFicaVerified] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('seller-sidebar-collapsed')
    if (savedState !== null) {
      setCollapsed(JSON.parse(savedState))
    }
  }, [])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('seller-sidebar-collapsed', JSON.stringify(collapsed))
  }, [collapsed])

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault()
        setCollapsed(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const checkSellerStatus = async () => {
      if (authLoading) return
      
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('user_role, fica_status')
          .eq('user_id', user.id)
          .single()

        if (error) {
          console.error('Error checking seller status:', error)
          setIsSeller(false)
          router.push('/profile')
          return
        }

        const sellerStatus = profile?.user_role === 'seller'
        const ficaStatus = profile?.fica_status === 'verified'
        
        setIsSeller(sellerStatus)
        setIsFicaVerified(ficaStatus)

        if (!sellerStatus || !ficaStatus) {
          router.push('/profile')
          return
        }
      } catch (error) {
        console.error('Error checking seller status:', error)
        setIsSeller(false)
        router.push('/profile')
      } finally {
        setLoading(false)
      }
    }

    checkSellerStatus()
  }, [user, authLoading, router, supabase])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading seller dashboard...</p>
        </div>
      </div>
    )
  }

  if (isSeller === false || !isFicaVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Store className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Seller Access Required</h1>
          <p className="text-slate-400 mb-4">
            {!isSeller 
              ? "You need to be a verified seller to access this area."
              : "Please complete FICA verification to access seller features."
            }
          </p>
          <Button asChild>
            <Link href="/profile">Go to Profile</Link>
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
          <SidebarContent 
            collapsed={collapsed} 
            onCollapse={() => setCollapsed(!collapsed)} 
            setCollapsed={setCollapsed} 
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-800">
            <SidebarContent 
              collapsed={false} 
              onNavigate={() => setMobileOpen(false)}
            />
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
              <Store className="h-6 w-6 text-blue-500" />
              <span className="font-bold text-white">Seller Hub</span>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

export function useSellerSidebar() {
  return useContext(SidebarContext)
}

