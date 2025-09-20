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
import { Upload, X, Plus, Package, DollarSign, Camera, Cpu, Wrench } from "lucide-react"
import { CartButton } from "@/components/cart-button"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import { useFica } from "@/hooks/use-fica"
import { FicaBadge } from "@/components/fica-badge"

export default function SellPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()
  const { ficaStatus, canPublishListings } = useFica()
  
  // Form data state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    condition: "",
    manufacturer: "",
    model: "",
    price: "",
    quantity: "",
    shipping: "",
    part_type: "original", // original or refurbished
    // Refurbished specific fields
    cost: "",
    original_condition: "",
    refurbished_condition: "",
    time_spent_hours: "",
  })
  
  const [images, setImages] = useState<string[]>([])
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addSpecification = () => {
    setSpecifications([...specifications, { key: "", value: "" }])
  }

  const removeSpecification = (index: number) => {
    setSpecifications(specifications.filter((_, i) => i !== index))
  }

  const updateSpecification = (index: number, field: "key" | "value", value: string) => {
    const updated = [...specifications]
    updated[index][field] = value
    setSpecifications(updated)
  }

  const addImage = () => {
    // Simulate image upload
    const newImage = `/placeholder.svg?height=200&width=200&text=Part+${images.length + 1}`
    setImages([...images, newImage])
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
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

      // Prepare part data
      const partData = {
        shop_id: shop.id,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.quantity),
        status: 'active',
        part_type: formData.part_type,
        image_url: images[0] || null,
        search_keywords: [
          formData.name,
          formData.category,
          formData.manufacturer,
          formData.model
        ].filter(Boolean), // Remove empty strings
        // Refurbished specific fields
        ...(formData.part_type === 'refurbished' && {
          cost: formData.cost ? parseFloat(formData.cost) : null,
          original_condition: formData.original_condition || null,
          refurbished_condition: formData.refurbished_condition || null,
          time_spent_hours: formData.time_spent_hours ? parseFloat(formData.time_spent_hours) : null,
        })
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

      setSuccess('Part successfully added to your shop!')
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        category: "",
        condition: "",
        manufacturer: "",
        model: "",
        price: "",
        quantity: "",
        shipping: "",
        part_type: "original",
        cost: "",
        original_condition: "",
        refurbished_condition: "",
        time_spent_hours: "",
      })
      setImages([])
      setSpecifications([{ key: "", value: "" }])

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

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
          <Link className="flex items-center justify-center" href="/">
            <Cpu className="h-6 w-6 mr-2 text-blue-600" />
            <span className="font-bold text-xl">Ibalilam</span>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Techafon</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
            Favorites
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
            Profile
          </Link>
          <CartButton />
        </nav>
      </header>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">List a New Part</h1>
          <p className="text-gray-600">Add your electronic component to the marketplace</p>
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
          {/* Part Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Part Type
              </CardTitle>
              <CardDescription>Choose whether this is an original or refurbished part</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.part_type === 'original' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('part_type', 'original')}
                >
                  <div className="flex items-center space-x-3">
                    <Package className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="font-medium">Original Part</h3>
                      <p className="text-sm text-gray-600">New or used part in original condition</p>
                    </div>
                  </div>
                </div>
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.part_type === 'refurbished' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('part_type', 'refurbished')}
                >
                  <div className="flex items-center space-x-3">
                    <Wrench className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-medium">Refurbished Part</h3>
                      <p className="text-sm text-gray-600">Part that has been restored or repaired</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Provide the essential details about your part</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Part Name *</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., Arduino Uno R3" 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select 
                    value={formData.category}
                    onValueChange={(value) => handleInputChange('category', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="microcontrollers">Microcontrollers</SelectItem>
                      <SelectItem value="sensors">Sensors</SelectItem>
                      <SelectItem value="resistors">Resistors</SelectItem>
                      <SelectItem value="capacitors">Capacitors</SelectItem>
                      <SelectItem value="transistors">Transistors</SelectItem>
                      <SelectItem value="ics">Integrated Circuits</SelectItem>
                      <SelectItem value="connectors">Connectors</SelectItem>
                      <SelectItem value="displays">Displays</SelectItem>
                      <SelectItem value="power">Power Supplies</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the part, its condition, and any relevant details..."
                  className="min-h-[120px]"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <Select 
                    value={formData.condition}
                    onValueChange={(value) => handleInputChange('condition', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like-new">Like New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="for-parts">For Parts/Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input 
                    id="manufacturer" 
                    placeholder="e.g., Arduino, Texas Instruments"
                    value={formData.manufacturer}
                    onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model Number</Label>
                  <Input 
                    id="model" 
                    placeholder="e.g., ATmega328P"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Quantity
              </CardTitle>
              <CardDescription>Set your price and available quantity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD) *</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    required 
                  />
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
                <div className="space-y-2">
                  <Label htmlFor="shipping">Shipping Cost (USD)</Label>
                  <Input 
                    id="shipping" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={formData.shipping}
                    onChange={(e) => handleInputChange('shipping', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refurbished Specific Fields */}
          {formData.part_type === 'refurbished' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Refurbishment Details
                </CardTitle>
                <CardDescription>Provide details about the refurbishment process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Refurbishment Cost (USD) *</Label>
                    <Input 
                      id="cost" 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00"
                      value={formData.cost}
                      onChange={(e) => handleInputChange('cost', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time_spent_hours">Time Spent (Hours)</Label>
                    <Input 
                      id="time_spent_hours" 
                      type="number" 
                      step="0.5" 
                      placeholder="0"
                      value={formData.time_spent_hours}
                      onChange={(e) => handleInputChange('time_spent_hours', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="original_condition">Original Condition *</Label>
                    <Select 
                      value={formData.original_condition}
                      onValueChange={(value) => handleInputChange('original_condition', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select original condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="broken">Broken</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refurbished_condition">Refurbished Condition *</Label>
                    <Select 
                      value={formData.refurbished_condition}
                      onValueChange={(value) => handleInputChange('refurbished_condition', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select refurbished condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="very-good">Very Good</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="like-new">Like New</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Images
              </CardTitle>
              <CardDescription>Add photos of your part (up to 5 images)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image || "/placeholder.svg"}
                      alt={`Part image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={addImage}
                    className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
                  >
                    <Upload className="h-6 w-6 mb-2" />
                    <span className="text-sm">Add Image</span>
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Upload clear photos showing the part from different angles. First image will be the main photo.
              </p>
            </CardContent>
          </Card>

          {/* Technical Specifications */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
              <CardDescription>Add technical details and specifications (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {specifications.map((spec, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`spec-key-${index}`}>Specification</Label>
                    <Input
                      id={`spec-key-${index}`}
                      placeholder="e.g., Operating Voltage"
                      value={spec.key}
                      onChange={(e) => updateSpecification(index, "key", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`spec-value-${index}`}>Value</Label>
                    <Input
                      id={`spec-value-${index}`}
                      placeholder="e.g., 5V DC"
                      value={spec.value}
                      onChange={(e) => updateSpecification(index, "value", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeSpecification(index)}
                    disabled={specifications.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addSpecification} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Specification
              </Button>
            </CardContent>
          </Card>

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
                  Adding Part...
                </>
              ) : (
                'List Part for Sale'
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
