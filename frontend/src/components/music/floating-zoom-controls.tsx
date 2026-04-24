'use client'

import { Plus, Minus, Maximize, RotateCcw } from 'lucide-react'
import { Button } from '@core/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@core/components/ui/tooltip'

interface FloatingZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFitToPage?: () => void
  className?: string
}

export function FloatingZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFitToPage,
  className = ''
}: FloatingZoomControlsProps) {
  return (
    <div className={`fixed bottom-6 right-6 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onZoomIn}
              className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform bg-background/80 backdrop-blur-sm border border-border"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Aumentar Zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onZoomOut}
              className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform bg-background/80 backdrop-blur-sm border border-border"
            >
              <Minus className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Diminuir Zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onReset}
              className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform bg-background/80 backdrop-blur-sm border border-border"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Redefinir</TooltipContent>
        </Tooltip>

        {onFitToPage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                onClick={onFitToPage}
                className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform bg-background/80 backdrop-blur-sm border border-border"
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Ajustar à Página</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}
