"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, MessageCircle, User, Mail, MapPin, Clock, Shield } from "lucide-react"
import Link from "next/link"

export default function ContactSellerPage({ params }: { params: { sellerId: string } }) {
  const [message, setMessage] = useState("")

  // Mock seller data - in real app, fetch based on sellerId
  const seller = {
    id: params.sellerId,
    name: "Mike Johnson",
    avatar: "/placeholder.svg?height=80&width=80",
    rating: 4.8,
    totalReviews: 127,
    joinDate: "March 2022",
    location: "Austin, TX",
    responseTime: "< 2 hours",
    verified: true,
    bio: "Electronics technician with 15+ years experience. Specializing in microcontrollers, sensors, and repair components.",
    stats: {
      totalSales: 340,
      completionRate: 98,
      repeatCustomers: 85,
    },
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle message submission
    console.log("Message sent:", message)
    alert("Message sent successfully!")
    setMessage("")
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Seller</h1>
          <p className="text-gray-600">Get in touch with the part seller</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Seller Profile */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={seller.avatar || "/placeholder.svg"} alt={seller.name} />
                    <AvatarFallback>
                      {seller.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="flex items-center justify-center gap-2">
                  {seller.name}
                  {seller.verified && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center justify-center gap-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.floor(seller.rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 ml-1">
                    {seller.rating} ({seller.totalReviews} reviews)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 text-center">{seller.bio}</p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{seller.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>Responds in {seller.responseTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>Member since {seller.joinDate}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Seller Stats</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Sales:</span>
                      <span className="font-medium">{seller.stats.totalSales}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completion Rate:</span>
                      <span className="font-medium">{seller.stats.completionRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Repeat Customers:</span>
                      <span className="font-medium">{seller.stats.repeatCustomers}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Send Message
                </CardTitle>
                <CardDescription>Ask questions about the part or discuss details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input id="subject" placeholder="e.g., Question about Arduino Uno" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regarding">Regarding Part (Optional)</Label>
                      <Input id="regarding" placeholder="Part name or ID" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      placeholder="Hi! I'm interested in your part. Could you tell me more about its condition and if you have the original packaging?"
                      className="min-h-[150px]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                    <p className="text-sm text-gray-500">
                      Be specific about what you'd like to know. Include questions about condition, shipping, or
                      technical details.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-method">Preferred Contact Method</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="contact" value="platform" defaultChecked />
                        <span className="text-sm">Platform Messages</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="contact" value="email" />
                        <span className="text-sm">Email</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button type="submit" className="flex-1">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/parts">Back to Parts</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Quick Contact Options */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Other ways to connect with this seller</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="justify-start">
                    <User className="h-4 w-4 mr-2" />
                    View All Parts by {seller.name.split(" ")[0]}
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Star className="h-4 w-4 mr-2" />
                    Read Reviews
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
