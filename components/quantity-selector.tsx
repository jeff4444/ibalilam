"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { useMOQ } from '@/hooks/use-moq'
import { AvailableQuantity } from '@/hooks/use-parts'

interface QuantitySelectorProps {
  partId: string
  initialQuantity: number
  moqUnits: number
  orderIncrement: number
  packSizeUnits: number | null
  onQuantityChange: (quantity: number, isValid: boolean, priceInfo: any) => void
  className?: string
}

export function QuantitySelector({
  partId,
  initialQuantity,
  moqUnits,
  orderIncrement,
  packSizeUnits,
  onQuantityChange,
  className = ""
}: QuantitySelectorProps) {
  const [quantity, setQuantity] = useState(initialQuantity)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [availableQuantity, setAvailableQuantity] = useState<AvailableQuantity | null>(null)
  const [priceInfo, setPriceInfo] = useState<any>(null)
  const [showBackorderWarning, setShowBackorderWarning] = useState(false)

  const {
    validateMOQQuantity,
    getTierPrice,
    getAvailableQuantity,
    calculateStartingQuantity,
    calculateQuantityStep,
    isQuantityValid,
    suggestValidQuantity
  } = useMOQ()

  // Calculate starting quantity and step
  const startingQty = calculateStartingQuantity(moqUnits, packSizeUnits)
  const stepSize = calculateQuantityStep(packSizeUnits, orderIncrement)

  useEffect(() => {
    setQuantity(Math.max(initialQuantity, startingQty))
  }, [initialQuantity, startingQty])

  useEffect(() => {
    // Load available quantity on mount
    loadAvailableQuantity()
  }, [partId])

  useEffect(() => {
    // Validate quantity whenever it changes
    validateQuantity()
  }, [quantity])

  const loadAvailableQuantity = async () => {
    try {
      const available = await getAvailableQuantity(partId)
      setAvailableQuantity(available)
    } catch (error) {
      console.error('Error loading available quantity:', error)
    }
  }

  const validateQuantity = async () => {
    setIsValidating(true)
    
    try {
      // Check if quantity is valid according to MOQ rules
      const isClientValid = isQuantityValid(quantity, moqUnits, orderIncrement, packSizeUnits)
      
      if (!isClientValid) {
        const suggested = suggestValidQuantity(quantity, moqUnits, orderIncrement, packSizeUnits)
        setValidationResult({
          is_valid: false,
          error_message: `Invalid quantity. Suggested: ${suggested}`,
          suggested_quantity: suggested
        })
        setPriceInfo(null)
        onQuantityChange(quantity, false, null)
        return
      }

      // Validate with server
      const validation = await validateMOQQuantity(partId, quantity)
      setValidationResult(validation)

      // Get tier pricing
      const pricing = await getTierPrice(partId, quantity)
      setPriceInfo(pricing)

      // Check for backorder
      if (availableQuantity && quantity > availableQuantity.in_stock && availableQuantity.backorder_available) {
        setShowBackorderWarning(true)
      } else {
        setShowBackorderWarning(false)
      }

      onQuantityChange(quantity, validation.is_valid, pricing)
    } catch (error) {
      console.error('Error validating quantity:', error)
      setValidationResult({
        is_valid: false,
        error_message: 'Validation error occurred',
        suggested_quantity: quantity
      })
      onQuantityChange(quantity, false, null)
    } finally {
      setIsValidating(false)
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity)
  }

  const handleAutoFix = () => {
    if (validationResult?.suggested_quantity) {
      setQuantity(validationResult.suggested_quantity)
    }
  }

  const adjustQuantity = (delta: number) => {
    const newQuantity = Math.max(startingQty, quantity + delta)
    setQuantity(newQuantity)
  }

  const getQuantityRule = () => {
    if (packSizeUnits) {
      return `Must order in packs of ${packSizeUnits} units`
    }
    return `Must order in increments of ${orderIncrement} units`
  }

  const getStockStatus = () => {
    if (!availableQuantity) return null

    if (quantity <= availableQuantity.in_stock) {
      return { type: 'in-stock', message: `${availableQuantity.in_stock} in stock` }
    } else if (availableQuantity.backorder_available) {
      return { 
        type: 'backorder', 
        message: `${availableQuantity.in_stock} in stock, ${quantity - availableQuantity.in_stock} backorder (${availableQuantity.lead_time_days} days)` 
      }
    } else {
      return { type: 'out-of-stock', message: 'Out of stock' }
    }
  }

  const stockStatus = getStockStatus()

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Quantity Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Quantity</label>
          {isValidating && <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustQuantity(-stepSize)}
            disabled={quantity <= startingQty || isValidating}
          >
            -
          </Button>
          
          <Input
            type="number"
            min={startingQty}
            step={stepSize}
            value={quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || startingQty)}
            className="w-20 text-center"
            disabled={isValidating}
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustQuantity(stepSize)}
            disabled={isValidating}
          >
            +
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          {getQuantityRule()} • Min: {moqUnits}
        </p>
      </div>

      {/* Validation Messages */}
      {validationResult && !validationResult.is_valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{validationResult.error_message}</span>
            {validationResult.suggested_quantity && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoFix}
                className="ml-2"
              >
                Auto-fix to {validationResult.suggested_quantity}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {validationResult && validationResult.is_valid && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Quantity is valid for ordering
          </AlertDescription>
        </Alert>
      )}

      {/* Stock Status */}
      {stockStatus && (
        <div className={`text-sm flex items-center gap-2 ${
          stockStatus.type === 'in-stock' ? 'text-green-600' :
          stockStatus.type === 'backorder' ? 'text-orange-600' :
          'text-red-600'
        }`}>
          {stockStatus.type === 'in-stock' && <CheckCircle className="h-4 w-4" />}
          {stockStatus.type === 'backorder' && <Clock className="h-4 w-4" />}
          {stockStatus.type === 'out-of-stock' && <AlertTriangle className="h-4 w-4" />}
          {stockStatus.message}
        </div>
      )}

      {/* Backorder Warning */}
      {showBackorderWarning && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This order includes backordered items. Please confirm you're okay with the lead time.
          </AlertDescription>
        </Alert>
      )}

      {/* Price Information */}
      {priceInfo && (
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Unit Price:</span>
            <span className="font-medium">ZAR {priceInfo.unit_price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total:</span>
            <span>ZAR {priceInfo.total_price.toFixed(2)}</span>
          </div>
          {priceInfo.tier_name !== 'Base Price' && (
            <div className="text-xs text-gray-500">
              {priceInfo.tier_name}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
