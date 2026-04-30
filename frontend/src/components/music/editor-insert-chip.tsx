'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { hapticFeedback } from '@/lib/haptic-feedback'

export type EditorInsertChipVariant = 'chord' | 'degree' | 'section'

export interface EditorInsertChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Grau romano ou número exibido à esquerda (apenas variant `degree`) */
  degreeLabel?: string
  variant?: EditorInsertChipVariant
}

/**
 * Chip de inserção no editor de cifra: largura automática, altura mínima para toque,
 * estilos unificados entre acordes, graus diatônicos e seções.
 */
export function EditorInsertChip({
  variant = 'chord',
  degreeLabel,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: EditorInsertChipProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    hapticFeedback('light')
    onClick?.(e)
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      className={cn(
        'inline-flex min-h-10 min-w-0 shrink-0 items-center justify-center gap-1 rounded-md border px-2.5 py-1 transition-colors md:min-h-9',
        'border-border bg-card text-foreground',
        'hover:bg-muted/90 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'active:bg-muted',
        variant === 'chord' && 'font-mono text-xs font-semibold',
        variant === 'degree' && 'font-mono text-xs',
        variant === 'section' &&
          'bg-muted/50 font-sans text-xs font-medium hover:bg-muted',
        className
      )}
      {...props}
    >
      {variant === 'degree' && degreeLabel != null ? (
        <>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{degreeLabel}</span>
          <span className="font-semibold">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
