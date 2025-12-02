"use client"

import { useState, useRef, useEffect } from "react"
import {
  ArrowDownToLine,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useWallet } from "@/hooks/use-wallet"

interface WalletDepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const presetAmounts = [100, 250, 500, 1000, 2500, 5000]

export function WalletDepositModal({ open, onOpenChange }: WalletDepositModalProps) {
  const [amount, setAmount] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { initiateDeposit } = useWallet()

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setAmount("")
      setError(null)
    }
  }, [open])

  const handlePresetClick = (value: number) => {
    setAmount(value.toString())
    setError(null)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(value)
    setError(null)
  }

  const handleSubmit = async () => {
    const depositAmount = parseFloat(amount)
    
    if (!depositAmount || isNaN(depositAmount)) {
      setError("Please enter a valid amount")
      return
    }

    if (depositAmount < 10) {
      setError("Minimum deposit amount is R10")
      return
    }

    if (depositAmount > 100000) {
      setError("Maximum deposit amount is R100,000")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await initiateDeposit(depositAmount)
      
      if (!result) {
        setError("Failed to initiate deposit. Please try again.")
        return
      }

      // Create a form and submit to PayFast
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = result.payfastUrl
      form.target = '_self'

      // Add all PayFast data as hidden fields
      Object.entries(result.payfastData).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (err: any) {
      console.error("Deposit error:", err)
      setError(err.message || "Failed to initiate deposit")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
            Deposit Funds
          </DialogTitle>
          <DialogDescription>
            Add funds to your wallet using PayFast secure payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Deposit Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                R
              </span>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-8 text-lg font-semibold h-12"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum deposit: R10 • Maximum: R100,000
            </p>
          </div>

          {/* Preset Amounts */}
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="grid grid-cols-3 gap-2">
              {presetAmounts.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset.toString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  disabled={loading}
                  className="font-medium"
                >
                  R{preset.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) >= 10 && (
            <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deposit Amount</span>
                <span className="font-medium">R {parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="font-medium text-emerald-600">Free</span>
              </div>
              <div className="border-t border-emerald-200 pt-2 flex justify-between">
                <span className="font-medium">You'll Receive</span>
                <span className="font-bold text-emerald-600">
                  R {parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <CreditCard className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              You'll be redirected to PayFast to complete your payment securely
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !amount || parseFloat(amount) < 10}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Deposit R{amount ? parseFloat(amount).toLocaleString() : '0'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

