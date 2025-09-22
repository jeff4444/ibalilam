"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, AlertTriangle, Eye, Phone, MessageCircle, CheckCircle } from "lucide-react"

interface SafetyTipsModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
}

export function SafetyTipsModal({ isOpen, onClose, onAccept }: SafetyTipsModalProps) {
  const [currentTip, setCurrentTip] = useState(0)

  const safetyTips = [
    {
      icon: <Shield className="h-6 w-6 text-blue-600" />,
      title: "Keep Personal Information Private",
      description: "Never share personal details like your home address, ID numbers, or financial information in chat messages. Use the platform's secure messaging system."
    },
    {
      icon: <Eye className="h-6 w-6 text-green-600" />,
      title: "Verify Before Meeting",
      description: "Always verify the seller's identity and the product condition before arranging any in-person meetings. Meet in public places during daylight hours."
    },
    {
      icon: <Phone className="h-6 w-6 text-purple-600" />,
      title: "Phone Number Protection",
      description: "Your phone number is hidden by default. Only reveal it when you're comfortable and have established trust with the other party through chat."
    },
    {
      icon: <MessageCircle className="h-6 w-6 text-orange-600" />,
      title: "Stay on Platform",
      description: "Keep all communication on our platform until you're ready to complete the transaction. This helps protect both parties and provides transaction records."
    },
    {
      icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
      title: "Report Suspicious Behavior",
      description: "If someone asks for payment outside the platform, requests personal information, or behaves suspiciously, report them immediately to our support team."
    }
  ]

  const handleNext = () => {
    if (currentTip < safetyTips.length - 1) {
      setCurrentTip(currentTip + 1)
    } else {
      onAccept()
    }
  }

  const handlePrevious = () => {
    if (currentTip > 0) {
      setCurrentTip(currentTip - 1)
    }
  }

  const handleSkip = () => {
    onAccept()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Safety Tips for Secure Trading
          </DialogTitle>
          <DialogDescription>
            Please review these important safety guidelines before starting your conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex justify-center space-x-2">
            {safetyTips.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index <= currentTip ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Current tip */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {safetyTips[currentTip].icon}
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {safetyTips[currentTip].title}
              </h3>
              <p className="text-muted-foreground text-sm">
                {safetyTips[currentTip].description}
              </p>
            </div>
          </div>

          {/* Warning alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Remember: Techafon is not responsible for transactions conducted outside our platform.
            </AlertDescription>
          </Alert>

          {/* Navigation buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentTip === 0}
            >
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip All
              </Button>
              <Button onClick={handleNext}>
                {currentTip === safetyTips.length - 1 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    I Understand
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </div>

          {/* Tip counter */}
          <div className="text-center text-sm text-muted-foreground">
            Tip {currentTip + 1} of {safetyTips.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
