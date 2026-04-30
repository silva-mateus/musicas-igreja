'use client'

import * as React from 'react'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface ResponsiveDrawerProps {
    /**
     * Elemento que dispara o drawer
     */
    trigger?: React.ReactNode
    
    /**
     * Conteúdo do drawer
     */
    children: React.ReactNode
    
    /**
     * Estado de abertura
     */
    open?: boolean
    
    /**
     * Callback quando muda de estado
     */
    onOpenChange?: (open: boolean) => void
    
    /**
     * Título do drawer
     */
    title?: string
    
    /**
     * Descrição do drawer
     */
    description?: string
    
    /**
     * Lado do drawer
     */
    side?: 'top' | 'right' | 'bottom' | 'left'
    
    /**
     * Classes adicionais para o conteúdo
     */
    className?: string
}

/**
 * Drawer responsivo otimizado para mobile
 */
export function ResponsiveDrawer({ 
    trigger,
    children,
    open,
    onOpenChange,
    title,
    description,
    side = 'left',
    className 
}: ResponsiveDrawerProps) {
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'
    
    // Largura responsiva baseada no breakpoint
    const getDrawerWidth = () => {
        if (side === 'left' || side === 'right') {
            return isMobile ? 'w-[min(85vw,320px)]' : 'w-[280px]'
        }
        return ''
    }

    const content = (
        <SheetContent 
            side={side}
            className={cn(
                getDrawerWidth(),
                'p-0', // Remove padding padrão
                '[&>button]:hidden', // Esconde botão close padrão  
                className
            )}
        >
            {(title || description) && (
                <SheetHeader className="px-4 py-3 border-b">
                    {title && <SheetTitle className="text-left">{title}</SheetTitle>}
                    {description && <SheetDescription className="text-left">{description}</SheetDescription>}
                </SheetHeader>
            )}
            <div className={cn(
                title || description ? 'flex-1' : '',
                'overflow-y-auto'
            )}>
                {children}
            </div>
        </SheetContent>
    )

    if (trigger) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetTrigger asChild>
                    {trigger}
                </SheetTrigger>
                {content}
            </Sheet>
        )
    }

    // Versão controlada sem trigger
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {content}
        </Sheet>
    )
}