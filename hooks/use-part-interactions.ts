import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface PartInteraction {
  partId: string
  views: number
  saves: number
  chats: number
  recentViews: number
}

export interface PartChat {
  id: string
  partId: string
  buyerId: string
  sellerId: string
  lastMessageAt: string
  isActive: boolean
  createdAt: string
  partName?: string
  buyerName?: string
  sellerName?: string
  unreadCount?: number
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  messageText: string
  messageType: 'text' | 'image' | 'file'
  fileUrl?: string
  isRead: boolean
  createdAt: string
  senderName?: string
}

export function usePartInteractions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Get interaction stats for a part
  const getPartInteractions = useCallback(async (partId: string): Promise<PartInteraction | null> => {
    try {
      setLoading(true)
      setError(null)

      // Get views count
      const { data: viewsData, error: viewsError } = await supabase
        .from('part_view_logs')
        .select('id', { count: 'exact' })
        .eq('part_id', partId)

      if (viewsError) throw viewsError

      // Get saves count
      const { data: savesData, error: savesError } = await supabase
        .from('part_saves')
        .select('id', { count: 'exact' })
        .eq('part_id', partId)

      if (savesError) throw savesError

      // Get chats count
      const { data: chatsData, error: chatsError } = await supabase
        .from('part_chats')
        .select('id', { count: 'exact' })
        .eq('part_id', partId)
        .eq('is_active', true)

      if (chatsError) throw chatsError

      // Get recent views (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: recentViewsData, error: recentViewsError } = await supabase
        .from('part_view_logs')
        .select('id', { count: 'exact' })
        .eq('part_id', partId)
        .gte('viewed_at', sevenDaysAgo.toISOString())

      if (recentViewsError) throw recentViewsError

      return {
        partId,
        views: viewsData?.length || 0,
        saves: savesData?.length || 0,
        chats: chatsData?.length || 0,
        recentViews: recentViewsData?.length || 0
      }
    } catch (err: any) {
      console.error('Error getting part interactions:', err)
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Get interaction stats for multiple parts
  const getMultiplePartInteractions = useCallback(async (partIds: string[]): Promise<Record<string, PartInteraction>> => {
    try {
      setLoading(true)
      setError(null)

      const results: Record<string, PartInteraction> = {}

      // Get all interactions in parallel
      const [viewsData, savesData, chatsData, recentViewsData] = await Promise.all([
        supabase
          .from('part_view_logs')
          .select('part_id, id')
          .in('part_id', partIds),
        supabase
          .from('part_saves')
          .select('part_id, id')
          .in('part_id', partIds),
        supabase
          .from('part_chats')
          .select('part_id, id')
          .in('part_id', partIds)
          .eq('is_active', true),
        supabase
          .from('part_view_logs')
          .select('part_id, id')
          .in('part_id', partIds)
          .gte('viewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ])

      // Initialize results for all parts
      partIds.forEach(partId => {
        results[partId] = {
          partId,
          views: 0,
          saves: 0,
          chats: 0,
          recentViews: 0
        }
      })

      // Count views
      viewsData.data?.forEach(view => {
        if (results[view.part_id]) {
          results[view.part_id].views++
        }
      })

      // Count saves
      savesData.data?.forEach(save => {
        if (results[save.part_id]) {
          results[save.part_id].saves++
        }
      })

      // Count chats
      chatsData.data?.forEach(chat => {
        if (results[chat.part_id]) {
          results[chat.part_id].chats++
        }
      })

      // Count recent views
      recentViewsData.data?.forEach(view => {
        if (results[view.part_id]) {
          results[view.part_id].recentViews++
        }
      })

      return results
    } catch (err: any) {
      console.error('Error getting multiple part interactions:', err)
      setError(err.message)
      return {}
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Log a view for a part
  const logPartView = useCallback(async (partId: string, userAgent?: string, referrer?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('part_view_logs')
        .insert({
          part_id: partId,
          user_id: user?.id || null,
          user_agent: userAgent,
          referrer: referrer
        })

      if (error) throw error
    } catch (err: any) {
      console.error('Error logging part view:', err)
      // Don't throw error for view logging as it's not critical
    }
  }, [supabase])

  // Save/unsave a part
  const togglePartSave = useCallback(async (partId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Check if already saved
      const { data: existingSave } = await supabase
        .from('part_saves')
        .select('id')
        .eq('part_id', partId)
        .eq('user_id', user.id)
        .single()

      if (existingSave) {
        // Remove save
        const { error } = await supabase
          .from('part_saves')
          .delete()
          .eq('id', existingSave.id)

        if (error) throw error
        return false
      } else {
        // Add save
        const { error } = await supabase
          .from('part_saves')
          .insert({
            part_id: partId,
            user_id: user.id
          })

        if (error) throw error
        return true
      }
    } catch (err: any) {
      console.error('Error toggling part save:', err)
      setError(err.message)
      throw err
    }
  }, [supabase])

  // Check if user has saved a part
  const isPartSaved = useCallback(async (partId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { data } = await supabase
        .from('part_saves')
        .select('id')
        .eq('part_id', partId)
        .eq('user_id', user.id)
        .single()

      return !!data
    } catch (err: any) {
      console.error('Error checking if part is saved:', err)
      return false
    }
  }, [supabase])

  // Get chats for a seller
  const getSellerChats = useCallback(async (): Promise<PartChat[]> => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('part_chats')
        .select(`
          *,
          parts!inner(name)
        `)
        .eq('seller_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      return data?.map(chat => ({
        id: chat.id,
        partId: chat.part_id,
        buyerId: chat.buyer_id,
        sellerId: chat.seller_id,
        lastMessageAt: chat.last_message_at,
        isActive: chat.is_active,
        createdAt: chat.created_at,
        partName: chat.parts?.name,
        buyerName: 'Unknown Buyer', // We can't access user profile data directly
        sellerName: 'Unknown Seller' // We can't access user profile data directly
      })) || []
    } catch (err: any) {
      console.error('Error getting seller chats:', err)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Get chat messages
  const getChatMessages = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('part_chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return data?.map(message => ({
        id: message.id,
        chatId: message.chat_id,
        senderId: message.sender_id,
        messageText: message.message_text,
        messageType: message.message_type,
        fileUrl: message.file_url,
        isRead: message.is_read,
        createdAt: message.created_at,
        senderName: 'Unknown Sender' // We can't access user profile data directly
      })) || []
    } catch (err: any) {
      console.error('Error getting chat messages:', err)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Send a chat message
  const sendChatMessage = useCallback(async (chatId: string, messageText: string, messageType: 'text' | 'image' | 'file' = 'text', fileUrl?: string): Promise<ChatMessage | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('part_chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          message_text: messageText,
          message_type: messageType,
          file_url: fileUrl
        })
        .select('*')
        .single()

      if (error) throw error

      // Update last message time in chat
      await supabase
        .from('part_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', chatId)

      return {
        id: data.id,
        chatId: data.chat_id,
        senderId: data.sender_id,
        messageText: data.message_text,
        messageType: data.message_type,
        fileUrl: data.file_url,
        isRead: data.is_read,
        createdAt: data.created_at,
        senderName: 'Unknown Sender' // We can't access user profile data directly
      }
    } catch (err: any) {
      console.error('Error sending chat message:', err)
      setError(err.message)
      return null
    }
  }, [supabase])

  // Start a new chat
  const startChat = useCallback(async (partId: string, sellerId: string): Promise<PartChat | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('part_chats')
        .insert({
          part_id: partId,
          buyer_id: user.id,
          seller_id: sellerId
        })
        .select(`
          *,
          parts!inner(name)
        `)
        .single()

      if (error) throw error

      return {
        id: data.id,
        partId: data.part_id,
        buyerId: data.buyer_id,
        sellerId: data.seller_id,
        lastMessageAt: data.last_message_at,
        isActive: data.is_active,
        createdAt: data.created_at,
        partName: data.parts?.name,
        buyerName: 'Unknown Buyer', // We can't access user profile data directly
        sellerName: 'Unknown Seller' // We can't access user profile data directly
      }
    } catch (err: any) {
      console.error('Error starting chat:', err)
      setError(err.message)
      return null
    }
  }, [supabase])

  return {
    loading,
    error,
    getPartInteractions,
    getMultiplePartInteractions,
    logPartView,
    togglePartSave,
    isPartSaved,
    getSellerChats,
    getChatMessages,
    sendChatMessage,
    startChat
  }
}
