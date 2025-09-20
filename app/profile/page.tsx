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
import { FicaUpload } from "@/components/fica-upload"
import { FicaBadge } from "@/components/fica-badge"
import { useFica } from "@/hooks/use-fica"

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
    userRole: "visitor" as "visitor" | "buyer" | "seller" | "admin" | "support",
    ficaStatus: null as "pending" | "verified" | "rejected" | null,
    ficaRejectionReason: "",
  })
  const [shopProfile, setShopProfile] = useState({
    name: "",
    description: "",
  })
  const [shopPolicies, setShopPolicies] = useState({
    return_policy: "",
    shipping_policy: "",
    payment_policy: "",
    warranty_policy: "",
    privacy_policy: "",
    terms_of_service: "",
  })
  const [shopStats, setShopStats] = useState({
    rating: 0,
    review_count: 0,
  })
  const [newSpecialization, setNewSpecialization] = useState("")
  const [shopData, setShopData] = useState<any>(null)
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const supabase = createClient()
  const { ficaStatus } = useFica()

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
            .select('first_name, last_name, phone, location, bio, specializations, user_role, fica_status, fica_rejection_reason')
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
              userRole: data.user_role || "visitor",
              ficaStatus: data.fica_status || null,
              ficaRejectionReason: data.fica_rejection_reason || "",
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
              userRole: "visitor",
              ficaStatus: null,
              ficaRejectionReason: "",
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
            .select('name, description, rating, review_count, return_policy, shipping_policy, payment_policy, warranty_policy, privacy_policy, terms_of_service')
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
            setShopPolicies({
              return_policy: data.return_policy || "",
              shipping_policy: data.shipping_policy || "",
              payment_policy: data.payment_policy || "",
              warranty_policy: data.warranty_policy || "",
              privacy_policy: data.privacy_policy || "",
              terms_of_service: data.terms_of_service || "",
            })
            setShopStats({
              rating: data.rating || 0,
              review_count: data.review_count || 0,
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
    rating: shopStats.rating,
    reviews: shopStats.review_count,
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
          return_policy: shopPolicies.return_policy,
          shipping_policy: shopPolicies.shipping_policy,
          payment_policy: shopPolicies.payment_policy,
          warranty_policy: shopPolicies.warranty_policy,
          privacy_policy: shopPolicies.privacy_policy,
          terms_of_service: shopPolicies.terms_of_service,
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
            .select('first_name, last_name, phone, location, bio, specializations, user_role, fica_status, fica_rejection_reason')
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
              userRole: data.user_role || "visitor",
              ficaStatus: data.fica_status || null,
              ficaRejectionReason: data.fica_rejection_reason || "",
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
      setShopPolicies({
        return_policy: shopData?.return_policy || "",
        shipping_policy: shopData?.shipping_policy || "",
        payment_policy: shopData?.payment_policy || "",
        warranty_policy: shopData?.warranty_policy || "",
        privacy_policy: shopData?.privacy_policy || "",
        terms_of_service: shopData?.terms_of_service || "",
      })
      setShopStats({
        rating: shopData?.rating || 0,
        review_count: shopData?.review_count || 0,
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

  const handleBecomeSeller = async () => {
    try {
      setIsLoading(true)
      setError("")
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ user_role: 'seller' })
        .eq('user_id', user?.id)

      if (error) {
        setError("Failed to update user role. Please try again.")
        return
      }

      setSuccess("Successfully updated to seller role!")
      setUserProfile(prev => ({ ...prev, userRole: 'seller' }))
      
      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
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
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
            Favorites
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
                  <span className="font-medium">{stats.rating > 0 ? stats.rating.toFixed(1) : "No rating"}</span>
                  <span className="text-muted-foreground">
                    ({stats.reviews} {stats.reviews === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
                <FicaBadge 
                  status={userProfile.ficaStatus} 
                  rejectionReason={userProfile.ficaRejectionReason}
                />
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="shop">Shop Info</TabsTrigger>
                <TabsTrigger value="fica">FICA Verification</TabsTrigger>
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
                    <CardDescription>Manage your shop policies and terms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="returnPolicy">Return Policy</Label>
                      {isEditing ? (
                        <Textarea
                          id="returnPolicy"
                          value={shopPolicies.return_policy}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, return_policy: e.target.value })}
                          rows={3}
                          placeholder="Describe your return and refund policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.return_policy || "No return policy specified"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shippingPolicy">Shipping Policy</Label>
                      {isEditing ? (
                        <Textarea
                          id="shippingPolicy"
                          value={shopPolicies.shipping_policy}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, shipping_policy: e.target.value })}
                          rows={3}
                          placeholder="Describe your shipping and delivery policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.shipping_policy || "No shipping policy specified"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentPolicy">Payment Policy</Label>
                      {isEditing ? (
                        <Textarea
                          id="paymentPolicy"
                          value={shopPolicies.payment_policy}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, payment_policy: e.target.value })}
                          rows={3}
                          placeholder="Describe your payment methods and processing policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.payment_policy || "No payment policy specified"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="warrantyPolicy">Warranty Policy</Label>
                      {isEditing ? (
                        <Textarea
                          id="warrantyPolicy"
                          value={shopPolicies.warranty_policy}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, warranty_policy: e.target.value })}
                          rows={3}
                          placeholder="Describe your warranty and guarantee policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.warranty_policy || "No warranty policy specified"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="privacyPolicy">Privacy Policy</Label>
                      {isEditing ? (
                        <Textarea
                          id="privacyPolicy"
                          value={shopPolicies.privacy_policy}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, privacy_policy: e.target.value })}
                          rows={3}
                          placeholder="Describe your privacy and data handling policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.privacy_policy || "No privacy policy specified"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="termsOfService">Terms of Service</Label>
                      {isEditing ? (
                        <Textarea
                          id="termsOfService"
                          value={shopPolicies.terms_of_service}
                          onChange={(e) => setShopPolicies({ ...shopPolicies, terms_of_service: e.target.value })}
                          rows={3}
                          placeholder="Describe your terms of service and usage policy..."
                          disabled={isLoading}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {shopPolicies.terms_of_service || "No terms of service specified"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fica" className="space-y-4">
                {userProfile.userRole !== 'seller' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Become a Seller</CardTitle>
                      <CardDescription>
                        Start selling on Techafon by becoming a seller
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={handleBecomeSeller}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? 'Updating...' : 'Become a Seller'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                <Card>
                  <CardHeader>
                    <CardTitle>FICA Verification</CardTitle>
                    <CardDescription>
                      Complete FICA verification to become a verified seller and access loan features
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FicaUpload />
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
