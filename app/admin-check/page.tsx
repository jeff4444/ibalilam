'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AdminCheckPage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [adminRecord, setAdminRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
        
        // Fetch user profile
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

        // Check admin status from admins table (secure - can only be modified via service_role)
        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        console.log('Admin data:', admin)
        console.log('Admin error:', adminError)

        if (!adminError) {
          setAdminRecord(admin)
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

  const isAdmin = Boolean(adminRecord)

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
          Debug page to check admin status (admin management requires database access)
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
              <div>
                <strong>User Role:</strong> 
                <span className="ml-2 px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                  {userProfile.user_role || 'Not set'}
                </span>
              </div>
              <div>
                <strong>Admin Access:</strong>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  isAdmin
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {isAdmin ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {adminRecord && (
                <div>
                  <strong>Admin Role:</strong>
                  <span className="ml-2 px-2 py-1 rounded text-sm bg-purple-100 text-purple-800">
                    {adminRecord.role}
                  </span>
                </div>
              )}
              <div><strong>FICA Status:</strong> {userProfile.fica_status || 'Not set'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Management</CardTitle>
          <CardDescription>
            Admin status is now managed in a separate secure table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <p className="mb-2">
                <strong>Security Note:</strong> Admin status can only be modified via direct database access 
                using the service role. This prevents privilege escalation attacks.
              </p>
              <p className="text-sm text-muted-foreground">
                To add an admin, run the SQL script in <code>scripts/make_user_admin.sql</code> 
                with your database credentials.
              </p>
            </AlertDescription>
          </Alert>
          
          {isAdmin && (
            <Alert className="mt-4">
              <AlertDescription>
                ✅ You are an admin ({adminRecord.role})! You should be able to access /admin now.
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
