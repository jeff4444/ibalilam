"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cpu, Star, MapPin, Phone, Mail, Edit, Camera, Save, X, LogOut, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [userProfile, setUserProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    specializations: [] as string[],
  })
  const [shopProfile, setShopProfile] = useState({
    name: "",
    description: "",
  })
  const [newSpecialization, setNewSpecialization] = useState("")
  const [shopData, setShopData] = useState<any>(null)
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Load user data when user is available
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('first_name, last_name, phone, location, bio, specializations')
            .eq('user_id', user.id)
            .maybeSingle()

          if (error) {
            console.error('Error fetching user profile:', error)
            return
          }

          if (data) {
            setUserProfile({
              firstName: data.first_name || "",
              lastName: data.last_name || "",
              email: user.email || "",
              phone: data.phone || "",
              location: data.location || "",
              bio: data.bio || "",
              specializations: data.specializations || [],
            })
          } else {
            // No profile exists yet, set defaults
            setUserProfile({
              firstName: "",
              lastName: "",
              email: user.email || "",
              phone: "",
              location: "",
              bio: "",
              specializations: [],
            })
          }
        } catch (err) {
          console.error('Unexpected error fetching user profile:', err)
        }
      }
    }

    fetchUserProfile()
  }, [user?.id, supabase])

  // Load shop data
  useEffect(() => {
    const fetchShopData = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('shops')
            .select('name, description')
            .eq('user_id', user.id)
            .maybeSingle()

          if (error) {
            console.error('Error fetching shop data:', error)
            return
          }

          if (data) {
            setShopData(data)
            setShopProfile({
              name: data.name || "",
              description: data.description || "",
            })
          }
        } catch (err) {
          console.error('Unexpected error fetching shop data:', err)
        }
      }
    }

    fetchShopData()
  }, [user?.id, supabase])

  const stats = {
    rating: 4.8,
    reviews: 127,
    joinDate: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Unknown",
  }


  const handleSave = async () => {
    setIsLoading(true)
    setError("")
    setSuccess("")
    
    try {
      // Update user profile data in user_profiles table
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user?.id,
          first_name: userProfile.firstName,
          last_name: userProfile.lastName,
          phone: userProfile.phone,
          location: userProfile.location,
          bio: userProfile.bio,
          specializations: userProfile.specializations,
        }, {
          onConflict: 'user_id'
        })

      if (profileError) {
        throw profileError
      }

      // Update shop data in shops table (business information)
      const { error: shopError } = await supabase
        .from('shops')
        .upsert({
          user_id: user?.id,
          name: shopProfile.name,
          description: shopProfile.description,
        }, {
          onConflict: 'user_id'
        })

      if (shopError) {
        throw shopError
      }

      setSuccess("Profile updated successfully!")
      setIsEditing(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form data by re-fetching from database
    if (user?.id) {
      // Re-fetch user profile data
      const fetchUserProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('first_name, last_name, phone, location, bio, specializations')
            .eq('user_id', user.id)
            .maybeSingle()

          if (!error && data) {
            setUserProfile({
              firstName: data.first_name || "",
              lastName: data.last_name || "",
              email: user.email || "",
              phone: data.phone || "",
              location: data.location || "",
              bio: data.bio || "",
              specializations: data.specializations || [],
            })
          }
        } catch (err) {
          console.error('Error resetting user profile:', err)
        }
      }

      fetchUserProfile()
      
      // Reset shop profile
      setShopProfile({
        name: shopData?.name || "",
        description: shopData?.description || "",
      })
    }
    setNewSpecialization("")
    setIsEditing(false)
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !userProfile.specializations.includes(newSpecialization.trim())) {
      setUserProfile({
        ...userProfile,
        specializations: [...userProfile.specializations, newSpecialization.trim()]
      })
      setNewSpecialization("")
    }
  }

  const removeSpecialization = (index: number) => {
    setUserProfile({
      ...userProfile,
      specializations: userProfile.specializations.filter((_, i) => i !== index)
    })
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (err) {
      setError("Failed to logout. Please try again.")
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="px-4 lg:px-6 h-14 flex items-center border-b">
          <Link className="flex items-center justify-center" href="/">
            <Cpu className="h-6 w-6 mr-2 text-blue-600" />
            <span className="font-bold text-xl">Ibalilam</span>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
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

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Profile</h1>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <>
                <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
                <Button variant="outline" onClick={handleLogout} disabled={isLoading}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Button onClick={handleSave} disabled={isLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {isLoading ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
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
                    {`${userProfile.firstName} ${userProfile.lastName}`.trim()
                      .split(" ")
                      .map((n) => n[0])
                      .join("") || "U"}
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
                  <div className="space-y-2">
                    <Input
                      value={userProfile.firstName}
                      onChange={(e) => setUserProfile({ ...userProfile, firstName: e.target.value })}
                      placeholder="First Name"
                      className="text-center font-semibold"
                      disabled={isLoading}
                    />
                    <Input
                      value={userProfile.lastName}
                      onChange={(e) => setUserProfile({ ...userProfile, lastName: e.target.value })}
                      placeholder="Last Name"
                      className="text-center font-semibold"
                      disabled={isLoading}
                    />
                  </div>
                ) : (
                  <h2 className="text-xl font-semibold">{`${userProfile.firstName} ${userProfile.lastName}`.trim() || "User"}</h2>
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
                  <span className="text-sm text-muted-foreground">{userProfile.email}</span>
                  {isEditing && (
                    <Badge variant="secondary" className="text-xs">Read-only</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <Input
                      value={userProfile.phone}
                      onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                      className="text-sm"
                      disabled={isLoading}
                    />
                  ) : (
                    <span className="text-sm">{userProfile.phone}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <Input
                      value={userProfile.location}
                      onChange={(e) => setUserProfile({ ...userProfile, location: e.target.value })}
                      className="text-sm"
                      disabled={isLoading}
                    />
                  ) : (
                    <span className="text-sm">{userProfile.location}</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member since</span>
                  <span>{stats.joinDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="shop">Shop Info</TabsTrigger>
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
                        value={userProfile.bio}
                        onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                        rows={4}
                        placeholder="Tell others about your expertise and interests..."
                        disabled={isLoading}
                      />
                    ) : (
                      <p className="text-muted-foreground">{userProfile.bio || "No bio provided"}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Specializations</CardTitle>
                    <CardDescription>Add your areas of expertise and specializations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {userProfile.specializations.length > 0 ? (
                          userProfile.specializations.map((spec, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <Badge variant="secondary">
                                {spec}
                              </Badge>
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-red-100"
                                  onClick={() => removeSpecialization(index)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {isEditing ? "No specializations added yet" : "No specializations listed"}
                          </p>
                        )}
                      </div>
                      
                      {isEditing && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a specialization..."
                            value={newSpecialization}
                            onChange={(e) => setNewSpecialization(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addSpecialization()}
                            disabled={isLoading}
                            className="flex-1"
                          />
                          <Button
                            onClick={addSpecialization}
                            disabled={!newSpecialization.trim() || isLoading}
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
                          value={shopProfile.name}
                          onChange={(e) => setShopProfile({ ...shopProfile, name: e.target.value })}
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm font-medium">{shopProfile.name || "No shop name set"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shopDescription">Shop Description</Label>
                      {isEditing ? (
                        <Textarea
                          id="shopDescription"
                          value={shopProfile.description}
                          onChange={(e) => setShopProfile({ ...shopProfile, description: e.target.value })}
                          rows={3}
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{shopProfile.description || "No shop description provided"}</p>
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

            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
