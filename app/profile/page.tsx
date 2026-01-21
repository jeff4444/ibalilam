"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cpu, Star, MapPin, Phone, Mail, Edit, Camera, Save, X, LogOut, Plus, Trash2, Shield } from "lucide-react"
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
import { NotificationPreferences } from "@/components/notification-preferences"
import { FicaUpload } from "@/components/fica-upload"
import { FicaBadge } from "@/components/fica-badge"
import { useFica } from "@/hooks/use-fica"
import { MainNavbar } from "@/components/navbar"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFicaLoading, setIsFicaLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [ficaError, setFicaError] = useState("")
  const [ficaSuccess, setFicaSuccess] = useState("")
  const [userProfile, setUserProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    address: "",
    bio: "",
    specializations: [] as string[],
    userRole: "visitor" as "visitor" | "buyer" | "seller" | "admin" | "support",
    ficaStatus: null as "pending" | "verified" | "rejected" | null,
    ficaRejectionReason: "",
  })
  const [shopProfile, setShopProfile] = useState({
    name: "",
    description: "",
    registration_number: "",
    owner_name: "",
    owner_phone: "",
    owner_email: "",
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
  const [distributionLocations, setDistributionLocations] = useState<string[]>([])
  const [newDistributionLocation, setNewDistributionLocation] = useState("")
  const [shopData, setShopData] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [enableBecomeSeller, setEnableBecomeSeller] = useState(true)
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const supabase = createClient()
  const { ficaStatus, documents: ficaDocuments } = useFica()

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
            .select('first_name, last_name, phone, location, address, bio, specializations, user_role, fica_status, fica_rejection_reason')
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
              address: data.address || "",
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
              address: "",
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
            .select('name, description, rating, review_count, return_policy, shipping_policy, payment_policy, warranty_policy, privacy_policy, terms_of_service, registration_number, owner_name, owner_phone, owner_email, distribution_locations')
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
              registration_number: data.registration_number || "",
              owner_name: data.owner_name || "",
              owner_phone: data.owner_phone || "",
              owner_email: data.owner_email || "",
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
            setDistributionLocations(data.distribution_locations || [])
          }
        } catch (err) {
          console.error('Unexpected error fetching shop data:', err)
        }
      }
    }

    fetchShopData()
  }, [user?.id, supabase])

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.id) {
        try {
          // Check admin status from admins table (secure - can only be modified via service_role)
          const { data: admin } = await supabase
            .from('admins')
            .select('role, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

          setIsAdmin(Boolean(admin))
        } catch (error) {
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        }
      }
    }

    checkAdminStatus()
  }, [user?.id, supabase])

  // Fetch feature flag for "Become a Seller" button
  useEffect(() => {
    const fetchBecomSellerFlag = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_value')
          .eq('flag_name', 'enable_become_seller')
          .single()

        if (error) {
          // Silently default to true if feature_flags table doesn't exist or flag not found
          // This is expected in development or when migrations haven't been run
          setEnableBecomeSeller(true)
          return
        }

        setEnableBecomeSeller(data?.flag_value ?? true)
      } catch (err) {
        // Default to true on any error
        setEnableBecomeSeller(true)
      }
    }

    fetchBecomSellerFlag()
  }, [supabase])

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
          address: userProfile.address,
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
          registration_number: shopProfile.registration_number,
          owner_name: shopProfile.owner_name,
          owner_phone: shopProfile.owner_phone,
          owner_email: shopProfile.owner_email,
          return_policy: shopPolicies.return_policy,
          shipping_policy: shopPolicies.shipping_policy,
          payment_policy: shopPolicies.payment_policy,
          warranty_policy: shopPolicies.warranty_policy,
          privacy_policy: shopPolicies.privacy_policy,
          terms_of_service: shopPolicies.terms_of_service,
          distribution_locations: distributionLocations,
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
            .select('first_name, last_name, phone, location, address, bio, specializations, user_role, fica_status, fica_rejection_reason')
            .eq('user_id', user.id)
            .maybeSingle()

          if (!error && data) {
            setUserProfile({
              firstName: data.first_name || "",
              lastName: data.last_name || "",
              email: user.email || "",
              phone: data.phone || "",
              location: data.location || "",
              address: data.address || "",
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
        registration_number: shopData?.registration_number || "",
        owner_name: shopData?.owner_name || "",
        owner_phone: shopData?.owner_phone || "",
        owner_email: shopData?.owner_email || "",
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
      setDistributionLocations(shopData?.distribution_locations || [])
    }
    setNewSpecialization("")
    setNewDistributionLocation("")
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

  const addDistributionLocation = () => {
    if (newDistributionLocation.trim() && !distributionLocations.includes(newDistributionLocation.trim())) {
      setDistributionLocations([...distributionLocations, newDistributionLocation.trim()])
      setNewDistributionLocation("")
    }
  }

  const removeDistributionLocation = (index: number) => {
    setDistributionLocations(distributionLocations.filter((_, i) => i !== index))
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
        console.error('Error updating user role:', error)
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

  const handleSaveFicaForm = async () => {
    setIsFicaLoading(true)
    setFicaError("")
    setFicaSuccess("")

    // Validate all required personal fields
    const missingPersonalFields: string[] = []
    if (!userProfile.firstName.trim()) missingPersonalFields.push("First Name")
    if (!userProfile.lastName.trim()) missingPersonalFields.push("Last Name")
    if (!userProfile.address.trim()) missingPersonalFields.push("Address")
    if (!userProfile.phone.trim()) missingPersonalFields.push("Contact Number")

    // Validate all required business fields
    const missingBusinessFields: string[] = []
    if (!shopProfile.name.trim()) missingBusinessFields.push("Business Name")
    if (!shopProfile.registration_number.trim()) missingBusinessFields.push("Registration Number")
    if (!shopProfile.owner_name.trim()) missingBusinessFields.push("Owner Name")
    if (!shopProfile.owner_phone.trim()) missingBusinessFields.push("Owner Phone")
    if (!shopProfile.owner_email.trim()) missingBusinessFields.push("Owner Email")

    // Check for missing FICA documents
    const requiredDocTypes = ['id_document', 'proof_of_address', 'id_selfie']
    const uploadedDocTypes = ficaDocuments.map(doc => doc.document_type)
    const missingDocuments = requiredDocTypes.filter(type => !uploadedDocTypes.includes(type as any))

    const allMissingFields = [...missingPersonalFields, ...missingBusinessFields]
    
    if (allMissingFields.length > 0 || missingDocuments.length > 0) {
      let errorMessage = ""
      if (allMissingFields.length > 0) {
        errorMessage += `Please fill in the following required fields: ${allMissingFields.join(", ")}.`
      }
      if (missingDocuments.length > 0) {
        const docNames = missingDocuments.map(type => {
          switch(type) {
            case 'id_document': return 'ID Document'
            case 'proof_of_address': return 'Proof of Address'
            case 'id_selfie': return 'ID Selfie'
            default: return type
          }
        })
        if (errorMessage) errorMessage += " "
        errorMessage += `Please upload the following documents: ${docNames.join(", ")}.`
      }
      setFicaError(errorMessage)
      setIsFicaLoading(false)
      return
    }

    try {
      // Update user profile data
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user?.id,
          first_name: userProfile.firstName,
          last_name: userProfile.lastName,
          phone: userProfile.phone,
          address: userProfile.address,
        }, {
          onConflict: 'user_id'
        })

      if (profileError) {
        throw profileError
      }

      // Update shop data
      const { error: shopError } = await supabase
        .from('shops')
        .upsert({
          user_id: user?.id,
          name: shopProfile.name,
          registration_number: shopProfile.registration_number,
          owner_name: shopProfile.owner_name,
          owner_phone: shopProfile.owner_phone,
          owner_email: shopProfile.owner_email,
        }, {
          onConflict: 'user_id'
        })

      if (shopError) {
        throw shopError
      }

      setFicaSuccess("FICA information saved successfully!")
      
      // Clear success message after 3 seconds
      setTimeout(() => setFicaSuccess(""), 3000)
    } catch (err: any) {
      setFicaError(err.message || "Failed to save FICA information. Please try again.")
    } finally {
      setIsFicaLoading(false)
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
        <MainNavbar />
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      <MainNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
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
        
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your personal details, shop information and FICA status
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <Button asChild variant="secondary">
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            )}
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
          <Card className="md:col-span-1 rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
            <CardHeader className="text-center">
              <div className="relative mx-auto">
                <Avatar className="w-24 h-24 border-2 border-primary/20 shadow-sm">
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
            <Tabs defaultValue="about" className="w-full space-y-4">
              <div className="flex justify-center">
                <TabsList className="inline-flex items-center gap-3 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  <TabsTrigger
                    value="about"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
                  >
                    About
                  </TabsTrigger>
                  {userProfile.userRole === "seller" && (
                    <>
                      <TabsTrigger
                        value="shop"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
                      >
                        Shop Info
                      </TabsTrigger>
                      <TabsTrigger
                        value="fica"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
                      >
                        FICA Verification
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger
                    value="notifications"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
                  >
                    Notifications
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="about" className="space-y-4">
                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
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

                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
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

                {userProfile.userRole !== "seller" && enableBecomeSeller && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleBecomeSeller}
                      disabled={isLoading}
                      className="w-full sm:w-auto"
                    >
                      {isLoading ? "Updating..." : "Become a Seller"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {userProfile.userRole === "seller" && (
                <TabsContent value="shop" className="space-y-4">
                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
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

                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Distribution Center Locations
                    </CardTitle>
                    <CardDescription>Add locations where you can ship or deliver items from (cities or full addresses)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {distributionLocations.length > 0 ? (
                          distributionLocations.map((location, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <Badge variant="secondary" className="px-3 py-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {location}
                              </Badge>
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-red-100"
                                  onClick={() => removeDistributionLocation(index)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {isEditing ? "No distribution locations added yet" : "No distribution locations set"}
                          </p>
                        )}
                      </div>
                      
                      {isEditing && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a location (e.g., Cape Town or full address)..."
                            value={newDistributionLocation}
                            onChange={(e) => setNewDistributionLocation(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addDistributionLocation()}
                            disabled={isLoading}
                            className="flex-1"
                          />
                          <Button
                            onClick={addDistributionLocation}
                            disabled={!newDistributionLocation.trim() || isLoading}
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
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
              )}

              {userProfile.userRole === "seller" && (
                <TabsContent value="fica" className="space-y-4">
                  {/* FICA Form Alerts */}
                  {ficaError && (
                    <Alert variant="destructive">
                      <AlertDescription>{ficaError}</AlertDescription>
                    </Alert>
                  )}
                  {ficaSuccess && (
                    <Alert className="border-green-200 bg-green-50 text-green-800">
                      <AlertDescription>{ficaSuccess}</AlertDescription>
                    </Alert>
                  )}

                  {/* Personal Information Section */}
                  <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
                    <CardHeader>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>
                        Your personal details for FICA verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ficaFirstName">First Name <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaFirstName"
                            value={userProfile.firstName}
                            onChange={(e) => setUserProfile({ ...userProfile, firstName: e.target.value })}
                            placeholder="Enter your first name"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ficaLastName">Last Name <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaLastName"
                            value={userProfile.lastName}
                            onChange={(e) => setUserProfile({ ...userProfile, lastName: e.target.value })}
                            placeholder="Enter your last name"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ficaAddress">Address <span className="text-red-500">*</span></Label>
                        <Textarea
                          id="ficaAddress"
                          value={userProfile.address}
                          onChange={(e) => setUserProfile({ ...userProfile, address: e.target.value })}
                          placeholder="Enter your full address"
                          rows={2}
                          required
                          disabled={isFicaLoading}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ficaEmail">Email <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaEmail"
                            type="email"
                            value={userProfile.email}
                            readOnly
                            disabled
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ficaPhone">Contact Number <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaPhone"
                            type="tel"
                            value={userProfile.phone}
                            onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                            placeholder="Enter your phone number"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Business Information Section */}
                  <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
                    <CardHeader>
                      <CardTitle>Business Information</CardTitle>
                      <CardDescription>
                        Your business details for FICA verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ficaBusinessName">Business Name <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaBusinessName"
                            value={shopProfile.name}
                            onChange={(e) => setShopProfile({ ...shopProfile, name: e.target.value })}
                            placeholder="Enter your business name"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ficaRegistrationNumber">Registration Number <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaRegistrationNumber"
                            value={shopProfile.registration_number}
                            onChange={(e) => setShopProfile({ ...shopProfile, registration_number: e.target.value })}
                            placeholder="Enter your business registration number"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ficaOwnerName">Owner Name <span className="text-red-500">*</span></Label>
                        <Input
                          id="ficaOwnerName"
                          value={shopProfile.owner_name}
                          onChange={(e) => setShopProfile({ ...shopProfile, owner_name: e.target.value })}
                          placeholder="Enter the business owner's full name"
                          required
                          disabled={isFicaLoading}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ficaOwnerPhone">Owner Phone <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaOwnerPhone"
                            type="tel"
                            value={shopProfile.owner_phone}
                            onChange={(e) => setShopProfile({ ...shopProfile, owner_phone: e.target.value })}
                            placeholder="Enter owner's phone number"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ficaOwnerEmail">Owner Email <span className="text-red-500">*</span></Label>
                          <Input
                            id="ficaOwnerEmail"
                            type="email"
                            value={shopProfile.owner_email}
                            onChange={(e) => setShopProfile({ ...shopProfile, owner_email: e.target.value })}
                            placeholder="Enter owner's email address"
                            required
                            disabled={isFicaLoading}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* FICA Documents Section */}
                  <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
                    <CardHeader>
                      <CardTitle>FICA Documents</CardTitle>
                      <CardDescription>
                        Upload required documents to complete FICA verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FicaUpload />
                    </CardContent>
                  </Card>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveFicaForm}
                      disabled={isFicaLoading}
                      className="px-8"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isFicaLoading ? "Saving..." : "Save FICA Information"}
                    </Button>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="notifications" className="space-y-4">
                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/90 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose how you want to be notified about activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NotificationPreferences />
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}
