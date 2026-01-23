import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { logger } from "@/lib/logger"

// POST: Set default address
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: "Address ID is required" },
        { status: 400 }
      )
    }

    // Verify the address belongs to the user
    const { data: existingAddress, error: fetchError } = await supabase
      .from("shipping_addresses")
      .select("user_id")
      .eq("id", id)
      .single()

    if (fetchError || !existingAddress || existingAddress.user_id !== user.id) {
      return NextResponse.json(
        { error: "Address not found or unauthorized" },
        { status: 404 }
      )
    }

    // Set all addresses to non-default first (the trigger will handle this, but being explicit)
    await supabase
      .from("shipping_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)

    // Set the selected address as default
    const { data: updatedAddress, error } = await supabase
      .from("shipping_addresses")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      logger.error("Error setting default shipping address:", error)
      return NextResponse.json(
        { error: "Failed to set default shipping address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: updatedAddress })
  } catch (error) {
    logger.error("Error in POST default shipping address:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

