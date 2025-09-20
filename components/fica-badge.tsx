'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

interface FicaBadgeProps {
  status: 'pending' | 'verified' | 'rejected' | null
  rejectionReason?: string
  variant?: 'default' | 'compact'
  showTooltip?: boolean
}

export function FicaBadge({ 
  status, 
  rejectionReason, 
  variant = 'default',
  showTooltip = true 
}: FicaBadgeProps) {
  const getBadgeContent = () => {
    switch (status) {
      case 'verified':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'FICA Verified',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white',
        }
      case 'rejected':
        return {
          icon: <XCircle className="h-3 w-3" />,
          text: 'FICA Rejected',
          variant: 'destructive' as const,
          className: '',
        }
      case 'pending':
        return {
          icon: <Clock className="h-3 w-3" />,
          text: 'FICA Pending',
          variant: 'secondary' as const,
          className: '',
        }
      default:
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'FICA Required',
          variant: 'outline' as const,
          className: '',
        }
    }
  }

  const badgeContent = getBadgeContent()

  const badge = (
    <Badge 
      variant={badgeContent.variant}
      className={`${badgeContent.className} ${variant === 'compact' ? 'text-xs px-2 py-1' : ''}`}
    >
      {badgeContent.icon}
      {variant === 'default' && <span className="ml-1">{badgeContent.text}</span>}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  const getTooltipContent = () => {
    switch (status) {
      case 'verified':
        return 'This seller has completed FICA verification and is eligible to publish listings and receive loans.'
      case 'rejected':
        return `FICA verification was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : 'Please contact support for more information.'}`
      case 'pending':
        return 'FICA documents are under review. This seller cannot publish listings until verification is complete.'
      default:
        return 'FICA verification is required to become a seller and access loan features.'
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for use in lists and cards
export function FicaBadgeCompact(props: Omit<FicaBadgeProps, 'variant'>) {
  return <FicaBadge {...props} variant="compact" />
}

// Status indicator for profile pages
export function FicaStatusIndicator({ 
  status, 
  rejectionReason 
}: Pick<FicaBadgeProps, 'status' | 'rejectionReason'>) {
  return (
    <div className="flex items-center gap-2">
      <FicaBadge status={status} rejectionReason={rejectionReason} />
      {status === 'rejected' && rejectionReason && (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-red-600">Rejection Reason:</p>
          <p>{rejectionReason}</p>
        </div>
      )}
    </div>
  )
}
