'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AdminCheckPage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingAdmin, setSettingAdmin] = useState(false)
  
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user) {
        setError('No user found')
        setLoading(false)
        return
      }

      try {
        console.log('Checking profile for user:', user.id)
        
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        console.log('Profile data:', profile)
        console.log('Profile error:', profileError)

        if (profileError) {
          setError(`Profile error: ${profileError.message}`)
        } else {
          setUserProfile(profile)
        }
      } catch (err: any) {
        console.error('Error:', err)
        setError(`Unexpected error: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    checkUserProfile()
  }, [user, supabase])

  const setAsAdmin = async () => {
    if (!user) return

    try {
      setSettingAdmin(true)
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ user_role: 'admin' })
        .eq('user_id', user.id)

      if (error) {
        console.error('Error setting admin:', error)
        setError(`Failed to set admin: ${error.message}`)
      } else {
        console.log('Successfully set as admin')
        // Refresh the profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setUserProfile(profile)
      }
    } catch (err: any) {
      console.error('Error setting admin:', err)
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setSettingAdmin(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading user profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Status Check</h1>
        <p className="text-muted-foreground">
          Debug page to check and set admin status
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>Current user and profile data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>User ID:</strong> {user?.id || 'Not found'}
          </div>
          <div>
            <strong>Email:</strong> {user?.email || 'Not found'}
          </div>
          <div>
            <strong>Profile exists:</strong> {userProfile ? 'Yes' : 'No'}
          </div>
          
          {userProfile && (
            <div className="space-y-2">
              <div><strong>First Name:</strong> {userProfile.first_name || 'Not set'}</div>
              <div><strong>Last Name:</strong> {userProfile.last_name || 'Not set'}</div>
              <div><strong>User Role:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  userProfile.user_role === 'admin' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {userProfile.user_role || 'Not set'}
                </span>
              </div>
              <div><strong>FICA Status:</strong> {userProfile.fica_status || 'Not set'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
          <CardDescription>Set user as admin for testing</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={setAsAdmin}
            disabled={settingAdmin || userProfile?.user_role === 'admin'}
            className="w-full"
          >
            {settingAdmin ? 'Setting...' : 'Set as Admin'}
          </Button>
          
          {userProfile?.user_role === 'admin' && (
            <Alert className="mt-4">
              <AlertDescription>
                ✅ You are already an admin! You should be able to access /admin now.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="outline" className="w-full">
            <a href="/admin">Go to Admin Dashboard</a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="/dashboard">Go to User Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
