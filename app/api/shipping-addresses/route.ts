import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { logger } from "@/lib/logger"

// GET: Fetch all saved addresses for authenticated user
export async function GET(request: NextRequest) {
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

    // Fetch all shipping addresses for the user, ordered by default first, then by created date
    const { data: addresses, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("Error fetching shipping addresses:", error)
      return NextResponse.json(
        { error: "Failed to fetch shipping addresses" },
        { status: 500 }
      )
    }

    return NextResponse.json({ addresses: addresses || [] })
  } catch (error) {
    logger.error("Error in GET shipping addresses:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST: Create new saved address
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
    const {
      label,
      firstName,
      lastName,
      address,
      city,
      state,
      zipCode,
      country = "ZA",
      isDefault = false,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !address || !city || !state || !zipCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // If this is being set as default, we need to unset other defaults
    // But the trigger will handle this, so we can just insert
    const { data: newAddress, error } = await supabase
      .from("shipping_addresses")
      .insert({
        user_id: user.id,
        label: label || null,
        first_name: firstName,
        last_name: lastName,
        address: address,
        city: city,
        state: state,
        zip_code: zipCode,
        country: country,
        is_default: isDefault,
      })
      .select()
      .single()

    if (error) {
      logger.error("Error creating shipping address:", error)
      return NextResponse.json(
        { error: "Failed to create shipping address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: newAddress })
  } catch (error) {
    logger.error("Error in POST shipping address:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT: Update existing address
export async function PUT(request: NextRequest) {
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
    const {
      id,
      label,
      firstName,
      lastName,
      address,
      city,
      state,
      zipCode,
      country,
      isDefault,
    } = body

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

    // Build update object with only provided fields
    const updateData: any = {}
    if (label !== undefined) updateData.label = label
    if (firstName !== undefined) updateData.first_name = firstName
    if (lastName !== undefined) updateData.last_name = lastName
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (zipCode !== undefined) updateData.zip_code = zipCode
    if (country !== undefined) updateData.country = country
    if (isDefault !== undefined) updateData.is_default = isDefault

    const { data: updatedAddress, error } = await supabase
      .from("shipping_addresses")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      logger.error("Error updating shipping address:", error)
      return NextResponse.json(
        { error: "Failed to update shipping address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: updatedAddress })
  } catch (error) {
    logger.error("Error in PUT shipping address:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE: Delete address
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Address ID is required" },
        { status: 400 }
      )
    }

    // Verify the address belongs to the user before deleting
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

    const { error } = await supabase
      .from("shipping_addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      logger.error("Error deleting shipping address:", error)
      return NextResponse.json(
        { error: "Failed to delete shipping address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error in DELETE shipping address:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

