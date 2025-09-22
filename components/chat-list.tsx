"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  MessageCircle, 
  Search, 
  Phone, 
  Eye, 
  Loader2,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import Link from "next/link"

interface Chat {
  chat_id: string
  part_id: string
  part_name: string
  part_image?: string
  other_user_id: string
  other_user_name: string
  other_user_avatar?: string
  last_message_text?: string
  last_message_at?: string
  unread_count: number
  phone_revealed: boolean
}

interface ChatListProps {
  onChatSelect?: (chatId: string) => void
  selectedChatId?: string
}

export function ChatList({ onChatSelect, selectedChatId }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchChats()
    
    // Set up polling for new messages
    const interval = setInterval(fetchChats, 30000) // Poll every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/messages')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch chats')
      }

      setChats(data.chats || [])
    } catch (error) {
      console.error('Error fetching chats:', error)
      if (isLoading) {
        toast({
          title: "Error",
          description: "Failed to load conversations. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const filteredChats = chats.filter(chat =>
    chat.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.other_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.last_message_text?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatLastMessageTime = (timestamp?: string) => {
    if (!timestamp) return ""
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const truncateMessage = (message?: string, maxLength: number = 50) => {
    if (!message) return "No messages yet"
    return message.length > maxLength ? `${message.substring(0, maxLength)}...` : message
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Conversations
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search terms"
                : "Start a conversation by messaging a seller about their parts"
              }
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/parts">
                  Browse Parts
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredChats.map((chat) => (
              <div
                key={chat.chat_id}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedChatId === chat.chat_id ? 'bg-muted' : ''
                }`}
                onClick={() => onChatSelect?.(chat.chat_id)}
              >
                <div className="flex items-start space-x-3">
                  {/* Part Image */}
                  <div className="relative">
                    <Image
                      src={chat.part_image || "/placeholder.svg"}
                      alt={chat.part_name}
                      width={48}
                      height={48}
                      className="rounded-md object-cover"
                    />
                    {chat.unread_count > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {chat.unread_count > 9 ? '9+' : chat.unread_count}
                      </Badge>
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {chat.other_user_name}
                      </h4>
                      <div className="flex items-center space-x-1">
                        {chat.phone_revealed && (
                          <Phone className="h-3 w-3 text-green-600" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatLastMessageTime(chat.last_message_at)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-1 truncate">
                      {chat.part_name}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${
                        chat.unread_count > 0 ? 'font-medium' : 'text-muted-foreground'
                      }`}>
                        {truncateMessage(chat.last_message_text)}
                      </p>
                      
                      {chat.unread_count > 0 && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
