'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time of 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Don't refetch on window focus by default (can be overridden per query)
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Use useState to ensure the QueryClient is only created once per component instance
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

