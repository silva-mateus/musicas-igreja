'use client'

import * as React from 'react'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

export interface ResponsiveModalProps {
    /**
     * Estado de abertura do modal
     */
    open?: boolean
    
    /**
     * Callback quando o modal muda de estado
     */
    onOpenChange?: (open: boolean) => void
    
    /**
     * Título do modal
     */
    title?: string
    
    /**
     * Descrição do modal
     */
    description?: string
    
    /**
     * Conteúdo do modal
     */
    children: React.ReactNode
    
    /**
     * Posição do sheet no mobile (padrão: bottom)
     */
    side?: 'top' | 'right' | 'bottom' | 'left'
    
    /**
     * Classes adicionais para o conteúdo
     */
    className?: string
}

/**
 * Modal responsivo que usa Dialog no desktop e Sheet no mobile
 */
export function ResponsiveModal({ 
    open, 
    onOpenChange, 
    title, 
    description,
    children,
    side = 'bottom',
    className 
}: ResponsiveModalProps) {
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent 
                    side={side} 
                    className={className}
                >
                    {(title || description) && (
                        <SheetHeader>
                            {title && <SheetTitle>{title}</SheetTitle>}
                            {description && <SheetDescription>{description}</SheetDescription>}
                        </SheetHeader>
                    )}
                    <div className="mt-6">
                        {children}
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={className}>
                {(title || description) && (
                    <DialogHeader>
                        {title && <DialogTitle>{title}</DialogTitle>}
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                )}
                <div className="mt-6">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    )
}