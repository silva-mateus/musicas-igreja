'use client'

import { ArrowDown, RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshIndicatorProps {
  isPulling: boolean
  canRefresh: boolean
  isRefreshing: boolean
  pullDistance: number
  style?: React.CSSProperties
  className?: string
}

export function PullToRefreshIndicator({
  isPulling,
  canRefresh,
  isRefreshing,
  pullDistance,
  style,
  className
}: PullToRefreshIndicatorProps) {
  if (!isPulling && !isRefreshing) return null

  const opacity = Math.min(pullDistance / 60, 1)
  const iconRotation = (pullDistance / 80) * 180

  return (
    <div 
      className={cn(
        "flex items-center justify-center py-4 transition-opacity duration-150",
        className
      )}
      style={{ 
        opacity,
        ...style 
      }}
    >
      <div className="flex flex-col items-center gap-2">
        {isRefreshing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Atualizando...</span>
          </>
        ) : canRefresh ? (
          <>
            <RotateCcw className="h-5 w-5 text-primary" />
            <span className="text-xs text-primary font-medium">Solte para atualizar</span>
          </>
        ) : (
          <>
            <ArrowDown 
              className="h-5 w-5 text-muted-foreground transition-transform duration-200" 
              style={{ 
                transform: `rotate(${iconRotation}deg)` 
              }}
            />
            <span className="text-xs text-muted-foreground">Puxe para atualizar</span>
          </>
        )}
      </div>
    </div>
  )
}