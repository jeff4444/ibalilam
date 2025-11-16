"use client"

import Link from "next/link"
import { Cpu } from "lucide-react"
import { CartButton } from "./cart-button"
import { useAuth } from "@/hooks/use-auth"

export function MainNavbar() {
  const { user, loading } = useAuth()

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
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/messages">
              Messages
            </Link>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
              Dashboard
            </Link>
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


