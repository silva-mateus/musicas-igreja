'use client'

import { useState } from 'react'
import { ChevronDown, Minus, Plus, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@core/components/ui/popover'
import { cn } from '@/lib/utils'

function capoHintText(fret: number): string {
  if (fret <= 0) return 'Sem capo'
  return `Capotraste na ${fret}ª casa`
}

interface CapoControlProps {
  capo: number
  onCapoChange: (fret: number) => void
  disabled?: boolean
}

export function CapoControl({ capo, onCapoChange, disabled = false }: CapoControlProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleStepCapo = (delta: number) => {
    const newCapo = Math.max(0, Math.min(11, capo + delta))
    onCapoChange(newCapo)
  }

  const displayTrigger = capo === 0 ? 'Sem capo' : `${capo}ª casa`

  return (
    <div className="vh-key-row vh-key-row--capo">
      <span className="vh-key-lbl">Capo</span>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Capo: ${displayTrigger}. Abrir ajustes`}
            className={cn('vh-key-btn', disabled && 'opacity-50 cursor-not-allowed')}
            disabled={disabled}
          >
            <span>{displayTrigger}</span>
            <ChevronDown size={11} aria-hidden />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(
            'pop pop-capo !w-[220px] !max-w-[min(220px,calc(100vw-1rem))] !p-[14px] !rounded-[var(--radius-lg)]',
            '!shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <div className="pop-head">Capo</div>
          <div className="capo-controls">
            <button
              type="button"
              className="capo-x"
              title="Remover capo"
              disabled={disabled}
              onClick={() => onCapoChange(0)}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="capo-step"
              title="Diminuir"
              disabled={disabled}
              onClick={() => handleStepCapo(-1)}
            >
              <Minus className="h-4 w-4" strokeWidth={2} />
            </button>
            <div className="capo-num">{capo}</div>
            <button
              type="button"
              className="capo-step"
              title="Aumentar"
              disabled={disabled}
              onClick={() => handleStepCapo(1)}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="capo-hint">{capoHintText(capo)}</div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
