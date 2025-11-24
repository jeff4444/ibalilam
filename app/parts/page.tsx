"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Cpu, Search, Grid, List, Star, ShoppingCart, Filter, X, Smartphone, Laptop, Gamepad2, Wrench, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CartButton } from "@/components/cart-button"
import { MainNavbar } from "@/components/navbar"
import { useParts } from "@/hooks/use-parts"

// Category configuration with icons and names
const CATEGORY_CONFIG = {
  mobile_phones: { name: "Mobile Phones", icon: Smartphone, subcategories: ["smartphones", "feature_phones"] },
  phone_parts: { name: "Phone Parts", icon: Wrench, subcategories: ["screen", "battery", "charging_port", "camera", "speaker", "microphone", "housing", "other"] },
  phone_accessories: { name: "Phone Accessories", icon: Package, subcategories: ["charger", "case", "earphones", "screen_protector", "cable", "other"] },
  laptops: { name: "Laptops", icon: Laptop, subcategories: ["gaming", "business", "ultrabook", "workstation", "chromebook", "other"] },
  steam_kits: { name: "STEAM Kits", icon: Gamepad2, subcategories: ["coding", "robotics", "ai", "electronics", "other"] },
  other_electronics: { name: "Other Electronics", icon: Cpu, subcategories: ["tv", "audio", "gaming", "networking", "power", "other"] }
}

export default function PartsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState({ min: null as number | null, max: null as number | null })
  const [location, setLocation] = useState("")
  const [sortBy, setSortBy] = useState<"relevance" | "price-low" | "price-high" | "rating" | "newest" | "most-viewed">("relevance")
  const [ficaVerifiedOnly, setFicaVerifiedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const {
    parts,
    loading,
    error,
    totalCount,
    filters,
    updateFilters,
    categories,
    conditions,
    categoryHierarchy,
    refresh
  } = useParts()

  // Update filters when local state changes
  useEffect(() => {
    updateFilters({
      search: searchTerm,
      categories: selectedCategories,
      subcategories: selectedSubcategories,
      brands: selectedBrands,
      models: selectedModels,
      conditions: selectedConditions,
      priceRange,
      location,
      sortBy,
      ficaVerifiedOnly
    })
  }, [searchTerm, selectedCategories, selectedSubcategories, selectedBrands, selectedModels, selectedConditions, priceRange, location, sortBy, ficaVerifiedOnly, updateFilters])

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
      // Clear subcategories when category changes
      setSelectedSubcategories([])
    } else {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
      // Remove subcategories of unchecked category
      const categoryConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
      if (categoryConfig) {
        setSelectedSubcategories(selectedSubcategories.filter(sub => !categoryConfig.subcategories.includes(sub)))
      }
    }
  }

  const handleSubcategoryChange = (subcategory: string, checked: boolean) => {
    if (checked) {
      setSelectedSubcategories([...selectedSubcategories, subcategory])
    } else {
      setSelectedSubcategories(selectedSubcategories.filter(s => s !== subcategory))
    }
  }

  const handleBrandChange = (brand: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands([...selectedBrands, brand])
    } else {
      setSelectedBrands(selectedBrands.filter(b => b !== brand))
    }
  }

  const handleModelChange = (model: string, checked: boolean) => {
    if (checked) {
      setSelectedModels([...selectedModels, model])
    } else {
      setSelectedModels(selectedModels.filter(m => m !== model))
    }
  }

  const handleConditionChange = (condition: string, checked: boolean) => {
    if (checked) {
      setSelectedConditions([...selectedConditions, condition])
    } else {
      setSelectedConditions(selectedConditions.filter(c => c !== condition))
    }
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedCategories([])
    setSelectedSubcategories([])
    setSelectedBrands([])
    setSelectedModels([])
    setSelectedConditions([])
    setPriceRange({ min: null, max: null })
    setLocation("")
    setSortBy("relevance")
    setFicaVerifiedOnly(false)
  }

  // Get unique brands and models from parts
  const availableBrands = Array.from(new Set(parts.map(part => part.brand).filter(Boolean))) as string[]
  const availableModels = Array.from(new Set(parts.map(part => part.model).filter(Boolean))) as string[]

  // Get available subcategories based on selected categories
  const availableSubcategories = selectedCategories.length > 0 
    ? selectedCategories.flatMap(category => CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.subcategories || [])
    : Object.values(CATEGORY_CONFIG).flatMap(config => config.subcategories)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(price)
  }

  const getCategoryIcon = (category: string) => {
    const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
    return config ? config.icon : Cpu
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNavbar />

      <div className="flex-1 w-full max-w-[95%] mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Marketplace</h1>
          <p className="text-gray-600">Find the perfect item for your needs</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search for items, brands, models..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Quick Category Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const IconComponent = config.icon
              const isSelected = selectedCategories.includes(key)
              return (
                <Button
                  key={key}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCategoryChange(key, !isSelected)}
                  className="flex items-center gap-2"
                >
                  <IconComponent className="h-4 w-4" />
                  {config.name}
                </Button>
              )
            })}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Advanced Filters</span>
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Categories */}
                  <div className="space-y-3">
                    <Label>Categories</Label>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                      const IconComponent = config.icon
                      return (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${key}`}
                            checked={selectedCategories.includes(key)}
                            onCheckedChange={(checked) => handleCategoryChange(key, checked as boolean)}
                          />
                          <Label htmlFor={`category-${key}`} className="flex items-center gap-2 text-sm">
                            <IconComponent className="h-4 w-4" />
                            {config.name}
                          </Label>
                        </div>
                      )
                    })}
                  </div>

                  {/* Subcategories */}
                  {selectedCategories.length > 0 && (
                    <div className="space-y-3">
                      <Label>Subcategories</Label>
                      {availableSubcategories.map(subcategory => (
                        <div key={subcategory} className="flex items-center space-x-2">
                          <Checkbox
                            id={`subcategory-${subcategory}`}
                            checked={selectedSubcategories.includes(subcategory)}
                            onCheckedChange={(checked) => handleSubcategoryChange(subcategory, checked as boolean)}
                          />
                          <Label htmlFor={`subcategory-${subcategory}`} className="text-sm capitalize">
                            {subcategory.replace('_', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Brands */}
                  {availableBrands.length > 0 && (
                    <div className="space-y-3">
                      <Label>Brands</Label>
                      {availableBrands.slice(0, 10).map(brand => (
                        <div key={brand} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand}`}
                            checked={selectedBrands.includes(brand)}
                            onCheckedChange={(checked) => handleBrandChange(brand, checked as boolean)}
                          />
                          <Label htmlFor={`brand-${brand}`} className="text-sm">
                            {brand}
                          </Label>
                        </div>
                      ))}
                      
                    </div>
                  )}

                  {/* Conditions */}
                  <div className="space-y-3">
                    <Label>Condition</Label>
                    {conditions.map(condition => (
                      <div key={condition} className="flex items-center space-x-2">
                        <Checkbox
                          id={`condition-${condition}`}
                          checked={selectedConditions.includes(condition)}
                          onCheckedChange={(checked) => handleConditionChange(condition, checked as boolean)}
                        />
                        <Label htmlFor={`condition-${condition}`} className="text-sm capitalize">
                          {condition}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="space-y-3">
                  <Label>Price Range (ZAR)</Label>
                  <div className="flex gap-4 items-center">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min || ''}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : null }))}
                    />
                    <span>to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max || ''}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : null }))}
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-3">
                  <Label>Location</Label>
                  <Input
                    placeholder="City or town"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* FICA Verified Only */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fica-verified"
                    checked={ficaVerifiedOnly}
                    onCheckedChange={(checked) => setFicaVerifiedOnly(checked as boolean)}
                  />
                  <Label htmlFor="fica-verified">FICA Verified Sellers Only</Label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <p className="text-gray-600">
              {loading ? "Loading..." : `${totalCount} items found`}
            </p>
            {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedBrands.length > 0 || selectedConditions.length > 0 || priceRange.min || priceRange.max || location || ficaVerifiedOnly) && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="most-viewed">Most Viewed</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg">
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

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Results */}
        {!loading && parts.length === 0 && (
          <div className="text-center py-12">
            <Cpu className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters</p>
            <Button onClick={clearAllFilters}>Clear All Filters</Button>
          </div>
        )}

        {!loading && parts.length > 0 && (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
            {parts.map((part) => {
              const CategoryIcon = getCategoryIcon(part.category)
              return (
                <Card key={part.id} className="hover:shadow-lg transition-shadow">
                  <Link href={`/parts/${part.id}`}>
                    <CardContent className="p-0">
                      <div className="relative">
                        <Image
                          src={part.image_url || "/placeholder.svg"}
                          alt={part.name}
                          width={300}
                          height={200}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                        <Badge className="absolute top-2 left-2 bg-white text-black">
                          <CategoryIcon className="h-3 w-3 mr-1" />
                          {CATEGORY_CONFIG[part.category as keyof typeof CATEGORY_CONFIG]?.name || part.category}
                        </Badge>
                        {part.subcategory && (
                          <Badge variant="secondary" className="absolute top-2 right-2">
                            {part.subcategory}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{part.name}</h3>
                        {part.brand && (
                          <p className="text-sm text-gray-600 mb-1">{part.brand}</p>
                        )}
                        {part.model && (
                          <p className="text-sm text-gray-600 mb-1">{part.model}</p>
                        )}
                        {part.location_city && (
                          <p className="text-sm text-gray-500 mb-2">📍 {part.location_city}</p>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xl font-bold text-green-600">{formatPrice(part.price)}</span>
                          {part.condition_status && (
                            <Badge variant="outline" className="capitalize">
                              {part.condition_status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>{part.shop_rating?.toFixed(1) || 'N/A'}</span>
                          </div>
                          <span>{part.shop_name}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
