import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'
import { getCsrfHeaders } from '@/lib/csrf-client'

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

export function useMessaging() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<ChatData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // Fetch all chats for the current user
  const fetchChats = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/messages')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch chats')
      }

      setChats(data.chats || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch chats'
      setError(errorMessage)
      console.error('Error fetching chats:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Fetch specific chat data
  const fetchChat = useCallback(async (chatId: string) => {
    if (!user) return

    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/messages/${chatId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch chat')
      }

      setCurrentChat(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch chat'
      setError(errorMessage)
      console.error('Error fetching chat:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Send a message
  const sendMessage = useCallback(async (chatId: string, message: string, messageType: 'text' | 'image' | 'file' = 'text', fileUrl?: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/messages/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          message,
          messageType,
          fileUrl
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      // Refresh current chat to get the new message
      if (currentChat?.chat.id === chatId) {
        await fetchChat(chatId)
      }

      // Refresh chats list to update last message
      await fetchChats()

      return data.message
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      console.error('Error sending message:', err)
      throw err
    }
  }, [user, currentChat, fetchChat, fetchChats])

  // Start a new chat
  const startChat = useCallback(async (partId: string, message: string) => {
    if (!user) return

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          partId,
          message,
          messageType: 'text'
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start chat')
      }

      // Refresh chats list
      await fetchChats()

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start chat'
      setError(errorMessage)
      console.error('Error starting chat:', err)
      throw err
    }
  }, [user, fetchChats])

  // Reveal phone number
  const revealPhone = useCallback(async (chatId: string) => {
    if (!user) return

    try {
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

      // Refresh current chat
      if (currentChat?.chat.id === chatId) {
        await fetchChat(chatId)
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal phone number'
      setError(errorMessage)
      console.error('Error revealing phone:', err)
      throw err
    }
  }, [user, currentChat, fetchChat])

  // Mark safety tips as shown
  const markSafetyTipsShown = useCallback(async (chatId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/messages/${chatId}/safety-tips`, {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark safety tips as shown')
      }

      return true
    } catch (err) {
      console.error('Error marking safety tips as shown:', err)
      return false
    }
  }, [user])

  // Upload file for message attachment
  const uploadFile = useCallback(async (file: File) => {
    if (!user) return

    try {
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

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file'
      setError(errorMessage)
      console.error('Error uploading file:', err)
      throw err
    }
  }, [user])

  // Get unread message count
  const getUnreadCount = useCallback(() => {
    return chats.reduce((total, chat) => total + chat.unread_count, 0)
  }, [chats])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load chats on mount
  useEffect(() => {
    if (user) {
      fetchChats()
    }
  }, [user, fetchChats])

  return {
    chats,
    currentChat,
    isLoading,
    error,
    fetchChats,
    fetchChat,
    sendMessage,
    startChat,
    revealPhone,
    markSafetyTipsShown,
    uploadFile,
    getUnreadCount,
    clearError,
    setCurrentChat
  }
}
