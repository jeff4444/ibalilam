"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, X, Plus, Package, DollarSign, Camera } from "lucide-react"
import Link from "next/link"

export default function SellPage() {
  const [images, setImages] = useState<string[]>([])
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }])

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              TechParts
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/parts" className="text-gray-700 hover:text-blue-600">
                Browse Parts
              </Link>
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                Dashboard
              </Link>
              <Link href="/profile" className="text-gray-700 hover:text-blue-600">
                Profile
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">List a New Part</h1>
          <p className="text-gray-600">Add your electronic component to the marketplace</p>
        </div>

        <form className="space-y-8">
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
                  <Label htmlFor="title">Part Name *</Label>
                  <Input id="title" placeholder="e.g., Arduino Uno R3" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select required>
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
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <Select required>
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
                  <Input id="manufacturer" placeholder="e.g., Arduino, Texas Instruments" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model Number</Label>
                  <Input id="model" placeholder="e.g., ATmega328P" />
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
                  <Input id="price" type="number" step="0.01" placeholder="0.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity Available *</Label>
                  <Input id="quantity" type="number" min="1" placeholder="1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping">Shipping Cost (USD)</Label>
                  <Input id="shipping" type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>
            </CardContent>
          </Card>

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
            <Button type="submit" className="flex-1">
              List Part for Sale
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
