"use client"

import { useState } from "react"
import Link from "next/link"
import { Cpu, Star, MapPin, Phone, Mail, Edit, Camera, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    name: "John Smith",
    email: "john.smith@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    bio: "Electronics enthusiast and professional refurbisher with 5+ years of experience. Specializing in vintage electronics restoration and modern component sourcing.",
    shopName: "TechParts Pro",
    shopDescription: "Professional electronics parts and refurbishment services",
  })

  const stats = {
    totalSales: 156,
    rating: 4.8,
    reviews: 127,
    joinDate: "January 2022",
    responseTime: "2.3 hours",
  }

  const recentActivity = [
    {
      id: 1,
      type: "sale",
      description: "Sold Arduino Uno R3 to Sarah Johnson",
      date: "2024-01-15",
      amount: "$25.99",
    },
    {
      id: 2,
      type: "listing",
      description: "Listed Refurbished iPhone 12 Logic Board",
      date: "2024-01-14",
      amount: "$299.99",
    },
    {
      id: 3,
      type: "review",
      description: "Received 5-star review from Mike Rodriguez",
      date: "2024-01-13",
      amount: null,
    },
    {
      id: 4,
      type: "sale",
      description: "Sold ESP32 Development Board to Alex Chen",
      date: "2024-01-12",
      amount: "$12.50",
    },
  ]

  const handleSave = () => {
    // In a real app, this would save to backend
    setIsEditing(false)
  }

  const handleCancel = () => {
    // Reset form data
    setIsEditing(false)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Ibalilam</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
            Profile
          </Link>
        </nav>
      </header>

      <div className="flex-1 space-y-6 p-4 md:p-8 flex items-center justify-center">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Profile</h1>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">Logout</Link>
                </Button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardHeader className="text-center">
              <div className="relative mx-auto">
                <Avatar className="w-24 h-24">
                  <AvatarImage src="/placeholder.svg?height=96&width=96" />
                  <AvatarFallback className="text-2xl">
                    {profileData.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button size="sm" className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0">
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {isEditing ? (
                  <Input
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="text-center font-semibold"
                  />
                ) : (
                  <h2 className="text-xl font-semibold">{profileData.name}</h2>
                )}
                <div className="flex items-center justify-center space-x-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{stats.rating}</span>
                  <span className="text-muted-foreground">({stats.reviews} reviews)</span>
                </div>
                <Badge variant="secondary">Verified Seller</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-sm">{profileData.email}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-sm">{profileData.phone}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <Input
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-sm">{profileData.location}</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member since</span>
                  <span>{stats.joinDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total sales</span>
                  <span>{stats.totalSales}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Response time</span>
                  <span>{stats.responseTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="shop">Shop Info</TabsTrigger>
                <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>About Me</CardTitle>
                    <CardDescription>Tell others about your expertise and interests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                        rows={4}
                        placeholder="Tell others about your expertise and interests..."
                      />
                    ) : (
                      <p className="text-muted-foreground">{profileData.bio}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Specializations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Microcontrollers</Badge>
                      <Badge>Vintage Electronics</Badge>
                      <Badge>Logic Board Repair</Badge>
                      <Badge>Component Testing</Badge>
                      <Badge>Arduino Projects</Badge>
                      <Badge>Raspberry Pi</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shop" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Shop Information</CardTitle>
                    <CardDescription>Manage your shop details and policies</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="shopName">Shop Name</Label>
                      {isEditing ? (
                        <Input
                          id="shopName"
                          value={profileData.shopName}
                          onChange={(e) => setProfileData({ ...profileData, shopName: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm font-medium">{profileData.shopName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shopDescription">Shop Description</Label>
                      {isEditing ? (
                        <Textarea
                          id="shopDescription"
                          value={profileData.shopDescription}
                          onChange={(e) => setProfileData({ ...profileData, shopDescription: e.target.value })}
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{profileData.shopDescription}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shop Policies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Return Policy</h4>
                      <p className="text-sm text-muted-foreground">
                        30-day return policy for all items. Items must be in original condition.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Shipping</h4>
                      <p className="text-sm text-muted-foreground">
                        Free shipping on orders over $50. Standard shipping takes 3-5 business days.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Warranty</h4>
                      <p className="text-sm text-muted-foreground">
                        All refurbished items come with a 90-day warranty. New items have manufacturer warranty.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest transactions and interactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between py-2 border-b last:border-b-0"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                activity.type === "sale"
                                  ? "bg-green-500"
                                  : activity.type === "listing"
                                    ? "bg-blue-500"
                                    : "bg-yellow-500"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium">{activity.description}</p>
                              <p className="text-xs text-muted-foreground">{activity.date}</p>
                            </div>
                          </div>
                          {activity.amount && (
                            <span className="text-sm font-medium text-green-600">{activity.amount}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
