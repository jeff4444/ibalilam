"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageCircle, Plus } from "lucide-react"
import { ChatList } from "@/components/chat-list"
import { ChatInterface } from "@/components/chat-interface"
import { NewChatModal } from "@/components/new-chat-modal"
import { useAuth } from "@/hooks/use-auth"
import { useMessaging } from "@/hooks/use-messaging"
import { usePart } from "@/hooks/use-part"
import Link from "next/link"

export default function MessagesPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const searchParams = useSearchParams()
  const partId = searchParams.get('part')
  
  const { user } = useAuth()
  const { chats, currentChat, fetchChat, startChat, isLoading } = useMessaging()
  const { part } = usePart(partId || '')

  const handleChatSelect = async (chatId: string) => {
    setSelectedChatId(chatId)
    await fetchChat(chatId)
  }

  const handleCloseChat = () => {
    setSelectedChatId(null)
  }

  // Handle starting a new chat from part page
  useEffect(() => {
    if (partId && part && user) {
      // Check if chat already exists for this part
      const existingChat = chats.find(chat => chat.part_id === partId)
      if (existingChat) {
        handleChatSelect(existingChat.chat_id)
      } else {
        setShowNewChatModal(true)
      }
    }
  }, [partId, part, user, chats])

  const handleStartNewChat = async (message: string) => {
    if (!partId || !message.trim()) return

    try {
      const result = await startChat(partId, message)
      if (result?.chatId) {
        setSelectedChatId(result.chatId)
        await fetchChat(result.chatId)
        setShowNewChatModal(false)
      }
    } catch (error) {
      console.error('Error starting chat:', error)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view messages</h1>
          <p className="text-muted-foreground mb-4">
            You need to be signed in to access your conversations.
          </p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">
            Chat with sellers about their parts
          </p>
        </div>
        <Button asChild>
          <Link href="/parts">
            <Plus className="h-4 w-4 mr-2" />
            Browse Parts
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Chat List */}
        <div className="lg:col-span-1">
          <ChatList
            onChatSelect={handleChatSelect}
            selectedChatId={selectedChatId}
          />
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          {selectedChatId && currentChat ? (
            <Card className="h-full flex flex-col">
              <ChatInterface
                chatId={selectedChatId}
                currentUserId={user.id}
                onClose={handleCloseChat}
              />
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a conversation from the list to start chatting
                </p>
                {chats.length === 0 && (
                  <Button asChild>
                    <Link href="/parts">
                      <Plus className="h-4 w-4 mr-2" />
                      Start Your First Conversation
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onStartChat={handleStartNewChat}
        part={part ? {
          id: part.id,
          name: part.name,
          image_url: part.image_url,
          price: part.price,
          shop_name: part.shop_name
        } : undefined}
      />
    </div>
  )
}
