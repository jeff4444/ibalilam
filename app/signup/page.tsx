"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cpu, Eye, EyeOff, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { MainNavbar } from '@/components/navbar'

// VULN-019 FIX: Strong password validation requirements
interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 12 characters", test: (p) => p.length >= 12 },
  { label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%^&*)", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

const COMMON_PATTERNS = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon']

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  })
  const [emailError, setEmailError] = useState("")
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      console.log('user already logged in redirecting to dashboard', user)
      router.push("/dashboard")
    }
  }, [user, router])

  // VULN-019 FIX: Calculate password strength and requirements
  const passwordAnalysis = useMemo(() => {
    const password = formData.password
    const metRequirements = PASSWORD_REQUIREMENTS.filter(req => req.test(password))
    const hasCommonPattern = COMMON_PATTERNS.some(p => password.toLowerCase().includes(p))
    const strength = Math.min(100, (metRequirements.length / PASSWORD_REQUIREMENTS.length) * 100)
    
    return {
      metRequirements,
      allMet: metRequirements.length === PASSWORD_REQUIREMENTS.length && !hasCommonPattern,
      hasCommonPattern,
      strength,
      strengthLabel: strength < 40 ? 'Weak' : strength < 80 ? 'Medium' : 'Strong',
      strengthColor: strength < 40 ? 'bg-red-500' : strength < 80 ? 'bg-yellow-500' : 'bg-green-500',
    }
  }, [formData.password])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) setError("")
    
    // Real-time email validation
    if (field === "email" && typeof value === "string") {
      if (value.trim() && !validateEmail(value)) {
        setEmailError("Please enter a valid email address")
      } else {
        setEmailError("")
      }
    }
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // VULN-019 FIX: Strong password validation
  const validatePassword = (password: string): string => {
    if (password.length < 12) {
      return "Password must be at least 12 characters long"
    }
    if (password.length > 128) {
      return "Password must be less than 128 characters"
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number"
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
    }
    // Check for common patterns
    if (COMMON_PATTERNS.some(p => password.toLowerCase().includes(p))) {
      return "Password contains a common pattern. Please choose a stronger password."
    }
    return ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Validation
    if (!formData.firstName.trim()) {
      setError("First name is required")
      setIsLoading(false)
      return
    }

    if (!formData.lastName.trim()) {
      setError("Last name is required")
      setIsLoading(false)
      return
    }

    if (!formData.email.trim()) {
      setError("Email is required")
      setIsLoading(false)
      return
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      setIsLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (!formData.agreeToTerms) {
      setError("Please agree to the terms and conditions")
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        console.log("User created successfully:", data.user)
        
        // Check if user already exists - Supabase returns a user with empty identities array
        // when trying to sign up with an existing email (for security/anti-enumeration)
        if (data.user.identities && data.user.identities.length === 0) {
          console.log("User already exists (empty identities)")
          setError("An account with this email already exists. Please sign in instead.")
          return
        }
        
        // Create user profile since database triggers may not be set up
        try {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: data.user.id,
              first_name: formData.firstName,
              last_name: formData.lastName,
              full_name: `${formData.firstName} ${formData.lastName}`.trim(),
              user_role: 'visitor',
            }, {
              onConflict: 'user_id'
            })
          
          if (profileError) {
            console.error("Error creating user profile:", profileError)
            // Don't fail signup if profile creation fails - it can be created later
          }
        } catch (profileErr) {
          console.error("Unexpected error creating profile:", profileErr)
        }
        
        // Check if email confirmation is required
        if (data.user.email_confirmed_at) {
          console.log("Email already confirmed, redirecting to dashboard")
          router.push("/dashboard")
        } else {
          console.log("Email confirmation required")
          setError("Account created! Please check your email for a confirmation link before signing in.")
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Cpu className="h-8 w-8 mr-2" />
            <span className="text-2xl font-bold">Techafon</span>
          </div>
          <CardTitle className="text-2xl text-center">Create your account</CardTitle>
          <CardDescription className="text-center">Join the electronics marketplace community</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  autoComplete="given-name"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  autoComplete="family-name"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                autoComplete="email"
                required
                disabled={isLoading}
                className={emailError ? "border-red-500" : ""}
              />
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {/* VULN-019 FIX: Password strength indicator */}
              {formData.password && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Progress value={passwordAnalysis.strength} className="h-2 flex-1" />
                    <span className={`text-xs font-medium ${
                      passwordAnalysis.strength < 40 ? 'text-red-500' : 
                      passwordAnalysis.strength < 80 ? 'text-yellow-600' : 'text-green-500'
                    }`}>
                      {passwordAnalysis.strengthLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {PASSWORD_REQUIREMENTS.map((req, index) => {
                      const isMet = req.test(formData.password)
                      return (
                        <div key={index} className={`flex items-center gap-1 ${isMet ? 'text-green-600' : 'text-gray-500'}`}>
                          {isMet ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>{req.label}</span>
                        </div>
                      )
                    })}
                    {passwordAnalysis.hasCommonPattern && (
                      <div className="flex items-center gap-1 text-red-500">
                        <X className="h-3 w-3" />
                        <span>Avoid common patterns</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                autoComplete="new-password"
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                disabled={isLoading}
              />
              <Label htmlFor="terms" className="text-sm">
                I agree to the{" "}
                <Link href="#" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
            <p className="text-sm text-center text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  )
}
