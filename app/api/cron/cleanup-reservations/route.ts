import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabase/admin"

// Cron endpoint to cleanup expired stock reservations
// 
// This endpoint should be called periodically (every 5 minutes recommended)
// by an external scheduler like:
// - Vercel Cron Jobs
// - AWS CloudWatch Events
// - GitHub Actions scheduled workflow
// - Traditional cron job
// 
// Security:
// - Protected by CRON_SECRET environment variable
// - Only accepts GET requests (for compatibility with most cron services)
// - Uses service role to execute cleanup function
// 
// Usage:
// GET /api/cron/cleanup-reservations
// Headers:
//   Authorization: Bearer <CRON_SECRET>
// 
// For Vercel Cron, add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/cleanup-reservations",
//     "schedule": "every 5 minutes"
//   }]
// }

interface CleanupResult {
  success: boolean
  orders_processed?: number
  reservations_released?: number
  failed_orders?: string[]
  processed_at?: string
  error?: string
  error_code?: string
  details?: string
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ============================================================
    // STEP 1: Verify Authorization
    // ============================================================
    // Check for CRON_SECRET in Authorization header or query param
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    
    // Also check for Vercel's cron authorization header
    const vercelCronHeader = req.headers.get("x-vercel-cron")
    
    // Allow if:
    // 1. CRON_SECRET is not set (development mode)
    // 2. Authorization header matches
    // 3. Vercel cron header is present (Vercel automatically adds this)
    const isAuthorized = 
      !cronSecret || 
      authHeader === `Bearer ${cronSecret}` ||
      vercelCronHeader === "1"
    
    if (!isAuthorized) {
      console.warn("[CRON] Unauthorized cleanup attempt")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // ============================================================
    // STEP 2: Execute Cleanup
    // ============================================================
    // Use admin client to call the cleanup function
    const supabase = supabaseAdmin
    
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc(
      'cleanup_expired_reservations'
    )

    if (cleanupError) {
      console.error("[CRON] Cleanup function error:", cleanupError)
      return NextResponse.json(
        { 
          success: false,
          error: "Cleanup function failed",
          details: cleanupError.message
        },
        { status: 500 }
      )
    }

    const result = cleanupResult as CleanupResult
    const duration = Date.now() - startTime

    // ============================================================
    // STEP 3: Log Results
    // ============================================================
    if (result.success) {
      const logMessage = result.orders_processed && result.orders_processed > 0
        ? `[CRON] Cleanup completed: ${result.orders_processed} orders, ${result.reservations_released} reservations released in ${duration}ms`
        : `[CRON] Cleanup completed: No expired reservations found (${duration}ms)`
      
      console.log(logMessage)
      
      // Log any failed orders for investigation
      if (result.failed_orders && result.failed_orders.length > 0) {
        console.warn(`[CRON] Failed to process orders: ${result.failed_orders.join(", ")}`)
      }
    } else {
      console.error("[CRON] Cleanup returned failure:", result)
    }

    return NextResponse.json({
      success: result.success,
      ordersProcessed: result.orders_processed || 0,
      reservationsReleased: result.reservations_released || 0,
      failedOrders: result.failed_orders || [],
      processedAt: result.processed_at,
      durationMs: duration
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[CRON] Unexpected error during cleanup:", error)
    
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        details: (error as Error).message,
        durationMs: duration
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility with different cron services
export async function POST(req: NextRequest) {
  return GET(req)
}
