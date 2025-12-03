'use client'

import { useState, useEffect } from 'react'
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
import { 
  Settings, 
  RefreshCw,
  DollarSign,
  Shield,
  ToggleRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Search,
  Percent,
  Save
} from 'lucide-react'

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

export default function AdminSettingsPage() {
  const [categoryCommissions, setCategoryCommissions] = useState<CategoryCommission[]>([])
  const [escrowSettings, setEscrowSettings] = useState<EscrowSettings[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings[]>([])
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
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
  
  // Fee settings state
  const [feeSettings, setFeeSettings] = useState({
    vatPercentage: '15',
    payfastFeePercentage: '3.4',
    enableVatFees: true,
    enablePayfastFees: true
  })
  const [savingFees, setSavingFees] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchAllSettings()
  }, [])

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  const fetchAllSettings = async () => {
    try {
      setLoading(true)
      
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
      
      // Populate fee settings from fetched data
      const vatSetting = settingsResult.data?.find(s => s.setting_key === 'vat_percentage')
      const payfastSetting = settingsResult.data?.find(s => s.setting_key === 'payfast_fee_percentage')
      const vatFlag = flagsResult.data?.find(f => f.flag_name === 'enable_vat_fees')
      const payfastFlag = flagsResult.data?.find(f => f.flag_name === 'enable_payfast_fees')
      
      setFeeSettings({
        vatPercentage: vatSetting?.setting_value || '15',
        payfastFeePercentage: payfastSetting?.setting_value || '3.4',
        enableVatFees: vatFlag?.flag_value ?? true,
        enablePayfastFees: payfastFlag?.flag_value ?? true
      })
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
      setSuccess('Commission deleted')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error deleting commission:', err)
      setError(err.message)
    }
  }

  const handleSaveFeeSettings = async () => {
    try {
      setSavingFees(true)
      setError(null)

      // Update VAT percentage in global_settings
      const { error: vatError } = await supabase
        .from('global_settings')
        .upsert({
          setting_key: 'vat_percentage',
          setting_value: feeSettings.vatPercentage,
          setting_type: 'number',
          description: 'VAT percentage applied to listings'
        }, { onConflict: 'setting_key' })

      if (vatError) throw vatError

      // Update Payfast fee percentage in global_settings
      const { error: payfastError } = await supabase
        .from('global_settings')
        .upsert({
          setting_key: 'payfast_fee_percentage',
          setting_value: feeSettings.payfastFeePercentage,
          setting_type: 'number',
          description: 'Payfast transaction fee percentage'
        }, { onConflict: 'setting_key' })

      if (payfastError) throw payfastError

      // Update VAT feature flag
      const { error: vatFlagError } = await supabase
        .from('feature_flags')
        .upsert({
          flag_name: 'enable_vat_fees',
          flag_value: feeSettings.enableVatFees,
          description: 'Enable VAT fee calculation on listings'
        }, { onConflict: 'flag_name' })

      if (vatFlagError) throw vatFlagError

      // Update Payfast feature flag
      const { error: payfastFlagError } = await supabase
        .from('feature_flags')
        .upsert({
          flag_name: 'enable_payfast_fees',
          flag_value: feeSettings.enablePayfastFees,
          description: 'Enable Payfast fee calculation on listings'
        }, { onConflict: 'flag_name' })

      if (payfastFlagError) throw payfastFlagError

      setSuccess('Fee settings saved successfully')
      fetchAllSettings()
    } catch (err: any) {
      console.error('Error saving fee settings:', err)
      setError(err.message)
    } finally {
      setSavingFees(false)
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

  const filteredSettings = globalSettings.filter(s => 
    s.setting_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredFlags = featureFlags.filter(f =>
    f.flag_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Configure platform settings, commissions, and features</p>
        </div>
        <Button onClick={fetchAllSettings} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search settings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Commissions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Category Commissions
              </CardTitle>
              <CardDescription className="text-slate-400">Set commission percentages for different categories</CardDescription>
            </div>
            <Button onClick={() => setShowCommissionModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Commission
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Commission %</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryCommissions.map((commission) => (
                <TableRow key={commission.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-white capitalize">{commission.category.replace('_', ' ')}</TableCell>
                  <TableCell className="text-emerald-400 font-semibold">{commission.commission_percentage}%</TableCell>
                  <TableCell>
                    <Badge className={commission.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
                      {commission.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={commission.is_active}
                        onCheckedChange={() => handleToggleCommission(commission.id, commission.is_active)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCommission(commission.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

      {/* Fee Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Percent className="h-5 w-5 text-orange-500" />
                Fee Settings
              </CardTitle>
              <CardDescription className="text-slate-400">Configure VAT and Payfast transaction fees</CardDescription>
            </div>
            <Button 
              onClick={handleSaveFeeSettings} 
              disabled={savingFees}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingFees ? 'Saving...' : 'Save Fees'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VAT Settings */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium">VAT Fee</h3>
                  <p className="text-sm text-slate-400">Value Added Tax percentage</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={feeSettings.enableVatFees}
                    onCheckedChange={(checked) => setFeeSettings(prev => ({ ...prev, enableVatFees: checked }))}
                  />
                  <Badge className={feeSettings.enableVatFees ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
                    {feeSettings.enableVatFees ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feeSettings.vatPercentage}
                  onChange={(e) => setFeeSettings(prev => ({ ...prev, vatPercentage: e.target.value }))}
                  disabled={!feeSettings.enableVatFees}
                  className="bg-slate-800 border-slate-700 text-white disabled:opacity-50"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>

            {/* Payfast Settings */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium">Payfast Fee</h3>
                  <p className="text-sm text-slate-400">Payment gateway transaction fee</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={feeSettings.enablePayfastFees}
                    onCheckedChange={(checked) => setFeeSettings(prev => ({ ...prev, enablePayfastFees: checked }))}
                  />
                  <Badge className={feeSettings.enablePayfastFees ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
                    {feeSettings.enablePayfastFees ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feeSettings.payfastFeePercentage}
                  onChange={(e) => setFeeSettings(prev => ({ ...prev, payfastFeePercentage: e.target.value }))}
                  disabled={!feeSettings.enablePayfastFees}
                  className="bg-slate-800 border-slate-700 text-white disabled:opacity-50"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Fee Calculation Preview */}
          <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <h4 className="text-slate-300 font-medium mb-2">Fee Calculation Preview</h4>
            <p className="text-sm text-slate-400">
              For a listing price of <span className="text-emerald-400 font-semibold">R2,000</span>, 
              with total fees of{' '}
              <span className="text-orange-400 font-semibold">
                {(
                  (feeSettings.enableVatFees ? parseFloat(feeSettings.vatPercentage) || 0 : 0) +
                  (feeSettings.enablePayfastFees ? parseFloat(feeSettings.payfastFeePercentage) || 0 : 0)
                ).toFixed(1)}%
              </span>
              {' '}(VAT + Payfast, excluding category commission):
            </p>
            <p className="text-white mt-2">
              Seller Receives = R2,000 - ({(
                (feeSettings.enableVatFees ? parseFloat(feeSettings.vatPercentage) || 0 : 0) +
                (feeSettings.enablePayfastFees ? parseFloat(feeSettings.payfastFeePercentage) || 0 : 0)
              ).toFixed(1)}% fees) ={' '}
              <span className="text-emerald-400 font-bold">
                R{(2000 * (1 - (
                  (feeSettings.enableVatFees ? parseFloat(feeSettings.vatPercentage) || 0 : 0) +
                  (feeSettings.enablePayfastFees ? parseFloat(feeSettings.payfastFeePercentage) || 0 : 0)
                ) / 100)).toFixed(2)}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Escrow Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Escrow Settings
              </CardTitle>
              <CardDescription className="text-slate-400">Configure escrow requirements by category</CardDescription>
            </div>
            <Button onClick={() => setShowEscrowModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Escrow Setting
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Escrow Required</TableHead>
                <TableHead className="text-slate-400">Duration (days)</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escrowSettings.map((escrow) => (
                <TableRow key={escrow.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-white capitalize">{escrow.category.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge className={escrow.escrow_required ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
                      {escrow.escrow_required ? 'Required' : 'Optional'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">{escrow.escrow_duration_days} days</TableCell>
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
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-500" />
                Global Settings
              </CardTitle>
              <CardDescription className="text-slate-400">Platform-wide configuration settings</CardDescription>
            </div>
            <Button onClick={() => setShowSettingModal(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Setting
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Setting Key</TableHead>
                <TableHead className="text-slate-400">Value</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSettings.map((setting) => (
                <TableRow key={setting.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-white font-mono text-sm">{setting.setting_key}</TableCell>
                  <TableCell className="text-emerald-400">{setting.setting_value}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">{setting.setting_type}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm max-w-xs truncate">{setting.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <ToggleRight className="h-5 w-5 text-yellow-500" />
                Feature Flags
              </CardTitle>
              <CardDescription className="text-slate-400">Enable or disable platform features</CardDescription>
            </div>
            <Button onClick={() => setShowFlagModal(true)} className="bg-yellow-600 hover:bg-yellow-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Feature Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Flag Name</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Description</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags.map((flag) => (
                <TableRow key={flag.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-white font-mono text-sm">{flag.flag_name}</TableCell>
                  <TableCell>
                    <Badge className={flag.flag_value ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                      {flag.flag_value ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm max-w-xs truncate">{flag.description}</TableCell>
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
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Category Commission</DialogTitle>
            <DialogDescription className="text-slate-400">Set commission percentage for a category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category" className="text-slate-400">Category</Label>
              <Select value={newCommission.category} onValueChange={(value) => setNewCommission(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="percentage" className="text-slate-400">Commission Percentage</Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newCommission.percentage}
                onChange={(e) => setNewCommission(prev => ({ ...prev, percentage: parseFloat(e.target.value) }))}
                placeholder="5.0"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCommissionModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSaveCommission} disabled={saving || !newCommission.category || newCommission.percentage <= 0} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Saving...' : 'Save Commission'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Escrow Modal */}
      <Dialog open={showEscrowModal} onOpenChange={setShowEscrowModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Escrow Setting</DialogTitle>
            <DialogDescription className="text-slate-400">Configure escrow requirements for a category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="escrow-category" className="text-slate-400">Category</Label>
              <Select value={newEscrow.category} onValueChange={(value) => setNewEscrow(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newEscrow.required}
                onCheckedChange={(checked) => setNewEscrow(prev => ({ ...prev, required: checked }))}
              />
              <Label className="text-slate-400">Escrow Required</Label>
            </div>
            <div>
              <Label htmlFor="duration" className="text-slate-400">Escrow Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="30"
                value={newEscrow.duration}
                onChange={(e) => setNewEscrow(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                placeholder="7"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEscrowModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSaveEscrow} disabled={saving || !newEscrow.category} className="bg-blue-600 hover:bg-blue-700">
                {saving ? 'Saving...' : 'Save Escrow Setting'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Setting Modal */}
      <Dialog open={showSettingModal} onOpenChange={setShowSettingModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Global Setting</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new platform-wide setting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting-key" className="text-slate-400">Setting Key</Label>
              <Input
                id="setting-key"
                value={newSetting.key}
                onChange={(e) => setNewSetting(prev => ({ ...prev, key: e.target.value }))}
                placeholder="moq_floor_screens"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="setting-value" className="text-slate-400">Value</Label>
              <Input
                id="setting-value"
                value={newSetting.value}
                onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                placeholder="10"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="setting-type" className="text-slate-400">Type</Label>
              <Select value={newSetting.type} onValueChange={(value) => setNewSetting(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="setting-description" className="text-slate-400">Description</Label>
              <Textarea
                id="setting-description"
                value={newSetting.description}
                onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Minimum order quantity floor for screen parts"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettingModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSaveSetting} disabled={saving || !newSetting.key || !newSetting.value} className="bg-purple-600 hover:bg-purple-700">
                {saving ? 'Saving...' : 'Save Setting'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flag Modal */}
      <Dialog open={showFlagModal} onOpenChange={setShowFlagModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Feature Flag</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new feature flag to control platform functionality</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flag-name" className="text-slate-400">Flag Name</Label>
              <Input
                id="flag-name"
                value={newFlag.name}
                onChange={(e) => setNewFlag(prev => ({ ...prev, name: e.target.value }))}
                placeholder="enable_chat_feature"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newFlag.value}
                onCheckedChange={(checked) => setNewFlag(prev => ({ ...prev, value: checked }))}
              />
              <Label className="text-slate-400">Enabled by default</Label>
            </div>
            <div>
              <Label htmlFor="flag-description" className="text-slate-400">Description</Label>
              <Textarea
                id="flag-description"
                value={newFlag.description}
                onChange={(e) => setNewFlag(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enable real-time chat between buyers and sellers"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFlagModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSaveFlag} disabled={saving || !newFlag.name} className="bg-yellow-600 hover:bg-yellow-700">
                {saving ? 'Saving...' : 'Save Feature Flag'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

