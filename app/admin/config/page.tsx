'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { 
  Settings, 
  Save, 
  RefreshCw,
  AlertTriangle,
  Home,
  DollarSign,
  Shield,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Edit
} from 'lucide-react'
import Link from 'next/link'

interface CategoryCommission {
  id: string
  category: string
  commission_percentage: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface EscrowSettings {
  id: string
  category: string
  escrow_required: boolean
  escrow_duration_days: number
  created_at: string
  updated_at: string
}

interface GlobalSettings {
  id: string
  setting_key: string
  setting_value: string
  setting_type: 'string' | 'number' | 'boolean' | 'json'
  description: string
  created_at: string
  updated_at: string
}

interface FeatureFlag {
  id: string
  flag_name: string
  flag_value: boolean
  description: string
  created_at: string
  updated_at: string
}

export default function AdminConfigPage() {
  const [categoryCommissions, setCategoryCommissions] = useState<CategoryCommission[]>([])
  const [escrowSettings, setEscrowSettings] = useState<EscrowSettings[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings[]>([])
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form states
  const [newCommission, setNewCommission] = useState({ category: '', percentage: 0 })
  const [newEscrow, setNewEscrow] = useState({ category: '', required: false, duration: 7 })
  const [newSetting, setNewSetting] = useState({ key: '', value: '', type: 'string', description: '' })
  const [newFlag, setNewFlag] = useState({ name: '', value: false, description: '' })
  
  // Modals
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [showEscrowModal, setShowEscrowModal] = useState(false)
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('user_role, is_admin')
          .eq('user_id', user.id)
          .single()

        if (error || !profile || !profile.is_admin) {
          router.push('/dashboard')
          return
        }

        fetchAllSettings()
      } catch (error) {
        console.error('Error checking admin status:', error)
        router.push('/dashboard')
      }
    }

    if (user) {
      checkAdminStatus()
    }
  }, [user?.id])

  const fetchAllSettings = async () => {
    try {
      setLoading(true)
      
      // Fetch all settings in parallel
      const [commissionsResult, escrowResult, settingsResult, flagsResult] = await Promise.all([
        supabase.from('category_commissions').select('*').order('category'),
        supabase.from('escrow_settings').select('*').order('category'),
        supabase.from('global_settings').select('*').order('setting_key'),
        supabase.from('feature_flags').select('*').order('flag_name')
      ])

      if (commissionsResult.error) throw commissionsResult.error
      if (escrowResult.error) throw escrowResult.error
      if (settingsResult.error) throw settingsResult.error
      if (flagsResult.error) throw flagsResult.error

      setCategoryCommissions(commissionsResult.data || [])
      setEscrowSettings(escrowResult.data || [])
      setGlobalSettings(settingsResult.data || [])
      setFeatureFlags(flagsResult.data || [])
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCommission = async () => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await supabase
        .from('category_commissions')
        .upsert({
          category: newCommission.category,
          commission_percentage: newCommission.percentage,
          is_active: true
        })

      if (error) throw error

      setNewCommission({ category: '', percentage: 0 })
      setShowCommissionModal(false)
      setSuccess('Commission setting saved successfully')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error saving commission:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEscrow = async () => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await supabase
        .from('escrow_settings')
        .upsert({
          category: newEscrow.category,
          escrow_required: newEscrow.required,
          escrow_duration_days: newEscrow.duration
        })

      if (error) throw error

      setNewEscrow({ category: '', required: false, duration: 7 })
      setShowEscrowModal(false)
      setSuccess('Escrow setting saved successfully')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error saving escrow setting:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSetting = async () => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await supabase
        .from('global_settings')
        .upsert({
          setting_key: newSetting.key,
          setting_value: newSetting.value,
          setting_type: newSetting.type,
          description: newSetting.description
        })

      if (error) throw error

      setNewSetting({ key: '', value: '', type: 'string', description: '' })
      setShowSettingModal(false)
      setSuccess('Global setting saved successfully')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error saving setting:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFlag = async () => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          flag_name: newFlag.name,
          flag_value: newFlag.value,
          description: newFlag.description
        })

      if (error) throw error

      setNewFlag({ name: '', value: false, description: '' })
      setShowFlagModal(false)
      setSuccess('Feature flag saved successfully')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error saving feature flag:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCommission = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('category_commissions')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) throw error
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error toggling commission:', err)
      setError(err.message)
    }
  }

  const handleToggleEscrow = async (id: string, required: boolean) => {
    try {
      const { error } = await supabase
        .from('escrow_settings')
        .update({ escrow_required: !required })
        .eq('id', id)

      if (error) throw error
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error toggling escrow:', err)
      setError(err.message)
    }
  }

  const handleToggleFlag = async (id: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ flag_value: !value })
        .eq('id', id)

      if (error) throw error
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error toggling feature flag:', err)
      setError(err.message)
    }
  }

  const handleDeleteCommission = async (id: string) => {
    try {
      const { error } = await supabase
        .from('category_commissions')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error deleting commission:', err)
      setError(err.message)
    }
  }

  const categories = [
    'mobile_phones',
    'phone_parts', 
    'phone_accessories',
    'laptops',
    'steam_kits',
    'other_electronics'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Configuration</h1>
          <p className="text-muted-foreground">
            Manage platform settings, commissions, escrow, and feature flags
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/admin">
              <Home className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
          <Button onClick={fetchAllSettings} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Category Commissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Category Commissions
              </CardTitle>
              <CardDescription>Set commission percentages for different categories</CardDescription>
            </div>
            <Button onClick={() => setShowCommissionModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Commission
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryCommissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell className="font-medium">{commission.category}</TableCell>
                  <TableCell>{commission.commission_percentage}%</TableCell>
                  <TableCell>
                    <Badge variant={commission.is_active ? 'default' : 'secondary'}>
                      {commission.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={commission.is_active}
                        onCheckedChange={() => handleToggleCommission(commission.id, commission.is_active)}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteCommission(commission.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Escrow Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Escrow Settings
              </CardTitle>
              <CardDescription>Configure escrow requirements by category</CardDescription>
            </div>
            <Button onClick={() => setShowEscrowModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Escrow Setting
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Escrow Required</TableHead>
                <TableHead>Duration (days)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escrowSettings.map((escrow) => (
                <TableRow key={escrow.id}>
                  <TableCell className="font-medium">{escrow.category}</TableCell>
                  <TableCell>
                    <Badge variant={escrow.escrow_required ? 'default' : 'secondary'}>
                      {escrow.escrow_required ? 'Required' : 'Optional'}
                    </Badge>
                  </TableCell>
                  <TableCell>{escrow.escrow_duration_days} days</TableCell>
                  <TableCell>
                    <Switch
                      checked={escrow.escrow_required}
                      onCheckedChange={() => handleToggleEscrow(escrow.id, escrow.escrow_required)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Global Settings
              </CardTitle>
              <CardDescription>Platform-wide configuration settings</CardDescription>
            </div>
            <Button onClick={() => setShowSettingModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Setting
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setting Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {globalSettings.map((setting) => (
                <TableRow key={setting.id}>
                  <TableCell className="font-medium">{setting.setting_key}</TableCell>
                  <TableCell>{setting.setting_value}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{setting.setting_type}</Badge>
                  </TableCell>
                  <TableCell>{setting.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <ToggleRight className="mr-2 h-5 w-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </div>
            <Button onClick={() => setShowFlagModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Feature Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureFlags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium">{flag.flag_name}</TableCell>
                  <TableCell>
                    <Badge variant={flag.flag_value ? 'default' : 'secondary'}>
                      {flag.flag_value ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>{flag.description}</TableCell>
                  <TableCell>
                    <Switch
                      checked={flag.flag_value}
                      onCheckedChange={() => handleToggleFlag(flag.id, flag.flag_value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Commission Modal */}
      <Dialog open={showCommissionModal} onOpenChange={setShowCommissionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category Commission</DialogTitle>
            <DialogDescription>Set commission percentage for a category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={newCommission.category} onValueChange={(value) => setNewCommission(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="percentage">Commission Percentage</Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newCommission.percentage}
                onChange={(e) => setNewCommission(prev => ({ ...prev, percentage: parseFloat(e.target.value) }))}
                placeholder="5.0"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCommissionModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCommission} disabled={saving || !newCommission.category || newCommission.percentage <= 0}>
                {saving ? 'Saving...' : 'Save Commission'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Escrow Modal */}
      <Dialog open={showEscrowModal} onOpenChange={setShowEscrowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Escrow Setting</DialogTitle>
            <DialogDescription>Configure escrow requirements for a category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="escrow-category">Category</Label>
              <Select value={newEscrow.category} onValueChange={(value) => setNewEscrow(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newEscrow.required}
                onCheckedChange={(checked) => setNewEscrow(prev => ({ ...prev, required: checked }))}
              />
              <Label>Escrow Required</Label>
            </div>
            <div>
              <Label htmlFor="duration">Escrow Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="30"
                value={newEscrow.duration}
                onChange={(e) => setNewEscrow(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                placeholder="7"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEscrowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEscrow} disabled={saving || !newEscrow.category}>
                {saving ? 'Saving...' : 'Save Escrow Setting'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Setting Modal */}
      <Dialog open={showSettingModal} onOpenChange={setShowSettingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Global Setting</DialogTitle>
            <DialogDescription>Add a new platform-wide setting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting-key">Setting Key</Label>
              <Input
                id="setting-key"
                value={newSetting.key}
                onChange={(e) => setNewSetting(prev => ({ ...prev, key: e.target.value }))}
                placeholder="moq_floor_screens"
              />
            </div>
            <div>
              <Label htmlFor="setting-value">Value</Label>
              <Input
                id="setting-value"
                value={newSetting.value}
                onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                placeholder="10"
              />
            </div>
            <div>
              <Label htmlFor="setting-type">Type</Label>
              <Select value={newSetting.type} onValueChange={(value) => setNewSetting(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="setting-description">Description</Label>
              <Textarea
                id="setting-description"
                value={newSetting.description}
                onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Minimum order quantity floor for screen parts"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSettingModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSetting} disabled={saving || !newSetting.key || !newSetting.value}>
                {saving ? 'Saving...' : 'Save Setting'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flag Modal */}
      <Dialog open={showFlagModal} onOpenChange={setShowFlagModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Feature Flag</DialogTitle>
            <DialogDescription>Add a new feature flag to control platform functionality</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flag-name">Flag Name</Label>
              <Input
                id="flag-name"
                value={newFlag.name}
                onChange={(e) => setNewFlag(prev => ({ ...prev, name: e.target.value }))}
                placeholder="enable_chat_feature"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newFlag.value}
                onCheckedChange={(checked) => setNewFlag(prev => ({ ...prev, value: checked }))}
              />
              <Label>Enabled by default</Label>
            </div>
            <div>
              <Label htmlFor="flag-description">Description</Label>
              <Textarea
                id="flag-description"
                value={newFlag.description}
                onChange={(e) => setNewFlag(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enable real-time chat between buyers and sellers"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFlagModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFlag} disabled={saving || !newFlag.name}>
                {saving ? 'Saving...' : 'Save Feature Flag'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
