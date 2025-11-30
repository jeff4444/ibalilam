"use client"

import Link from "next/link"
import { Cpu } from "lucide-react"
import { CartButton } from "./cart-button"
import { useAuth } from "@/hooks/use-auth"
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCartStore } from "@/lib/cart-store"

export function MainNavbar() {
  const { user, loading } = useAuth()
  const [isSeller, setIsSeller] = useState<boolean | null>(null)
  const [isFicaVerified, setIsFicaVerified] = useState<boolean>(false)
  const supabase = createClient()
  const syncCart = useCartStore((state) => state.syncCart)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) {
        setIsSeller(null)
        setIsFicaVerified(false)
        return
      }

      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("user_role, fica_status")
          .eq("user_id", user.id)
          .single()

        setIsSeller(profile?.user_role === "seller")
        setIsFicaVerified(profile?.fica_status === "verified")
      } catch (error) {
        console.error("Error fetching user role for navbar:", error)
        setIsSeller(null)
        setIsFicaVerified(false)
      }
    }

    fetchUserRole()
  }, [user?.id, supabase])

  // Sync cart when user logs in
  useEffect(() => {
    if (user && !loading) {
      syncCart()
    }
  }, [user, loading, syncCart])

  return (
    <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
      <Link className="flex items-center justify-center" href="/">
        <Cpu className="h-6 w-6 mr-2 text-blue-600" />
        <span className="font-bold text-xl">Techafon</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
        <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
          Browse Parts
        </Link>
        {user && (
          <>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
              Favorites
            </Link>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/orders">
              Orders
            </Link>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/messages">
              Messages
            </Link>
            {isSeller && isFicaVerified && (
              <>
                <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard/transactions">
                  Transactions
                </Link>
              </>
            )}
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
              Profile
            </Link>
          </>
        )}
        {!user && !loading && (
          <>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/login">
              Login
            </Link>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/signup">
              Sign Up
            </Link>
          </>
        )}
        <CartButton />
      </nav>
    </header>
  )
}


