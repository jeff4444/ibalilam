"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

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
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number, priceInfo?: any) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  validateCart: () => { isValid: boolean; errors: string[] }
  getInvalidItems: () => CartItem[]
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const items = get().items
        const existingItem = items.find((i) => i.id === item.id)

        if (existingItem) {
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: Math.min(i.quantity + (item.quantity || 1), i.stock) } : i,
            ),
          })
        } else {
          set({
            items: [...items, { ...item, quantity: item.quantity || 1 }],
          })
        }
      },
      removeItem: (id) => {
        set({ items: get().items.filter((item) => item.id !== id) })
      },
      updateQuantity: (id, quantity, priceInfo) => {
        if (quantity <= 0) {
          get().removeItem(id)
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
      },
      clearCart: () => set({ items: [] }),
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
