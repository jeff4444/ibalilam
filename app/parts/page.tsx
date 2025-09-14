"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Cpu, Search, Grid, List, Star, ShoppingCart, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CartButton } from "@/components/cart-button"
import { useParts } from "@/hooks/use-parts"

export default function PartsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedPartTypes, setSelectedPartTypes] = useState<string[]>([])
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState({ min: null as number | null, max: null as number | null })
  const [sortBy, setSortBy] = useState<"relevance" | "price-low" | "price-high" | "rating" | "newest">("relevance")

  const {
    parts,
    loading,
    error,
    totalCount,
    filters,
    updateFilters,
    categories,
    conditions,
    refresh
  } = useParts()

  // Update filters when local state changes
  useEffect(() => {
    updateFilters({
      search: filters.search,
      categories: selectedCategories,
      partTypes: selectedPartTypes,
      conditions: selectedConditions,
      priceRange,
      sortBy
    })
  }, [selectedCategories, selectedPartTypes, selectedConditions, priceRange, sortBy, updateFilters])

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
    } else {
      setSelectedCategories(selectedCategories.filter((c) => c !== category))
    }
  }

  const handlePartTypeChange = (partType: string, checked: boolean) => {
    if (checked) {
      setSelectedPartTypes([...selectedPartTypes, partType])
    } else {
      setSelectedPartTypes(selectedPartTypes.filter((t) => t !== partType))
    }
  }

  const handleConditionChange = (condition: string, checked: boolean) => {
    if (checked) {
      setSelectedConditions([...selectedConditions, condition])
    } else {
      setSelectedConditions(selectedConditions.filter((c) => c !== condition))
    }
  }

  const handlePriceRangeChange = (range: string, checked: boolean) => {
    if (checked) {
      switch (range) {
        case 'under10':
          setPriceRange({ min: 0, max: 10 })
          break
        case '10to50':
          setPriceRange({ min: 10, max: 50 })
          break
        case '50to100':
          setPriceRange({ min: 50, max: 100 })
          break
        case 'over100':
          setPriceRange({ min: 100, max: null })
          break
      }
    } else {
      setPriceRange({ min: null, max: null })
    }
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedPartTypes([])
    setSelectedConditions([])
    setPriceRange({ min: null, max: null })
    updateFilters({ search: '' })
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

      <div className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Page Header */}
          <div className="flex flex-col space-y-4 mb-6">
            <h1 className="text-3xl font-bold">Browse Electronic Parts</h1>
            <p className="text-muted-foreground">Find the perfect components for your next project</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Filters */}
            <div className="lg:w-64 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Filters</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
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
                    <h4 className="font-medium mb-3">Part Type</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="original" 
                          checked={selectedPartTypes.includes('original')}
                          onCheckedChange={(checked) => handlePartTypeChange('original', checked as boolean)}
                        />
                        <Label htmlFor="original" className="text-sm">
                          Original
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="refurbished" 
                          checked={selectedPartTypes.includes('refurbished')}
                          onCheckedChange={(checked) => handlePartTypeChange('refurbished', checked as boolean)}
                        />
                        <Label htmlFor="refurbished" className="text-sm">
                          Refurbished
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Condition</h4>
                    <div className="space-y-2">
                      {conditions.map((condition) => (
                        <div key={condition} className="flex items-center space-x-2">
                          <Checkbox
                            id={condition}
                            checked={selectedConditions.includes(condition)}
                            onCheckedChange={(checked) => handleConditionChange(condition, checked as boolean)}
                          />
                          <Label htmlFor={condition} className="text-sm capitalize">
                            {condition.replace('-', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Price Range</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="under10" 
                          checked={priceRange.min === 0 && priceRange.max === 10}
                          onCheckedChange={(checked) => handlePriceRangeChange('under10', checked as boolean)}
                        />
                        <Label htmlFor="under10" className="text-sm">
                          Under $10
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="10to50" 
                          checked={priceRange.min === 10 && priceRange.max === 50}
                          onCheckedChange={(checked) => handlePriceRangeChange('10to50', checked as boolean)}
                        />
                        <Label htmlFor="10to50" className="text-sm">
                          $10 - $50
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="50to100" 
                          checked={priceRange.min === 50 && priceRange.max === 100}
                          onCheckedChange={(checked) => handlePriceRangeChange('50to100', checked as boolean)}
                        />
                        <Label htmlFor="50to100" className="text-sm">
                          $50 - $100
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="over100" 
                          checked={priceRange.min === 100 && priceRange.max === null}
                          onCheckedChange={(checked) => handlePriceRangeChange('over100', checked as boolean)}
                        />
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
                    value={filters.search}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    className="pl-8"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
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
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading...' : `Showing ${parts.length} of ${totalCount} results`}
              </p>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading parts...</p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && parts.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No parts found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your filters or search terms
                    </p>
                    <Button onClick={clearFilters} variant="outline">
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}

              {/* Parts Grid/List */}
              {!loading && parts.length > 0 && viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parts.map((part) => (
                    <Card key={part.id} className="group hover:shadow-lg transition-shadow">
                      <CardHeader className="p-0">
                        <div className="relative">
                          <Image
                            src={part.image_url || "/placeholder.svg"}
                            alt={part.name}
                            width={200}
                            height={200}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                          {part.part_type === 'refurbished' && (
                            <Badge className="absolute top-2 left-2" variant="secondary">
                              Refurbished
                            </Badge>
                          )}
                          {part.stock_quantity === 0 && (
                            <Badge className="absolute top-2 right-2" variant="destructive">
                              Out of Stock
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
                            <span className="text-sm font-medium">{part.shop_rating?.toFixed(1) || 'N/A'}</span>
                            <span className="text-sm text-muted-foreground">({part.shop_review_count || 0})</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-bold">${part.price.toFixed(2)}</span>
                              {part.part_type === 'refurbished' && part.cost && (
                                <span className="text-sm text-muted-foreground line-through ml-2">
                                  ${part.cost.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <Badge variant="outline">
                              {part.part_type === 'refurbished' ? part.refurbished_condition : 'Original'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">by {part.shop_name}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Stock: {part.stock_quantity}</span>
                            <span>{part.views} views</span>
                          </div>
                          <Button className="w-full" asChild disabled={part.stock_quantity === 0}>
                            <Link href={`/parts/${part.id}`}>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              {part.stock_quantity === 0 ? 'Out of Stock' : 'View Details'}
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !loading && parts.length > 0 && (
                <div className="space-y-4">
                  {parts.map((part) => (
                    <Card key={part.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Image
                            src={part.image_url || "/placeholder.svg"}
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
                              <div className="flex gap-2">
                                {part.part_type === 'refurbished' && <Badge variant="secondary">Refurbished</Badge>}
                                {part.stock_quantity === 0 && <Badge variant="destructive">Out of Stock</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{part.shop_rating?.toFixed(1) || 'N/A'}</span>
                              <span className="text-sm text-muted-foreground">({part.shop_review_count || 0} reviews)</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div>
                                  <span className="text-xl font-bold">${part.price.toFixed(2)}</span>
                                  {part.part_type === 'refurbished' && part.cost && (
                                    <span className="text-sm text-muted-foreground line-through ml-2">
                                      ${part.cost.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline">
                                  {part.part_type === 'refurbished' ? part.refurbished_condition : 'Original'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">by {part.shop_name}</span>
                                <span className="text-xs text-muted-foreground">Stock: {part.stock_quantity}</span>
                              </div>
                              <Button asChild disabled={part.stock_quantity === 0}>
                                <Link href={`/parts/${part.id}`}>
                                  {part.stock_quantity === 0 ? 'Out of Stock' : 'View Details'}
                                </Link>
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
