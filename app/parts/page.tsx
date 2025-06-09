"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Cpu, Search, Grid, List, Star, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CartButton } from "@/components/cart-button"

export default function PartsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const categories = [
    "Microcontrollers",
    "Sensors",
    "Resistors",
    "Capacitors",
    "LEDs",
    "Transistors",
    "ICs",
    "Connectors",
  ]

  const parts = [
    {
      id: 1,
      name: "Arduino Uno R3",
      description: "Microcontroller board based on the ATmega328P",
      price: 25.99,
      originalPrice: 35.99,
      category: "Microcontrollers",
      condition: "New",
      seller: "TechParts Pro",
      rating: 4.8,
      reviews: 127,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: false,
    },
    {
      id: 2,
      name: "Refurbished iPhone 12 Logic Board",
      description: "Fully tested and restored to working condition",
      price: 299.99,
      originalPrice: 450.0,
      category: "Logic Boards",
      condition: "Refurbished",
      seller: "RefurbTech",
      rating: 4.6,
      reviews: 43,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: true,
    },
    {
      id: 3,
      name: "ESP32 Development Board",
      description: "WiFi & Bluetooth dual-mode microcontroller",
      price: 12.5,
      originalPrice: 18.99,
      category: "Microcontrollers",
      condition: "New",
      seller: "ElectroSupply",
      rating: 4.9,
      reviews: 89,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: false,
    },
    {
      id: 4,
      name: "Vintage Oscilloscope - Restored",
      description: "Classic analog oscilloscope, fully refurbished",
      price: 450.0,
      originalPrice: 800.0,
      category: "Test Equipment",
      condition: "Refurbished",
      seller: "VintageElectronics",
      rating: 4.7,
      reviews: 12,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: true,
    },
    {
      id: 5,
      name: "Raspberry Pi 4 Model B",
      description: "4GB RAM single board computer",
      price: 75.0,
      originalPrice: 85.0,
      category: "Single Board Computers",
      condition: "New",
      seller: "PiSupplier",
      rating: 4.9,
      reviews: 234,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: false,
    },
    {
      id: 6,
      name: "Ultrasonic Sensor HC-SR04",
      description: "Distance measuring sensor module",
      price: 3.99,
      originalPrice: 6.99,
      category: "Sensors",
      condition: "New",
      seller: "SensorWorld",
      rating: 4.5,
      reviews: 156,
      image: "/placeholder.svg?height=200&width=200",
      isRefurbished: false,
    },
  ]

  const filteredParts = parts.filter((part) => {
    const matchesSearch =
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(part.category)
    return matchesSearch && matchesCategory
  })

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
    } else {
      setSelectedCategories(selectedCategories.filter((c) => c !== category))
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Ibalilam</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
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

      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-6">
          {/* Page Header */}
          <div className="flex flex-col space-y-4 mb-6">
            <h1 className="text-3xl font-bold">Browse Electronic Parts</h1>
            <p className="text-muted-foreground">Find the perfect components for your next project</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Filters */}
            <div className="lg:w-64 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Categories</h4>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={category}
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
                          />
                          <Label htmlFor={category} className="text-sm">
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Condition</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="new" />
                        <Label htmlFor="new" className="text-sm">
                          New
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="refurbished" />
                        <Label htmlFor="refurbished" className="text-sm">
                          Refurbished
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="used" />
                        <Label htmlFor="used" className="text-sm">
                          Used
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Price Range</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="under10" />
                        <Label htmlFor="under10" className="text-sm">
                          Under $10
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="10to50" />
                        <Label htmlFor="10to50" className="text-sm">
                          $10 - $50
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="50to100" />
                        <Label htmlFor="50to100" className="text-sm">
                          $50 - $100
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="over100" />
                        <Label htmlFor="over100" className="text-sm">
                          Over $100
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-4">
              {/* Search and Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search parts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Select defaultValue="relevance">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                      <SelectItem value="newest">Newest First</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results Count */}
              <p className="text-sm text-muted-foreground">Showing {filteredParts.length} results</p>

              {/* Parts Grid/List */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredParts.map((part) => (
                    <Card key={part.id} className="group hover:shadow-lg transition-shadow">
                      <CardHeader className="p-0">
                        <div className="relative">
                          <Image
                            src={part.image || "/placeholder.svg"}
                            alt={part.name}
                            width={200}
                            height={200}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                          {part.isRefurbished && (
                            <Badge className="absolute top-2 left-2" variant="secondary">
                              Refurbished
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h3 className="font-semibold line-clamp-1">{part.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{part.description}</p>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{part.rating}</span>
                            <span className="text-sm text-muted-foreground">({part.reviews})</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-bold">${part.price}</span>
                              {part.originalPrice > part.price && (
                                <span className="text-sm text-muted-foreground line-through ml-2">
                                  ${part.originalPrice}
                                </span>
                              )}
                            </div>
                            <Badge variant="outline">{part.condition}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">by {part.seller}</p>
                          <Button className="w-full" asChild>
                            <Link href={`/parts/${part.id}`}>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredParts.map((part) => (
                    <Card key={part.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Image
                            src={part.image || "/placeholder.svg"}
                            alt={part.name}
                            width={120}
                            height={120}
                            className="rounded-lg object-cover"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">{part.name}</h3>
                                <p className="text-muted-foreground">{part.description}</p>
                              </div>
                              {part.isRefurbished && <Badge variant="secondary">Refurbished</Badge>}
                            </div>
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{part.rating}</span>
                              <span className="text-sm text-muted-foreground">({part.reviews} reviews)</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div>
                                  <span className="text-xl font-bold">${part.price}</span>
                                  {part.originalPrice > part.price && (
                                    <span className="text-sm text-muted-foreground line-through ml-2">
                                      ${part.originalPrice}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline">{part.condition}</Badge>
                                <span className="text-sm text-muted-foreground">by {part.seller}</span>
                              </div>
                              <Button asChild>
                                <Link href={`/parts/${part.id}`}>View Details</Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
