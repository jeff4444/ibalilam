"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createClient } from "@/utils/supabase/client"
import { getCsrfHeaders } from "@/lib/csrf-client"

// Helper function to validate MOQ quantity
function validateMOQQuantity(item: CartItem): { isValid: boolean; error?: string; suggestedQuantity?: number } {
  const { quantity, moqUnits = 1, orderIncrement = 1, packSizeUnits } = item
  
  // Check minimum quantity
  if (quantity < moqUnits) {
    return {
      isValid: false,
      error: `Minimum order quantity is ${moqUnits}`,
      suggestedQuantity: moqUnits
    }
  }
  
  // Check pack size (takes precedence over order increment)
  if (packSizeUnits !== null && packSizeUnits !== undefined) {
    if (quantity % packSizeUnits !== 0) {
      const suggested = Math.ceil(quantity / packSizeUnits) * packSizeUnits
      return {
        isValid: false,
        error: `Quantity must be in packs of ${packSizeUnits}`,
        suggestedQuantity: suggested
      }
    }
  } else {
    // Check order increment
    if (quantity % orderIncrement !== 0) {
      const suggested = Math.ceil(quantity / orderIncrement) * orderIncrement
      return {
        isValid: false,
        error: `Quantity must be in increments of ${orderIncrement}`,
        suggestedQuantity: suggested
      }
    }
  }
  
  return { isValid: true }
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  seller: string
  condition: string
  stock: number
  // MOQ fields
  moqUnits?: number
  orderIncrement?: number
  packSizeUnits?: number | null
  stockOnHand?: number
  backorderAllowed?: boolean
  leadTimeDays?: number | null
  // Pricing
  tierPrice?: number
  tierName?: string
  // Validation
  isValidQuantity?: boolean
  validationError?: string
  suggestedQuantity?: number
}

interface CartStore {
  items: CartItem[]
  isSyncing: boolean
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number, priceInfo?: any) => void
  clearCart: () => void
  syncCart: () => Promise<void>
  getTotalItems: () => number
  getTotalPrice: () => number
  validateCart: () => { isValid: boolean; errors: string[] }
  getInvalidItems: () => CartItem[]
}

// Helper function to sync cart item to database
async function syncCartItemToDB(partId: string, quantity: number, tierPrice?: number, tierName?: string) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return // Not authenticated, skip DB sync
    
    const response = await fetch('/api/cart', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({
        partId,
        quantity,
        tierPrice,
        tierName,
      }),
    })
    
    if (!response.ok) {
      console.error('Failed to sync cart item to database')
    }
  } catch (error) {
    console.error('Error syncing cart item to database:', error)
  }
}

// Helper function to remove cart item from database
async function removeCartItemFromDB(partId: string) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return // Not authenticated, skip DB sync
    
    const response = await fetch(`/api/cart?partId=${partId}`, {
      method: 'DELETE',
      headers: {
        ...getCsrfHeaders(),
      },
    })
    
    if (!response.ok) {
      console.error('Failed to remove cart item from database')
    }
  } catch (error) {
    console.error('Error removing cart item from database:', error)
  }
}

// Helper function to add cart item to database
async function addCartItemToDB(partId: string, quantity: number, tierPrice?: number, tierName?: string) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return // Not authenticated, skip DB sync
    
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({
        partId,
        quantity,
        tierPrice,
        tierName,
      }),
    })
    
    if (!response.ok) {
      console.error('Failed to add cart item to database')
    }
  } catch (error) {
    console.error('Error adding cart item to database:', error)
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isSyncing: false,
      syncCart: async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          
          if (!user) return // Not authenticated, skip DB sync
          
          set({ isSyncing: true })
          
          // Fetch cart from database
          const response = await fetch('/api/cart')
          if (!response.ok) {
            console.error('Failed to fetch cart from database')
            set({ isSyncing: false })
            return
          }
          
          const { items: dbItems } = await response.json()
          
          // Merge with local cart (local takes precedence for conflicts)
          const localItems = get().items
          const mergedItems: CartItem[] = []
          const localItemMap = new Map(localItems.map(item => [item.id, item]))
          
          // Add all DB items first
          dbItems.forEach((dbItem: CartItem) => {
            const localItem = localItemMap.get(dbItem.id)
            if (localItem) {
              // If exists in both, use local (more recent)
              mergedItems.push(localItem)
              localItemMap.delete(dbItem.id)
            } else {
              // Only in DB, add it with validation
              const itemWithValidation = { ...dbItem }
              if (dbItem.moqUnits || dbItem.packSizeUnits || dbItem.orderIncrement) {
                const isValid = validateMOQQuantity(itemWithValidation)
                itemWithValidation.isValidQuantity = isValid.isValid
                itemWithValidation.validationError = isValid.error
                itemWithValidation.suggestedQuantity = isValid.suggestedQuantity
              }
              mergedItems.push(itemWithValidation)
            }
          })
          
          // Add remaining local items
          localItemMap.forEach(item => mergedItems.push(item))
          
          set({ items: mergedItems, isSyncing: false })
          
          // Sync local-only items to DB
          localItemMap.forEach(async (item) => {
            await addCartItemToDB(item.id, item.quantity, item.tierPrice, item.tierName)
          })
        } catch (error) {
          console.error('Error syncing cart:', error)
          set({ isSyncing: false })
        }
      },
      addItem: async (item) => {
        const items = get().items
        const existingItem = items.find((i) => i.id === item.id)

        if (existingItem) {
          const newQuantity = Math.min(existingItem.quantity + (item.quantity || 1), item.stock)
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: newQuantity } : i,
            ),
          })
          // Sync to database
          await syncCartItemToDB(item.id, newQuantity, item.tierPrice, item.tierName)
        } else {
          const newItem = { ...item, quantity: item.quantity || 1 }
          set({
            items: [...items, newItem],
          })
          // Sync to database
          await addCartItemToDB(item.id, newItem.quantity, item.tierPrice, item.tierName)
        }
      },
      removeItem: async (id) => {
        set({ items: get().items.filter((item) => item.id !== id) })
        // Sync to database
        await removeCartItemFromDB(id)
      },
      updateQuantity: async (id, quantity, priceInfo) => {
        if (quantity <= 0) {
          await get().removeItem(id)
          return
        }

        set({
          items: get().items.map((item) => {
            if (item.id === id) {
              const updatedItem = { 
                ...item, 
                quantity,
                tierPrice: priceInfo?.unit_price || item.price,
                tierName: priceInfo?.tier_name
              }
              
              // Update validation status
              if (item.moqUnits || item.packSizeUnits || item.orderIncrement) {
                const isValid = validateMOQQuantity(updatedItem)
                updatedItem.isValidQuantity = isValid.isValid
                updatedItem.validationError = isValid.error
                updatedItem.suggestedQuantity = isValid.suggestedQuantity
              }
              
              return updatedItem
            }
            return item
          }),
        })
        
        // Sync to database
        const updatedItem = get().items.find(item => item.id === id)
        if (updatedItem) {
          await syncCartItemToDB(id, quantity, updatedItem.tierPrice, updatedItem.tierName)
        }
      },
      clearCart: async () => {
        const items = get().items
        // Remove all items from database first
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Remove each item from DB
          await Promise.all(items.map(item => removeCartItemFromDB(item.id)))
        }
        set({ items: [] })
      },
      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
      getTotalPrice: () => get().items.reduce((total, item) => {
        const itemPrice = item.tierPrice || item.price
        return total + itemPrice * item.quantity
      }, 0),
      validateCart: () => {
        const items = get().items
        const errors: string[] = []
        
        items.forEach(item => {
          if (item.isValidQuantity === false) {
            errors.push(`${item.name}: ${item.validationError}`)
          }
        })
        
        return {
          isValid: errors.length === 0,
          errors
        }
      },
      getInvalidItems: () => {
        return get().items.filter(item => item.isValidQuantity === false)
      },
    }),
    {
      name: "cart-storage",
    },
  ),
)
