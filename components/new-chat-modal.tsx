"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onStartChat: (message: string) => Promise<void>
  part?: {
    id: string
    name: string
    image_url?: string
    price: number
    shop_name?: string
  }
}

export function NewChatModal({ isOpen, onClose, onStartChat, part }: NewChatModalProps) {
  const [message, setMessage] = useState("")
  const [isStarting, setIsStarting] = useState(false)
  const { toast } = useToast()

  const handleStartChat = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to start the conversation.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsStarting(true)
      await onStartChat(message.trim())
      setMessage("")
    } catch (error) {
      console.error('Error starting chat:', error)
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleClose = () => {
    if (!isStarting) {
      setMessage("")
      onClose()
    }
  }

  const quickMessages = [
    "Hi! I'm interested in this part. Is it still available?",
    "Could you tell me more about the condition of this item?",
    "What's the best price you can offer?",
    "Do you have any more photos of this part?",
    "Is this item still under warranty?",
    "What's your return policy for this part?"
  ]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Start a Conversation
          </DialogTitle>
          <DialogDescription>
            Send a message to the seller about this part
          </DialogDescription>
        </DialogHeader>

        {part && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Image
                  src={part.image_url || "/placeholder.svg"}
                  alt={part.name}
                  width={48}
                  height={48}
                  className="rounded-md object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-sm line-clamp-2">{part.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-semibold text-sm">R{part.price.toFixed(2)}</span>
                    {part.shop_name && (
                      <Badge variant="outline" className="text-xs">
                        {part.shop_name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Your message</Label>
            <Textarea
              id="message"
              placeholder="Hi! I'm interested in this part. Could you tell me more about it?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              disabled={isStarting}
            />
          </div>

          {/* Quick message suggestions */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick messages</Label>
            <div className="grid grid-cols-1 gap-2">
              {quickMessages.map((quickMsg, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-left h-auto p-2 text-xs"
                  onClick={() => setMessage(quickMsg)}
                  disabled={isStarting}
                >
                  {quickMsg}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isStarting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartChat}
              disabled={!message.trim() || isStarting}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Start Chat
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
