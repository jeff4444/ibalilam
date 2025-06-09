"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Cpu,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  Wrench,
  Store,
  TrendingUp,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CartButton } from "@/components/cart-button"

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState("")

  // Mock data
  const stats = {
    totalSales: 12450,
    activeListing: 23,
    totalViews: 1847,
    refurbishedSold: 8,
  }

  const originalParts = [
    {
      id: 1,
      name: "Arduino Uno R3",
      category: "Microcontrollers",
      price: 25.99,
      stock: 15,
      status: "active",
      views: 234,
      image: "/placeholder.svg?height=60&width=60",
    },
    {
      id: 2,
      name: "Raspberry Pi 4 Model B",
      category: "Single Board Computers",
      price: 75.0,
      stock: 8,
      status: "active",
      views: 456,
      image: "/placeholder.svg?height=60&width=60",
    },
    {
      id: 3,
      name: "ESP32 Development Board",
      category: "Microcontrollers",
      price: 12.5,
      stock: 0,
      status: "out_of_stock",
      views: 123,
      image: "/placeholder.svg?height=60&width=60",
    },
  ]

  const refurbishedParts = [
    {
      id: 1,
      name: "Refurbished iPhone 12 Logic Board",
      originalCondition: "Damaged",
      refurbishedCondition: "Like New",
      price: 299.99,
      cost: 150.0,
      profit: 149.99,
      status: "active",
      timeSpent: "4 hours",
      image: "/placeholder.svg?height=60&width=60",
    },
    {
      id: 2,
      name: "Restored Vintage Oscilloscope",
      originalCondition: "Non-functional",
      refurbishedCondition: "Fully Working",
      price: 450.0,
      cost: 200.0,
      profit: 250.0,
      status: "sold",
      timeSpent: "12 hours",
      image: "/placeholder.svg?height=60&width=60",
    },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
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

      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button asChild>
              <Link href="/sell">
                <Plus className="mr-2 h-4 w-4" />
                Add New Part
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeListing}</div>
              <p className="text-xs text-muted-foreground">+2 new this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+15% from last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Refurbished Sold</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.refurbishedSold}</div>
              <p className="text-xs text-muted-foreground">+3 this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="original" className="space-y-4">
          <TabsList>
            <TabsTrigger value="original">Original Parts</TabsTrigger>
            <TabsTrigger value="refurbished">Refurbished Parts</TabsTrigger>
            <TabsTrigger value="shop">Shop Management</TabsTrigger>
          </TabsList>

          {/* Original Parts Tab */}
          <TabsContent value="original" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Original Parts Listings</CardTitle>
                <CardDescription>Manage your electronic parts inventory and listings</CardDescription>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search parts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originalParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <Image
                              src={part.image || "/placeholder.svg"}
                              alt={part.name}
                              width={40}
                              height={40}
                              className="rounded-md"
                            />
                            <span>{part.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{part.category}</TableCell>
                        <TableCell>${part.price}</TableCell>
                        <TableCell>{part.stock}</TableCell>
                        <TableCell>
                          <Badge variant={part.status === "active" ? "default" : "secondary"}>
                            {part.status === "active" ? "Active" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>{part.views}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Refurbished Parts Tab */}
          <TabsContent value="refurbished" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Refurbished Parts</CardTitle>
                <CardDescription>Track your refurbishment projects and their profitability</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Original Condition</TableHead>
                      <TableHead>Refurbished Condition</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Time Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refurbishedParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <Image
                              src={part.image || "/placeholder.svg"}
                              alt={part.name}
                              width={40}
                              height={40}
                              className="rounded-md"
                            />
                            <span>{part.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">{part.originalCondition}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{part.refurbishedCondition}</Badge>
                        </TableCell>
                        <TableCell>${part.cost}</TableCell>
                        <TableCell>${part.price}</TableCell>
                        <TableCell className="text-green-600 font-medium">+${part.profit}</TableCell>
                        <TableCell>{part.timeSpent}</TableCell>
                        <TableCell>
                          <Badge variant={part.status === "active" ? "default" : "secondary"}>
                            {part.status === "active" ? "Active" : "Sold"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Listing
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shop Management Tab */}
          <TabsContent value="shop" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Store className="mr-2 h-5 w-5" />
                    Shop Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium">Shop Name</h4>
                    <p className="text-sm text-muted-foreground">TechParts Pro</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Shop Description</h4>
                    <p className="text-sm text-muted-foreground">
                      Professional electronics parts and refurbishment services
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Rating</h4>
                    <p className="text-sm text-muted-foreground">4.8/5 (127 reviews)</p>
                  </div>
                  <Button className="w-full">Edit Shop Profile</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Conversion Rate</span>
                    <span className="text-sm font-medium">12.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg. Response Time</span>
                    <span className="text-sm font-medium">2.3 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Customer Satisfaction</span>
                    <span className="text-sm font-medium">96%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Repeat Customers</span>
                    <span className="text-sm font-medium">34%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest customer orders and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">#ORD-001</TableCell>
                      <TableCell>John Smith</TableCell>
                      <TableCell>Arduino Uno R3</TableCell>
                      <TableCell>$25.99</TableCell>
                      <TableCell>
                        <Badge>Shipped</Badge>
                      </TableCell>
                      <TableCell>2024-01-15</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">#ORD-002</TableCell>
                      <TableCell>Sarah Johnson</TableCell>
                      <TableCell>Refurbished Logic Board</TableCell>
                      <TableCell>$299.99</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Processing</Badge>
                      </TableCell>
                      <TableCell>2024-01-14</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
