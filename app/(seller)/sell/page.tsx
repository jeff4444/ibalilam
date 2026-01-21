"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, DollarSign, Info, MapPin } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import { useFica } from "@/hooks/use-fica"
import { FicaBadge } from "@/components/fica-badge"
import { PriceTiersManager } from "@/components/price-tiers-manager"
import { PartImageUpload } from "@/components/part-image-upload"
import { CATEGORY_HIERARCHY, DEFAULT_CATEGORY_ICON, type CategoryConfig } from "@/constants/categories"

// Type for category commissions from database
interface CategoryCommission {
  id: string
  category: string
  commission_percentage: number
  is_active: boolean
}

export default function SellPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const { ficaStatus, canPublishListings } = useFica()
  
  // Categories fetched from database
  const [availableCategories, setAvailableCategories] = useState<CategoryCommission[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  
  // Form data state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    subcategory: "",
    part_type: "" as "" | "original" | "refurbished",
    brand: "",
    model: "",
    price: "",
    quantity: "",
    location_city: "",
    location_town: "",
    // Category-specific fields
    storage_capacity: "",
    imei: "",
    network_status: "",
    has_box: false,
    has_charger: false,
    part_type_detail: "",
    model_compatibility: "",
    moq: "",
    accessory_type: "",
    cpu: "",
    ram: "",
    storage: "",
    screen_size: "",
    battery_health: "",
    kit_type: "",
    age_group: "",
    electronics_subcategory: "",
    key_specs: "",
    // MOQ fields
    moq_units: "1",
    order_increment: "1",
    pack_size_units: "",
    stock_on_hand_units: "1",
    backorder_allowed: false,
    lead_time_days: ""
  })
  
  const [images, setImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [priceTiers, setPriceTiers] = useState<Array<{ min_qty: number; unit_price: number }>>([])
  const [success, setSuccess] = useState("")
  
  // Fee settings state
  const [feeSettings, setFeeSettings] = useState({
    vatPercentage: 15,
    payfastFeePercentage: 3.4,
    enableVatFees: true,
    enablePayfastFees: true
  })
  const [feeSettingsLoading, setFeeSettingsLoading] = useState(true)
  
  // Distribution locations state
  const [distributionLocations, setDistributionLocations] = useState<string[]>([])
  const [distributionLocationsLoading, setDistributionLocationsLoading] = useState(true)

  // Fetch available categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const { data, error } = await supabase
          .from('category_commissions')
          .select('*')
          .eq('is_active', true)
          .order('category')
        
        
        if (error) {
          console.error('Error fetching categories:', error)
          setError('Failed to load categories')
          return
        }
        
        setAvailableCategories(data || [])
      } catch (err) {
        console.error('Error fetching categories:', err)
        setError('Failed to load categories')
      } finally {
        setCategoriesLoading(false)
      }
    }
    
    fetchCategories()
  }, [supabase])

  // Fetch fee settings from database
  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        setFeeSettingsLoading(true)
        
        // Fetch global settings for VAT and Payfast percentages
        const { data: globalSettings, error: settingsError } = await supabase
          .from('global_settings')
          .select('*')
          .in('setting_key', ['vat_percentage', 'payfast_fee_percentage'])
        
        if (settingsError) {
          console.error('Error fetching global settings:', settingsError)
          // Continue with defaults
        }
        
        // Fetch feature flags for enabling/disabling fees
        const { data: featureFlags, error: flagsError } = await supabase
          .from('feature_flags')
          .select('*')
          .in('flag_name', ['enable_vat_fees', 'enable_payfast_fees'])
        
        if (flagsError) {
          console.error('Error fetching feature flags:', flagsError)
          // Continue with defaults
        }
        
        // Parse settings
        const vatSetting = globalSettings?.find(s => s.setting_key === 'vat_percentage')
        const payfastSetting = globalSettings?.find(s => s.setting_key === 'payfast_fee_percentage')
        const vatFlag = featureFlags?.find(f => f.flag_name === 'enable_vat_fees')
        const payfastFlag = featureFlags?.find(f => f.flag_name === 'enable_payfast_fees')
        
        setFeeSettings({
          vatPercentage: vatSetting ? parseFloat(vatSetting.setting_value) : 15,
          payfastFeePercentage: payfastSetting ? parseFloat(payfastSetting.setting_value) : 3.4,
          enableVatFees: vatFlag?.flag_value ?? true,
          enablePayfastFees: payfastFlag?.flag_value ?? true
        })
      } catch (err) {
        console.error('Error fetching fee settings:', err)
        // Keep defaults
      } finally {
        setFeeSettingsLoading(false)
      }
    }
    
    fetchFeeSettings()
  }, [supabase])

  // Fetch distribution locations from user's shop
  useEffect(() => {
    const fetchDistributionLocations = async () => {
      if (!user?.id) {
        setDistributionLocationsLoading(false)
        return
      }
      
      try {
        setDistributionLocationsLoading(true)
        const { data, error } = await supabase
          .from('shops')
          .select('distribution_locations')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (error) {
          console.error('Error fetching distribution locations:', error)
          return
        }
        
        setDistributionLocations(data?.distribution_locations || [])
      } catch (err) {
        console.error('Error fetching distribution locations:', err)
      } finally {
        setDistributionLocationsLoading(false)
      }
    }
    
    fetchDistributionLocations()
  }, [user?.id, supabase])

  // Handle input changes
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImagesChange = (newImages: string[]) => {
    setImages(newImages)
  }

  // Get current category configuration from constants
  const currentCategory: CategoryConfig | null = formData.category ? CATEGORY_HIERARCHY[formData.category] || null : null
  
  // Get commission percentage for selected category
  const categoryCommissionPercentage = formData.category 
    ? availableCategories.find(c => c.category === formData.category)?.commission_percentage || 0 
    : 0
  
  // Calculate fees and what seller receives from listing price
  const calculateFeeBreakdown = () => {
    const listingPrice = parseFloat(formData.price) || 0
    if (listingPrice <= 0) return null
    
    // Calculate total fee percentage (only include enabled fees)
    let totalFeePercentage = categoryCommissionPercentage // Commission is always included
    if (feeSettings.enableVatFees) {
      totalFeePercentage += feeSettings.vatPercentage
    }
    if (feeSettings.enablePayfastFees) {
      totalFeePercentage += feeSettings.payfastFeePercentage
    }
    
    // Calculate individual fee amounts from the listing price
    const vatAmount = feeSettings.enableVatFees 
      ? listingPrice * (feeSettings.vatPercentage / 100) 
      : 0
    const payfastAmount = feeSettings.enablePayfastFees 
      ? listingPrice * (feeSettings.payfastFeePercentage / 100) 
      : 0
    const commissionAmount = listingPrice * (categoryCommissionPercentage / 100)
    const totalFees = vatAmount + payfastAmount + commissionAmount
    
    // What seller receives = listing price - all fees
    const sellerReceives = listingPrice - totalFees
    
    return {
      listingPrice,
      sellerReceives,
      vatAmount,
      payfastAmount,
      commissionAmount,
      totalFees,
      totalFeePercentage
    }
  }
  
  const feeBreakdown = calculateFeeBreakdown()

  // Validate form based on category requirements
  const validateForm = () => {
    if (!currentCategory) return false

    // Check required fields
    for (const [field, config] of Object.entries(currentCategory.fields)) {
      if (config.required && !formData[field as keyof typeof formData]) {
        setError(`${config.label} is required`)
        return false
      }
    }

    // Special validations
    if (formData.category === 'mobile_phones' && !formData.imei) {
      setError("IMEI is mandatory for mobile phone listings")
      return false
    }

    if (formData.category === 'phone_parts' && !formData.model_compatibility) {
      setError("Model compatibility is required for phone parts listings")
      return false
    }

    return true
  }

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // Validate form
      if (!validateForm()) {
        setIsLoading(false)
        return
      }

      // Check FICA verification status
      if (!canPublishListings()) {
        setError("You must complete FICA verification to publish listings. Please complete your FICA verification in your profile.")
        setIsLoading(false)
        return
      }

      // Get user's shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (shopError || !shop) {
        throw new Error('No shop found. Please complete your profile first.')
      }

      // Prepare part data - only include columns that exist in the database schema
      // Category-specific fields (subcategory, brand, model, location, accessory_type, etc.) 
      // are stored in the description or search_keywords since they don't have dedicated columns
      const partData = {
        shop_id: shop.id,
        name: formData.name,
        description: [
          formData.description,
          formData.brand ? `Brand: ${formData.brand}` : null,
          formData.model ? `Model: ${formData.model}` : null,
          formData.subcategory ? `Subcategory: ${formData.subcategory}` : null,
          formData.location_city ? `Location: ${formData.location_city}${formData.location_town ? `, ${formData.location_town}` : ''}` : null,
          formData.storage_capacity ? `Storage: ${formData.storage_capacity}` : null,
          formData.imei ? `IMEI: ${formData.imei}` : null,
          formData.network_status ? `Network: ${formData.network_status}` : null,
          formData.has_box ? 'Includes original box' : null,
          formData.has_charger ? 'Includes charger' : null,
          formData.part_type_detail ? `Part Type: ${formData.part_type_detail}` : null,
          formData.model_compatibility ? `Compatible with: ${formData.model_compatibility}` : null,
          formData.accessory_type ? `Accessory Type: ${formData.accessory_type}` : null,
          formData.cpu ? `CPU: ${formData.cpu}` : null,
          formData.ram ? `RAM: ${formData.ram}` : null,
          formData.storage ? `Storage: ${formData.storage}` : null,
          formData.screen_size ? `Screen Size: ${formData.screen_size}` : null,
          formData.battery_health ? `Battery Health: ${formData.battery_health}%` : null,
          formData.kit_type ? `Kit Type: ${formData.kit_type}` : null,
          formData.age_group ? `Age Group: ${formData.age_group}` : null,
          formData.electronics_subcategory ? `Electronics Type: ${formData.electronics_subcategory}` : null,
          formData.key_specs ? `Key Specs: ${formData.key_specs}` : null,
        ].filter(Boolean).join('\n\n'),
        category: formData.category,
        part_type: formData.part_type || 'original',
        price: parseFloat(formData.price), // Listing price (what buyers see)
        stock_quantity: parseInt(formData.quantity),
        status: 'active',
        published_at: new Date().toISOString(), // Required for search_parts RPC function
        image_url: images[0] || null,
        images: images.length > 0 ? images : null,
        search_keywords: [
          formData.name,
          formData.category,
          formData.subcategory,
          formData.brand,
          formData.model,
          formData.location_city,
          formData.accessory_type,
          formData.part_type_detail,
          formData.model_compatibility,
        ].filter(Boolean),
        // MOQ fields (these columns exist in the schema)
        moq_units: formData.moq_units ? parseInt(formData.moq_units) : 1,
        order_increment: formData.order_increment ? parseInt(formData.order_increment) : 1,
        pack_size_units: formData.pack_size_units ? parseInt(formData.pack_size_units) : null,
        stock_on_hand_units: formData.stock_on_hand_units ? parseInt(formData.stock_on_hand_units) : 0,
        backorder_allowed: formData.backorder_allowed,
        lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
        // Location fields
        location_city: formData.location_city || null,
        location_town: formData.location_town || null
      }

      // Insert part into database
      const { data: newPart, error: insertError } = await supabase
        .from('parts')
        .insert(partData)
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create part: ${insertError.message}`)
      }

      // Insert price tiers if any exist
      if (priceTiers.length > 0 && newPart) {
        const tierData = priceTiers.map(tier => ({
          part_id: newPart.id,
          min_qty: tier.min_qty,
          unit_price: tier.unit_price
        }))

        const { error: tierError } = await supabase
          .from('price_tiers')
          .insert(tierData)

        if (tierError) {
          console.error('Error inserting price tiers:', tierError)
          // Don't throw error here - part was created successfully
        }
      }

      setSuccess('Part successfully added to your shop!')
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        category: "",
        subcategory: "",
        part_type: "" as "" | "original" | "refurbished",
        brand: "",
        model: "",
        price: "",
        quantity: "",
        location_city: "",
        location_town: "",
        storage_capacity: "",
        imei: "",
        network_status: "",
        has_box: false,
        has_charger: false,
        part_type_detail: "",
        model_compatibility: "",
        moq: "",
        accessory_type: "",
        cpu: "",
        ram: "",
        storage: "",
        screen_size: "",
        battery_health: "",
        kit_type: "",
        age_group: "",
        electronics_subcategory: "",
        key_specs: "",
        // MOQ fields
        moq_units: "1",
        order_increment: "1",
        pack_size_units: "",
        stock_on_hand_units: "1",
        backorder_allowed: false,
        lead_time_days: ""
      })
      setImages([])
      setPriceTiers([])

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (err: any) {
      console.error('Error creating part:', err)
      setError(err.message || 'Failed to create part')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">List a New Item</h1>
          <p className="text-gray-600">Add your item to the marketplace</p>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* FICA Verification Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Seller Verification Status
            </CardTitle>
            <CardDescription>
              Your current verification status for publishing listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FicaBadge 
                  status={ficaStatus?.fica_status || null} 
                  rejectionReason={ficaStatus?.fica_rejection_reason}
                />
                <span className="text-sm text-muted-foreground">
                  {canPublishListings() 
                    ? "You can publish listings" 
                    : "Complete FICA verification to publish listings"
                  }
                </span>
              </div>
              {!canPublishListings() && (
                <Link href="/profile?tab=fica">
                  <Button variant="outline" size="sm">
                    Complete Verification
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Category Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Category Selection
              </CardTitle>
              <CardDescription>Choose the category that best fits your item</CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-muted-foreground">Loading categories...</span>
                </div>
              ) : availableCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories available. Please contact support.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {availableCategories.map((categoryCommission) => {
                    const categoryKey = categoryCommission.category
                    const categoryConfig = CATEGORY_HIERARCHY[categoryKey]
                    const IconComponent = categoryConfig?.icon || DEFAULT_CATEGORY_ICON
                    const categoryName = categoryConfig?.name || categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    const subcategories = categoryConfig?.subcategories || []
                    
                    return (
                      <div 
                        key={categoryKey}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          formData.category === categoryKey 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleInputChange('category', categoryKey)}
                      >
                        <div className="flex items-center space-x-3">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                          <div>
                            <h3 className="font-medium">{categoryName}</h3>
                            <p className="text-sm text-gray-600">
                              {subcategories.length > 0 ? (
                                <>
                                  {subcategories.slice(0, 2).join(', ')}
                                  {subcategories.length > 2 && '...'}
                                </>
                              ) : (
                                `${categoryCommission.commission_percentage}% commission`
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Subcategory Selection */}
              {currentCategory && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory *</Label>
                  <Select 
                    value={formData.subcategory}
                    onValueChange={(value) => handleInputChange('subcategory', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCategory.subcategories.map(subcat => (
                        <SelectItem key={subcat} value={subcat}>
                          {subcat.charAt(0).toUpperCase() + subcat.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Provide the essential details about your item</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Title *</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., iPhone 13 Pro 256GB" 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part_type">Condition *</Label>
                  <Select 
                    value={formData.part_type}
                    onValueChange={(value) => handleInputChange('part_type', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Original/New</SelectItem>
                      <SelectItem value="refurbished">Refurbished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the item, its condition, and any relevant details..."
                  className="min-h-[120px]"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input 
                    id="brand" 
                    placeholder="e.g., Apple, Samsung"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input 
                    id="model" 
                    placeholder="e.g., iPhone 13 Pro"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                  />
                </div>
              </div>

              {/* Distribution Location Selection */}
              <div className="space-y-2">
                <Label htmlFor="location_city" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Distribution Location
                </Label>
                {distributionLocationsLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-muted-foreground">Loading locations...</span>
                  </div>
                ) : distributionLocations.length === 0 ? (
                  <Alert className="border-amber-200 bg-amber-50">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      No distribution locations set up. Please{" "}
                      <Link href="/profile" className="font-medium underline hover:text-amber-900">
                        add locations in your profile
                      </Link>{" "}
                      under the Shop Info tab before listing items.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select 
                    value={formData.location_city}
                    onValueChange={(value) => handleInputChange('location_city', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select distribution location" />
                    </SelectTrigger>
                    <SelectContent>
                      {distributionLocations.map((location, index) => (
                        <SelectItem key={index} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-sm text-muted-foreground">
                  Where this item will ship from
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category-Specific Fields */}
          {currentCategory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <currentCategory.icon className="h-5 w-5" />
                  {currentCategory.name} Details
                </CardTitle>
                <CardDescription>Provide specific details for this category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(currentCategory.fields).map(([field, config]) => {
                  const fieldValue = formData[field as keyof typeof formData]
                  
                  if (field === 'has_box' || field === 'has_charger') {
                    return (
                      <div key={field} className="flex items-center space-x-2">
                        <Checkbox
                          id={field}
                          checked={fieldValue as boolean}
                          onCheckedChange={(checked) => handleInputChange(field, checked as boolean)}
                        />
                        <Label htmlFor={field}>{config.label}</Label>
                      </div>
                    )
                  }

                  if (field === 'part_type_detail' || field === 'accessory_type' || field === 'kit_type' || field === 'electronics_subcategory') {
                    const options = field === 'part_type_detail' 
                      ? ['screen', 'battery', 'charging_port', 'camera', 'speaker', 'microphone', 'housing', 'other']
                      : field === 'accessory_type'
                      ? ['charger', 'case', 'earphones', 'screen_protector', 'cable', 'other']
                      : field === 'kit_type'
                      ? ['coding', 'robotics', 'ai', 'electronics', 'other']
                      : ['tv', 'audio', 'gaming', 'networking', 'power', 'other']

                    return (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={field}>{config.label} {config.required && '*'}</Label>
                        <Select 
                          value={fieldValue as string}
                          onValueChange={(value) => handleInputChange(field, value)}
                          required={config.required}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map(option => (
                              <SelectItem key={option} value={option}>
                                {option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  if (field === 'network_status') {
                    return (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={field}>{config.label} {config.required && '*'}</Label>
                        <Select 
                          value={fieldValue as string}
                          onValueChange={(value) => handleInputChange(field, value)}
                          required={config.required}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select network status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unlocked">Unlocked</SelectItem>
                            <SelectItem value="locked">Locked</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  if (field === 'age_group') {
                    return (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={field}>{config.label} {config.required && '*'}</Label>
                        <Select 
                          value={fieldValue as string}
                          onValueChange={(value) => handleInputChange(field, value)}
                          required={config.required}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select age group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5-8">5-8 years</SelectItem>
                            <SelectItem value="9-12">9-12 years</SelectItem>
                            <SelectItem value="13-16">13-16 years</SelectItem>
                            <SelectItem value="17+">17+ years</SelectItem>
                            <SelectItem value="all">All ages</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{config.label} {config.required && '*'}</Label>
                      <Input 
                        id={field} 
                        placeholder={config.label}
                        value={fieldValue as string}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        required={config.required}
                        type={field === 'battery_health' || field === 'moq' ? 'number' : 'text'}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Quantity
              </CardTitle>
              <CardDescription>Set your listing price and available quantity. We'll show you what you'll receive after fees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="price" className="flex items-center gap-2">
                    Listing Price (ZAR) *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Enter the price customers will see. We'll calculate what you receive after fees are deducted.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    required 
                  />
                  <p className="text-sm text-muted-foreground">The price buyers will see</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity Available *</Label>
                  <Input 
                    id="quantity" 
                    type="number" 
                    min="1" 
                    placeholder="1" 
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    required 
                  />
                </div>
              </div>

              {/* Fee Breakdown */}
              {feeBreakdown && formData.category && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Fee Breakdown
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-700">
                      <span>Listing Price (What buyers pay)</span>
                      <span className="font-medium">R{feeBreakdown.listingPrice.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-blue-200 pt-2 mt-2 space-y-1">
                      {feeSettings.enableVatFees && (
                        <div className="flex justify-between text-red-600">
                          <span>- VAT ({feeSettings.vatPercentage}%)</span>
                          <span>-R{feeBreakdown.vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {feeSettings.enablePayfastFees && (
                        <div className="flex justify-between text-red-600">
                          <span>- Payfast Fee ({feeSettings.payfastFeePercentage}%)</span>
                          <span>-R{feeBreakdown.payfastAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-red-600">
                        <span>- Platform Commission ({categoryCommissionPercentage}%)</span>
                        <span>-R{feeBreakdown.commissionAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-blue-300 pt-2 mt-2">
                      <div className="flex justify-between text-gray-600 text-xs mb-1">
                        <span>Total Fees ({feeBreakdown.totalFeePercentage.toFixed(1)}%)</span>
                        <span className="text-red-600">-R{feeBreakdown.totalFees.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold text-base">
                        <span>You Receive</span>
                        <span>R{feeBreakdown.sellerReceives.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading state for fee settings */}
              {feeSettingsLoading && formData.price && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Loading fee breakdown...</span>
                  </div>
                </div>
              )}

              {/* Prompt to select category */}
              {!formData.category && formData.price && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    Please select a category above to see the complete fee breakdown.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* MOQ Settings for Phone Parts and Accessories */}
          {(formData.category === 'phone_parts' || formData.category === 'phone_accessories') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Quantity Settings
                </CardTitle>
                <CardDescription>Configure minimum order quantities and pricing rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="moq_units">Minimum Order Quantity (MOQ) *</Label>
                    <Input 
                      id="moq_units" 
                      type="number" 
                      min="1" 
                      placeholder="1" 
                      value={formData.moq_units}
                      onChange={(e) => handleInputChange('moq_units', e.target.value)}
                      required 
                    />
                    <p className="text-sm text-gray-500">Minimum quantity customers must order</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_increment">Order Increment *</Label>
                    <Input 
                      id="order_increment" 
                      type="number" 
                      min="1" 
                      placeholder="1" 
                      value={formData.order_increment}
                      onChange={(e) => handleInputChange('order_increment', e.target.value)}
                      required 
                    />
                    <p className="text-sm text-gray-500">Quantity must be in multiples of this number</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="pack_size_units">Pack Size (Optional)</Label>
                    <Input 
                      id="pack_size_units" 
                      type="number" 
                      min="1" 
                      placeholder="Leave empty for no pack size"
                      value={formData.pack_size_units}
                      onChange={(e) => handleInputChange('pack_size_units', e.target.value)}
                    />
                    <p className="text-sm text-gray-500">If set, orders must be in packs of this size (overrides increment)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock_on_hand_units">Stock on Hand *</Label>
                    <Input 
                      id="stock_on_hand_units" 
                      type="number" 
                      min="0" 
                      placeholder="0" 
                      value={formData.stock_on_hand_units}
                      onChange={(e) => handleInputChange('stock_on_hand_units', e.target.value)}
                      required 
                    />
                    <p className="text-sm text-gray-500">Current inventory available for immediate shipment</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="backorder_allowed"
                      checked={formData.backorder_allowed}
                      onCheckedChange={(checked) => handleInputChange('backorder_allowed', checked as boolean)}
                    />
                    <Label htmlFor="backorder_allowed">Allow Backorders</Label>
                  </div>
                  <p className="text-sm text-gray-500">Allow customers to order more than current stock</p>
                  
                  {formData.backorder_allowed && (
                    <div className="space-y-2">
                      <Label htmlFor="lead_time_days">Lead Time (Days) *</Label>
                      <Input 
                        id="lead_time_days" 
                        type="number" 
                        min="1" 
                        placeholder="7" 
                        value={formData.lead_time_days}
                        onChange={(e) => handleInputChange('lead_time_days', e.target.value)}
                        required={formData.backorder_allowed}
                      />
                      <p className="text-sm text-gray-500">How many days to fulfill backordered items</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Tiers for Phone Parts and Accessories */}
          {(formData.category === 'phone_parts' || formData.category === 'phone_accessories') && (
            <PriceTiersManager
              tiers={priceTiers}
              moqUnits={parseInt(formData.moq_units) || 1}
              basePrice={parseFloat(formData.price) || 0}
              onChange={setPriceTiers}
            />
          )}

          {/* Images */}
          <PartImageUpload
            images={images}
            onImagesChange={handleImagesChange}
            maxImages={8}
            disabled={isLoading}
          />

          {/* Submit */}
          <div className="flex gap-4">
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding Item...
                </>
              ) : (
                'List Item for Sale'
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              asChild
              disabled={isLoading}
            >
              <Link href="/dashboard">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

