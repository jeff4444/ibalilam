"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, TrendingDown } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PriceTier {
  id?: string
  min_qty: number
  unit_price: number
}

interface PriceTiersManagerProps {
  tiers: PriceTier[]
  moqUnits: number
  onChange: (tiers: PriceTier[]) => void
  basePrice: number
}

export function PriceTiersManager({ tiers, moqUnits, onChange, basePrice }: PriceTiersManagerProps) {
  const [localTiers, setLocalTiers] = useState<PriceTier[]>(tiers)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setLocalTiers(tiers)
  }, [tiers])

  const validateTiers = (tierList: PriceTier[]): string[] => {
    const validationErrors: string[] = []

    // Check if first tier matches MOQ
    if (tierList.length > 0 && tierList[0].min_qty !== moqUnits) {
      validationErrors.push(`First tier minimum quantity must equal MOQ (${moqUnits})`)
    }

    // Check for overlapping tiers
    const sortedTiers = [...tierList].sort((a, b) => a.min_qty - b.min_qty)
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      if (sortedTiers[i].min_qty === sortedTiers[i + 1].min_qty) {
        validationErrors.push('Tier quantities cannot be the same')
        break
      }
    }

    // Check that prices are non-increasing with higher quantities
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      if (sortedTiers[i].unit_price < sortedTiers[i + 1].unit_price) {
        validationErrors.push('Unit prices should decrease or stay the same with higher quantities')
        break
      }
    }

    // Check for valid values
    for (const tier of tierList) {
      if (tier.min_qty < 1) {
        validationErrors.push('Minimum quantity must be at least 1')
      }
      if (tier.unit_price <= 0) {
        validationErrors.push('Unit price must be greater than 0')
      }
    }

    return validationErrors
  }

  const updateTiers = (newTiers: PriceTier[]) => {
    setLocalTiers(newTiers)
    const validationErrors = validateTiers(newTiers)
    setErrors(validationErrors)
    
    if (validationErrors.length === 0) {
      onChange(newTiers)
    }
  }

  const addTier = () => {
    const lastTier = localTiers[localTiers.length - 1]
    const newMinQty = lastTier ? lastTier.min_qty + 10 : moqUnits + 10
    const newPrice = lastTier ? Math.max(lastTier.unit_price * 0.95, basePrice * 0.8) : basePrice * 0.9

    const newTier: PriceTier = {
      min_qty: newMinQty,
      unit_price: newPrice
    }

    updateTiers([...localTiers, newTier])
  }

  const removeTier = (index: number) => {
    const newTiers = localTiers.filter((_, i) => i !== index)
    updateTiers(newTiers)
  }

  const updateTier = (index: number, field: keyof PriceTier, value: string) => {
    const newTiers = [...localTiers]
    if (field === 'min_qty' || field === 'unit_price') {
      newTiers[index][field] = parseFloat(value) || 0
    }
    updateTiers(newTiers)
  }

  const sortTiers = () => {
    const sortedTiers = [...localTiers].sort((a, b) => a.min_qty - b.min_qty)
    updateTiers(sortedTiers)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Volume Pricing Tiers
        </CardTitle>
        <CardDescription>
          Set up volume discounts for larger orders. Prices should decrease with higher quantities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {localTiers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pricing tiers set up</p>
            <p className="text-sm">Add tiers to offer volume discounts</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Pricing Tiers ({localTiers.length})</Label>
              <Button variant="outline" size="sm" onClick={sortTiers}>
                Sort by Quantity
              </Button>
            </div>

            {localTiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center p-4 border rounded-lg">
                <div className="col-span-4">
                  <Label htmlFor={`tier-${index}-qty`} className="text-sm">
                    Min Quantity
                  </Label>
                  <Input
                    id={`tier-${index}-qty`}
                    type="number"
                    min="1"
                    value={tier.min_qty}
                    onChange={(e) => updateTier(index, 'min_qty', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-4">
                  <Label htmlFor={`tier-${index}-price`} className="text-sm">
                    Unit Price (ZAR)
                  </Label>
                  <Input
                    id={`tier-${index}-price`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={tier.unit_price}
                    onChange={(e) => updateTier(index, 'unit_price', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-3">
                  <div className="text-sm text-gray-600">
                    <div>Total for 100 units:</div>
                    <div className="font-medium">ZAR {(tier.unit_price * 100).toFixed(2)}</div>
                  </div>
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={addTier} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Pricing Tier
          </Button>
        </div>

        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
          <p><strong>Tips:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>First tier must start at your MOQ ({moqUnits} units)</li>
            <li>Higher quantities should have lower unit prices</li>
            <li>Consider your profit margins when setting tier prices</li>
            <li>Base price (ZAR {basePrice.toFixed(2)}) will be used for quantities below any tier</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
