'use client'

import * as React from 'react'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export interface ResponsivePopoverProps {
    /**
     * Elemento que dispara o popover/sheet
     */
    trigger: React.ReactNode
    
    /**
     * Conteúdo do popover/sheet
     */
    children: React.ReactNode
    
    /**
     * Estado de abertura (opcional, para controle externo)
     */
    open?: boolean
    
    /**
     * Callback quando muda de estado
     */
    onOpenChange?: (open: boolean) => void
    
    /**
     * Posição do sheet no mobile (padrão: bottom)
     */
    side?: 'top' | 'right' | 'bottom' | 'left'
    
    /**
     * Classes adicionais para o conteúdo
     */
    className?: string
    
    /**
     * Alinhamento do popover no desktop
     */
    align?: 'start' | 'center' | 'end'
    
    /**
     * Lado do popover no desktop
     */
    popoverSide?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * Popover responsivo que usa Popover no desktop e Sheet no mobile
 */
export function ResponsivePopover({ 
    trigger,
    children,
    open,
    onOpenChange,
    side = 'bottom',
    className,
    align = 'center',
    popoverSide = 'bottom'
}: ResponsivePopoverProps) {
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetTrigger asChild>
                    {trigger}
                </SheetTrigger>
                <SheetContent 
                    side={side} 
                    className={className}
                >
                    {children}
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent 
                side={popoverSide}
                align={align}
                className={className}
            >
                {children}
            </PopoverContent>
        </Popover>
    )
}