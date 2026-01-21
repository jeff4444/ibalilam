"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getCsrfHeaders } from "@/lib/csrf-client"
import { 
  Send, 
  Image as ImageIcon, 
  Phone, 
  Eye, 
  EyeOff, 
  MessageCircle,
  AlertTriangle,
  Loader2,
  Paperclip
} from "lucide-react"
import { SafetyTipsModal } from "./safety-tips-modal"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface Message {
  id: string
  sender_id: string
  message_text: string
  message_type: 'text' | 'image' | 'file'
  file_url?: string
  is_read: boolean
  created_at: string
  user_profiles?: {
    first_name?: string
    last_name?: string
    full_name?: string
  }
}

interface ChatData {
  chat: {
    id: string
    part_id: string
    buyer_id: string
    seller_id: string
    phone_revealed_by_buyer: boolean
    phone_revealed_by_seller: boolean
    phone_revealed_at?: string
    safety_tips_shown: boolean
    parts: {
      id: string
      name: string
      image_url?: string
      price: number
      shops: {
        id: string
        name: string
        user_id: string
      }
    }
  }
  messages: Message[]
  otherUser?: {
    first_name?: string
    last_name?: string
    full_name?: string
    phone?: string
    avatar_url?: string
  }
}

interface ChatInterfaceProps {
  chatId: string
  currentUserId: string
  onClose?: () => void
}

export function ChatInterface({ chatId, currentUserId, onClose }: ChatInterfaceProps) {
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showSafetyTips, setShowSafetyTips] = useState(false)
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [isRevealingPhone, setIsRevealingPhone] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatData?.messages])

  useEffect(() => {
    fetchChatData()
  }, [chatId])

  const fetchChatData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/messages/${chatId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch chat data')
      }

      setChatData(data)
      setPhoneRevealed(data.chat.phone_revealed_by_buyer && data.chat.phone_revealed_by_seller)
      setShowPhone(phoneRevealed)

      // Show safety tips if not shown before
      if (!data.chat.safety_tips_shown) {
        setShowSafetyTips(true)
      }
    } catch (error) {
      console.error('Error fetching chat data:', error)
      toast({
        title: "Error",
        description: "Failed to load chat. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    try {
      setIsSending(true)
      const response = await fetch(`/api/messages/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          messageType: 'text'
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      setNewMessage("")
      // Refresh chat data to get the new message
      await fetchChatData()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file')
      }

      // Send message with image
      const messageResponse = await fetch(`/api/messages/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          message: `📷 Image`,
          messageType: 'image',
          fileUrl: data.url
        }),
      })

      if (!messageResponse.ok) {
        throw new Error('Failed to send image message')
      }

      await fetchChatData()
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const revealPhone = async () => {
    try {
      setIsRevealingPhone(true)
      const response = await fetch(`/api/messages/${chatId}/reveal-phone`, {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reveal phone number')
      }

      if (data.phoneRevealed) {
        setPhoneRevealed(true)
        setShowPhone(true)
        toast({
          title: "Phone numbers revealed",
          description: "Both parties have revealed their phone numbers.",
        })
      } else {
        toast({
          title: "Phone number revealed",
          description: "Your phone number has been revealed. Waiting for the other party to reveal theirs.",
        })
      }

      await fetchChatData()
    } catch (error) {
      console.error('Error revealing phone:', error)
      toast({
        title: "Error",
        description: "Failed to reveal phone number. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRevealingPhone(false)
    }
  }

  const handleSafetyTipsAccept = async () => {
    try {
      await fetch(`/api/messages/${chatId}/safety-tips`, {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
        },
      })
      setShowSafetyTips(false)
    } catch (error) {
      console.error('Error marking safety tips as shown:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!chatData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load chat. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const otherUser = chatData.otherUser
  const isBuyer = chatData.chat.buyer_id === currentUserId
  const canRevealPhone = isBuyer ? !chatData.chat.phone_revealed_by_buyer : !chatData.chat.phone_revealed_by_seller

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-0">
      <SafetyTipsModal
        isOpen={showSafetyTips}
        onClose={() => setShowSafetyTips(false)}
        onAccept={handleSafetyTipsAccept}
      />

      {/* Chat Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={otherUser?.avatar_url} />
              <AvatarFallback>
                {otherUser?.full_name?.charAt(0) || otherUser?.first_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {otherUser?.full_name || `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || 'Unknown User'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {chatData.chat.parts.name}
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Part Info */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center space-x-3">
          <Image
            src={chatData.chat.parts.image_url || "/placeholder.svg"}
            alt={chatData.chat.parts.name}
            width={40}
            height={40}
            className="rounded-md object-cover"
          />
          <div className="flex-1">
            <p className="font-medium text-sm">{chatData.chat.parts.name}</p>
            <p className="text-sm text-muted-foreground">R{chatData.chat.parts.price.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Phone Reveal Section */}
      {!phoneRevealed && (
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Phone numbers hidden</span>
            </div>
            {canRevealPhone && (
              <Button
                size="sm"
                variant="outline"
                onClick={revealPhone}
                disabled={isRevealingPhone}
              >
                {isRevealingPhone ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Reveal My Number
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Both parties must reveal their numbers to see contact information.
          </p>
        </div>
      )}

      {/* Phone Numbers (if revealed) */}
      {phoneRevealed && otherUser?.phone && (
        <div className="p-4 border-b bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Contact Information</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPhone(!showPhone)}
            >
              {showPhone ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {showPhone && (
            <div className="mt-2 space-y-1">
              <p className="text-sm">
                <span className="font-medium">Their phone:</span> {otherUser.phone}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {chatData.messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUserId
          const senderName = message.user_profiles?.full_name || 
                           `${message.user_profiles?.first_name || ''} ${message.user_profiles?.last_name || ''}`.trim() ||
                           'Unknown'

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                {!isOwnMessage && (
                  <p className="text-xs text-muted-foreground mb-1">{senderName}</p>
                )}
                <div
                  className={`rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted'
                  }`}
                >
                  {message.message_type === 'image' && message.file_url ? (
                    <div className="space-y-2">
                      <Image
                        src={message.file_url}
                        alt="Message attachment"
                        width={200}
                        height={200}
                        className="rounded-md object-cover"
                      />
                      <p className="text-sm">{message.message_text}</p>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(message.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Message Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="sm"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
