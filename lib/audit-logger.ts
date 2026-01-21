/**
 * Centralized Audit Logging Utility
 * 
 * INFO-004 FIX: Provides a consistent interface for logging security-relevant
 * events to the audit_logs table in Supabase.
 * 
 * Usage:
 *   import { auditLog, AuditEventType } from '@/lib/audit-logger'
 *   
 *   await auditLog.auth.loginSuccess(userId, request)
 *   await auditLog.wallet.withdrawal(userId, amount, request)
 *   await auditLog.admin.userSuspend(adminId, targetUserId, reason, request)
 */
import "server-only"

import { supabaseAdmin } from "@/utils/supabase/admin"
import { NextRequest } from "next/server"

// ============================================================
// Types
// ============================================================

export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface AuditEvent {
  eventType: string
  action: string
  userId?: string | null
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
  errorCode?: string
  severity?: AuditSeverity
  ipAddress?: string
  userAgent?: string
  requestMethod?: string
  requestPath?: string
  responseStatus?: number
  durationMs?: number
  sessionId?: string
}

export interface RequestContext {
  ip?: string
  userAgent?: string
  method?: string
  path?: string
  sessionId?: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extract request context from NextRequest
 */
export function getRequestContext(request?: NextRequest): RequestContext {
  if (!request) return {}
  
  // Get IP address from various headers (Vercel, Cloudflare, etc.)
  const ip = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.ip ||
    undefined
  
  return {
    ip,
    userAgent: request.headers.get('user-agent') || undefined,
    method: request.method,
    path: new URL(request.url).pathname,
    sessionId: request.cookies.get('session_id')?.value,
  }
}

/**
 * Core function to log an audit event
 */
async function logAuditEvent(event: AuditEvent): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('log_audit_event', {
      p_event_type: event.eventType,
      p_action: event.action,
      p_user_id: event.userId || null,
      p_resource_type: event.resourceType || null,
      p_resource_id: event.resourceId || null,
      p_details: event.details || {},
      p_success: event.success ?? true,
      p_error_message: event.errorMessage || null,
      p_error_code: event.errorCode || null,
      p_severity: event.severity || 'info',
      p_ip_address: event.ipAddress || null,
      p_user_agent: event.userAgent || null,
      p_request_method: event.requestMethod || null,
      p_request_path: event.requestPath || null,
      p_response_status: event.responseStatus || null,
      p_duration_ms: event.durationMs || null,
      p_session_id: event.sessionId || null,
    })

    if (error) {
      // Log to console as fallback - don't throw to avoid breaking the main flow
      console.error('[AUDIT_LOG_ERROR]', error.message, event)
      return null
    }

    return data as string
  } catch (err) {
    // Fallback logging - audit logging should never break the application
    console.error('[AUDIT_LOG_ERROR]', err, event)
    return null
  }
}

/**
 * Create an audit event with request context
 */
function createAuditEvent(
  eventType: string,
  action: string,
  options: Partial<AuditEvent> = {},
  request?: NextRequest
): AuditEvent {
  const context = getRequestContext(request)
  
  return {
    eventType,
    action,
    ...options,
    ipAddress: options.ipAddress || context.ip,
    userAgent: options.userAgent || context.userAgent,
    requestMethod: options.requestMethod || context.method,
    requestPath: options.requestPath || context.path,
    sessionId: options.sessionId || context.sessionId,
  }
}

// ============================================================
// Audit Logger API
// ============================================================

export const auditLog = {
  /**
   * Authentication events
   */
  auth: {
    loginSuccess: async (userId: string, request?: NextRequest, details?: Record<string, unknown>) => {
      return logAuditEvent(createAuditEvent(
        'auth.login',
        'login',
        { userId, success: true, details },
        request
      ))
    },

    loginFailure: async (email: string, reason: string, request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'auth.login',
        'login',
        {
          success: false,
          errorMessage: reason,
          severity: 'warning',
          details: { email: email.substring(0, 3) + '***' }, // Partial email for privacy
        },
        request
      ))
    },

    logout: async (userId: string, request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'auth.logout',
        'logout',
        { userId, success: true },
        request
      ))
    },

    passwordResetRequest: async (email: string, request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'auth.password_reset',
        'request',
        {
          success: true,
          details: { email: email.substring(0, 3) + '***' },
        },
        request
      ))
    },

    passwordResetComplete: async (userId: string, request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'auth.password_reset',
        'complete',
        { userId, success: true },
        request
      ))
    },

    signupSuccess: async (userId: string, request?: NextRequest, details?: Record<string, unknown>) => {
      return logAuditEvent(createAuditEvent(
        'auth.signup',
        'create',
        { userId, success: true, details },
        request
      ))
    },

    signupFailure: async (reason: string, request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'auth.signup',
        'create',
        {
          success: false,
          errorMessage: reason,
          severity: 'warning',
        },
        request
      ))
    },
  },

  /**
   * Wallet/Financial events
   */
  wallet: {
    deposit: async (
      userId: string,
      amount: number,
      transactionId: string,
      request?: NextRequest,
      details?: Record<string, unknown>
    ) => {
      return logAuditEvent(createAuditEvent(
        'wallet.deposit',
        'create',
        {
          userId,
          resourceType: 'wallet_transaction',
          resourceId: transactionId,
          success: true,
          details: { amount, ...details },
        },
        request
      ))
    },

    withdrawalRequest: async (
      userId: string,
      amount: number,
      transactionId: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'wallet.withdrawal',
        'request',
        {
          userId,
          resourceType: 'wallet_transaction',
          resourceId: transactionId,
          success: true,
          details: { amount },
        },
        request
      ))
    },

    withdrawalApproved: async (
      adminId: string,
      userId: string,
      amount: number,
      transactionId: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'wallet.withdrawal',
        'approve',
        {
          userId: adminId,
          resourceType: 'wallet_transaction',
          resourceId: transactionId,
          success: true,
          details: { targetUserId: userId, amount },
        },
        request
      ))
    },

    withdrawalRejected: async (
      adminId: string,
      userId: string,
      amount: number,
      transactionId: string,
      reason: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'wallet.withdrawal',
        'reject',
        {
          userId: adminId,
          resourceType: 'wallet_transaction',
          resourceId: transactionId,
          success: true,
          details: { targetUserId: userId, amount, reason },
        },
        request
      ))
    },

    balanceChange: async (
      userId: string,
      oldBalance: number,
      newBalance: number,
      reason: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'wallet.balance_change',
        'update',
        {
          userId,
          resourceType: 'user_wallet',
          success: true,
          details: { oldBalance, newBalance, change: newBalance - oldBalance, reason },
        },
        request
      ))
    },
  },

  /**
   * Admin actions
   */
  admin: {
    userSuspend: async (
      adminId: string,
      targetUserId: string,
      reason: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.user_suspend',
        'update',
        {
          userId: adminId,
          resourceType: 'user',
          resourceId: targetUserId,
          success: true,
          severity: 'warning',
          details: { reason },
        },
        request
      ))
    },

    userUnsuspend: async (
      adminId: string,
      targetUserId: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.user_unsuspend',
        'update',
        {
          userId: adminId,
          resourceType: 'user',
          resourceId: targetUserId,
          success: true,
        },
        request
      ))
    },

    ficaApprove: async (
      adminId: string,
      targetUserId: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.fica_approve',
        'update',
        {
          userId: adminId,
          resourceType: 'user',
          resourceId: targetUserId,
          success: true,
        },
        request
      ))
    },

    ficaReject: async (
      adminId: string,
      targetUserId: string,
      reason: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.fica_reject',
        'update',
        {
          userId: adminId,
          resourceType: 'user',
          resourceId: targetUserId,
          success: true,
          details: { reason },
        },
        request
      ))
    },

    roleChange: async (
      adminId: string,
      targetUserId: string,
      oldRole: string,
      newRole: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.role_change',
        'update',
        {
          userId: adminId,
          resourceType: 'user',
          resourceId: targetUserId,
          success: true,
          severity: 'warning',
          details: { oldRole, newRole },
        },
        request
      ))
    },

    settingChange: async (
      adminId: string,
      settingKey: string,
      oldValue: unknown,
      newValue: unknown,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'admin.setting_change',
        'update',
        {
          userId: adminId,
          resourceType: 'setting',
          resourceId: settingKey,
          success: true,
          details: { oldValue, newValue },
        },
        request
      ))
    },
  },

  /**
   * Order events
   */
  order: {
    create: async (
      userId: string,
      orderId: string,
      totalAmount: number,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'order.create',
        'create',
        {
          userId,
          resourceType: 'order',
          resourceId: orderId,
          success: true,
          details: { totalAmount },
        },
        request
      ))
    },

    paymentSuccess: async (
      userId: string,
      orderId: string,
      paymentId: string,
      amount: number,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'order.payment',
        'complete',
        {
          userId,
          resourceType: 'order',
          resourceId: orderId,
          success: true,
          details: { paymentId, amount },
        },
        request
      ))
    },

    paymentFailure: async (
      userId: string,
      orderId: string,
      reason: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'order.payment',
        'fail',
        {
          userId,
          resourceType: 'order',
          resourceId: orderId,
          success: false,
          errorMessage: reason,
          severity: 'warning',
        },
        request
      ))
    },

    statusChange: async (
      userId: string,
      orderId: string,
      oldStatus: string,
      newStatus: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'order.status_change',
        'update',
        {
          userId,
          resourceType: 'order',
          resourceId: orderId,
          success: true,
          details: { oldStatus, newStatus },
        },
        request
      ))
    },
  },

  /**
   * Security events
   */
  security: {
    rateLimitHit: async (
      identifier: string,
      endpoint: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'security.rate_limit',
        'block',
        {
          success: false,
          severity: 'warning',
          details: { identifier, endpoint },
        },
        request
      ))
    },

    csrfFailure: async (request?: NextRequest) => {
      return logAuditEvent(createAuditEvent(
        'security.csrf_failure',
        'block',
        {
          success: false,
          severity: 'warning',
        },
        request
      ))
    },

    suspiciousActivity: async (
      userId: string | null,
      description: string,
      request?: NextRequest,
      details?: Record<string, unknown>
    ) => {
      return logAuditEvent(createAuditEvent(
        'security.suspicious',
        'detect',
        {
          userId,
          success: false,
          severity: 'critical',
          errorMessage: description,
          details,
        },
        request
      ))
    },

    unauthorizedAccess: async (
      userId: string | null,
      resource: string,
      request?: NextRequest
    ) => {
      return logAuditEvent(createAuditEvent(
        'security.unauthorized',
        'block',
        {
          userId,
          resourceType: resource,
          success: false,
          severity: 'warning',
        },
        request
      ))
    },
  },

  /**
   * Generic logging for custom events
   */
  custom: async (event: AuditEvent, request?: NextRequest) => {
    const context = getRequestContext(request)
    return logAuditEvent({
      ...event,
      ipAddress: event.ipAddress || context.ip,
      userAgent: event.userAgent || context.userAgent,
      requestMethod: event.requestMethod || context.method,
      requestPath: event.requestPath || context.path,
      sessionId: event.sessionId || context.sessionId,
    })
  },
}

// Export types for consumers
export type { AuditEvent, RequestContext }
