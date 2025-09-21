import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MOQValidation, TierPrice, AvailableQuantity, PriceTier } from './use-parts'

export function useMOQ() {
  const supabase = createClient()

  // Validate MOQ quantity for a part
  const validateMOQQuantity = useCallback(async (partId: string, quantity: number): Promise<MOQValidation> => {
    try {
      const { data, error } = await supabase.rpc('validate_moq_quantity', {
        part_id_param: partId,
        quantity: quantity
      })

      if (error) {
        throw new Error(error.message)
      }

      return data?.[0] || { is_valid: false, error_message: 'Validation failed', suggested_quantity: quantity }
    } catch (err: any) {
      console.error('Error validating MOQ quantity:', err)
      return { is_valid: false, error_message: err.message, suggested_quantity: quantity }
    }
  }, [supabase])

  // Get tier pricing for a part and quantity
  const getTierPrice = useCallback(async (partId: string, quantity: number): Promise<TierPrice> => {
    try {
      const { data, error } = await supabase.rpc('get_tier_price', {
        part_id_param: partId,
        quantity: quantity
      })

      if (error) {
        throw new Error(error.message)
      }

      return data?.[0] || { unit_price: 0, total_price: 0, tier_name: 'Base Price' }
    } catch (err: any) {
      console.error('Error getting tier price:', err)
      return { unit_price: 0, total_price: 0, tier_name: 'Base Price' }
    }
  }, [supabase])

  // Get available quantity for a part
  const getAvailableQuantity = useCallback(async (partId: string): Promise<AvailableQuantity> => {
    try {
      const { data, error } = await supabase.rpc('get_available_quantity', {
        part_id_param: partId
      })

      if (error) {
        throw new Error(error.message)
      }

      return data?.[0] || { in_stock: 0, backorder_available: false, lead_time_days: null }
    } catch (err: any) {
      console.error('Error getting available quantity:', err)
      return { in_stock: 0, backorder_available: false, lead_time_days: null }
    }
  }, [supabase])

  // Get price tiers for a part
  const getPriceTiers = useCallback(async (partId: string): Promise<PriceTier[]> => {
    try {
      const { data, error } = await supabase
        .from('price_tiers')
        .select('*')
        .eq('part_id', partId)
        .order('min_qty', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    } catch (err: any) {
      console.error('Error getting price tiers:', err)
      return []
    }
  }, [supabase])

  // Calculate the starting quantity for quantity selector
  const calculateStartingQuantity = useCallback((moqUnits: number, packSizeUnits: number | null): number => {
    if (packSizeUnits !== null && packSizeUnits > 0) {
      // Start with at least one pack, but ensure it meets MOQ
      return Math.max(moqUnits, packSizeUnits)
    }
    return moqUnits
  }, [])

  // Calculate quantity step for quantity selector
  const calculateQuantityStep = useCallback((packSizeUnits: number | null, orderIncrement: number): number => {
    if (packSizeUnits !== null && packSizeUnits > 0) {
      return packSizeUnits
    }
    return orderIncrement
  }, [])

  // Check if quantity is valid for MOQ rules
  const isQuantityValid = useCallback((
    quantity: number,
    moqUnits: number,
    orderIncrement: number,
    packSizeUnits: number | null
  ): boolean => {
    // Check minimum quantity
    if (quantity < moqUnits) {
      return false
    }

    // Check pack size (takes precedence over order increment)
    if (packSizeUnits !== null) {
      return quantity % packSizeUnits === 0
    }

    // Check order increment
    return quantity % orderIncrement === 0
  }, [])

  // Suggest valid quantity
  const suggestValidQuantity = useCallback((
    quantity: number,
    moqUnits: number,
    orderIncrement: number,
    packSizeUnits: number | null
  ): number => {
    let suggested = quantity

    // Ensure minimum quantity
    if (suggested < moqUnits) {
      suggested = moqUnits
    }

    // Apply pack size rule (takes precedence)
    if (packSizeUnits !== null && packSizeUnits > 0) {
      suggested = Math.ceil(suggested / packSizeUnits) * packSizeUnits
    } else {
      // Apply order increment rule
      suggested = Math.ceil(suggested / orderIncrement) * orderIncrement
    }

    return suggested
  }, [])

  return {
    validateMOQQuantity,
    getTierPrice,
    getAvailableQuantity,
    getPriceTiers,
    calculateStartingQuantity,
    calculateQuantityStep,
    isQuantityValid,
    suggestValidQuantity
  }
}
