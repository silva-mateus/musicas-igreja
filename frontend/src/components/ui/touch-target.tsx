'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { hapticFeedback } from '@/lib/haptic-feedback'

export interface TouchTargetProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Tamanho do touch target
     * - sm: 40×40px mobile, 32×32px desktop  
     * - default: 44×44px mobile, 28×28px desktop
     * - lg: 48×48px mobile, 36×36px desktop
     */
    size?: 'sm' | 'default' | 'lg'
    
    /**
     * Variante visual
     * - button: aparência de botão com background
     * - icon: apenas ícone com hover sutil  
     * - ghost: transparente com hover
     */
    variant?: 'button' | 'icon' | 'ghost'
    
    /**
     * Se deve aplicar border-radius circular
     */
    rounded?: boolean
    
    /**
     * Elemento filho (geralmente ícone)
     */
    children: React.ReactNode
    
    /**
     * Classes adicionais
     */
    className?: string
}

export const TouchTarget = React.forwardRef<HTMLButtonElement, TouchTargetProps>(
    ({ 
        size = 'default', 
        variant = 'icon', 
        rounded = true,
        className,
        children,
        onClick,
        ...props 
    }, ref) => {
        
        // Enhanced onClick with haptic feedback
        const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
            // Provide haptic feedback on touch devices
            hapticFeedback('light')
            
            // Call original onClick if provided
            onClick?.(e)
        }, [onClick])
        
        const sizeClasses = {
            sm: 'h-10 w-10 md:h-8 md:w-8',      // 40px mobile, 32px desktop
            default: 'h-11 w-11 md:h-7 md:w-7', // 44px mobile, 28px desktop  
            lg: 'h-12 w-12 md:h-9 md:w-9'       // 48px mobile, 36px desktop
        }

        const variantClasses = {
            button: 'bg-secondary border border-border hover:bg-accent',
            icon: 'hover:bg-muted/70',
            ghost: 'hover:bg-muted transition-colors'
        }

        return (
            <button
                ref={ref}
                className={cn(
                    // Base classes
                    'inline-flex items-center justify-center shrink-0 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                    
                    // Size
                    sizeClasses[size],
                    
                    // Variant
                    variantClasses[variant],
                    
                    // Border radius
                    rounded ? 'rounded-full' : 'rounded-md',
                    
                    // Custom classes
                    className
                )}
                onClick={handleClick}
                {...props}
            >
                {children}
            </button>
        )
    }
)

TouchTarget.displayName = 'TouchTarget'

/**
 * Wrapper para ícones que garante tamanho apropriado
 */
export interface TouchIconProps {
    size?: 'sm' | 'default' | 'lg'
    children: React.ReactNode
    className?: string
}

export function TouchIcon({ size = 'default', children, className }: TouchIconProps) {
    const iconSizes = {
        sm: 'h-4 w-4',      // 16px
        default: 'h-4 w-4', // 16px  
        lg: 'h-5 w-5'       // 20px
    }

    return (
        <span className={cn(iconSizes[size], 'shrink-0', className)}>
            {children}
        </span>
    )
}