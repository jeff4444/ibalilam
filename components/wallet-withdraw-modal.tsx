"use client"

import { useState, useEffect } from "react"
import {
  ArrowUpFromLine,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  Clock,
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

interface WalletWithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableBalance: number
  minAmount: number
  maxAmount: number
}

export function WalletWithdrawModal({ 
  open, 
  onOpenChange,
  availableBalance,
  minAmount,
  maxAmount 
}: WalletWithdrawModalProps) {
  const [amount, setAmount] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { initiateWithdrawal } = useWallet()

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setAmount("")
      setError(null)
      setSuccess(false)
    }
  }, [open])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(value)
    setError(null)
  }

  const handleWithdrawAll = () => {
    const withdrawAmount = Math.min(availableBalance, maxAmount)
    setAmount(withdrawAmount.toString())
    setError(null)
  }

  const handleSubmit = async () => {
    const withdrawAmount = parseFloat(amount)
    
    if (!withdrawAmount || isNaN(withdrawAmount)) {
      setError("Please enter a valid amount")
      return
    }

    if (withdrawAmount < minAmount) {
      setError(`Minimum withdrawal amount is R${minAmount.toFixed(2)}`)
      return
    }

    if (withdrawAmount > maxAmount) {
      setError(`Maximum withdrawal amount is R${maxAmount.toFixed(2)}`)
      return
    }

    if (withdrawAmount > availableBalance) {
      setError("Insufficient balance")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await initiateWithdrawal(withdrawAmount)
      
      if (!result.success) {
        setError(result.error || "Failed to process withdrawal")
        return
      }

      setSuccess(true)
    } catch (err: any) {
      console.error("Withdrawal error:", err)
      setError(err.message || "Failed to process withdrawal")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Withdrawal Submitted!</h3>
        <p className="text-muted-foreground mb-4">
          Your withdrawal request of R{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} has been submitted and is awaiting admin approval.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3 mb-6">
          <Clock className="h-4 w-4" />
          <span>Your balance will be deducted once approved (1-3 business days)</span>
        </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-red-600" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription>
            Withdraw funds from your wallet to your bank account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Available Balance Display */}
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Available Balance</div>
            <div className="text-2xl font-bold text-emerald-600">
              R {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdraw-amount">Withdrawal Amount</Label>
              <Button 
                type="button" 
                variant="link" 
                size="sm" 
                onClick={handleWithdrawAll}
                disabled={loading || availableBalance < minAmount}
                className="h-auto p-0 text-xs"
              >
                Withdraw Max
              </Button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                R
              </span>
              <Input
                id="withdraw-amount"
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
              Min: R{minAmount.toLocaleString()} • Max: R{maxAmount.toLocaleString()}
            </p>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) >= minAmount && parseFloat(amount) <= availableBalance && (
            <div className="bg-amber-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-medium">R {parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-amber-200 pt-2 flex justify-between">
                <span className="font-medium">Balance After Approval</span>
                <span className="font-bold text-emerald-600">
                  R {(availableBalance - parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-amber-700">
                Your balance will only be deducted after admin approval
              </p>
            </div>
          )}

          {/* Payment Info */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Building2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Bank Transfer via PayFast</p>
              <p className="text-amber-700 mt-1">
                Funds will be sent to your linked bank account. Processing typically takes 1-3 business days.
              </p>
            </div>
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
              disabled={
                loading || 
                !amount || 
                parseFloat(amount) < minAmount || 
                parseFloat(amount) > availableBalance
              }
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Withdraw R{amount ? parseFloat(amount).toLocaleString() : '0'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

