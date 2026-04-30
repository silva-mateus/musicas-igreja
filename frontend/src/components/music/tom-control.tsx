'use client'

import { useState } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@core/components/ui/popover'
import { cn } from '@/lib/utils'

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

interface TomControlProps {
  currentKey: string
  originalKey: string
  onKeyChange: (newKey: string) => void
  onTranspose: (steps: number) => void
  transposeSteps?: number
  /** When set, renders `key-stepper-mini` on the Tom row wired to half-step changes. */
  onStepKey?: (delta: number) => void
  stepKeyDisabled?: boolean
  disabled?: boolean
}

export function TomControl({
  currentKey,
  originalKey,
  onKeyChange,
  onTranspose,
  transposeSteps = 0,
  onStepKey,
  stepKeyDisabled = false,
  disabled = false,
}: TomControlProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeySelect = (key: string) => {
    onKeyChange(key)
    const originalIdx = MUSICAL_KEYS.indexOf(originalKey)
    const newIdx = MUSICAL_KEYS.indexOf(key)
    const newTransposeSteps = (newIdx - originalIdx + 12) % 12
    onTranspose(newTransposeSteps)
    setIsOpen(false)
  }

  const handleRestoreOriginal = () => {
    onKeyChange(originalKey)
    onTranspose(0)
    setIsOpen(false)
  }

  return (
    <div className="vh-key-row">
      <span className="vh-key-lbl">Tom</span>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Tom: ${currentKey}${originalKey !== currentKey ? ` (original ${originalKey})` : ''}. Abrir seletor`}
            className={cn('vh-key-btn', disabled && 'opacity-50 cursor-not-allowed')}
            disabled={disabled}
          >
            <span>{currentKey}</span>
            {originalKey !== currentKey && <span className="orig">({originalKey})</span>}
            <ChevronDown size={11} aria-hidden />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(
            'pop pop-key !w-[240px] !max-w-[min(240px,calc(100vw-1rem))] !p-[14px] !rounded-[var(--radius-lg)]',
            '!shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <div className="pop-head">Trocar tom</div>
          <div className="key-grid">
            {MUSICAL_KEYS.map((k) => {
              const isCurrent = k === currentKey
              const isOrig = k === originalKey
              return (
                <button
                  key={k}
                  type="button"
                  className={cn(
                    'key-cell',
                    isOrig && 'active orig',
                    !isOrig && isCurrent && 'active',
                  )}
                  onClick={() => handleKeySelect(k)}
                >
                  {k}
                  {isOrig && <span className="key-cell-orig">orig</span>}
                </button>
              )
            })}
          </div>
          <div className="pop-row">
            <span />
            <button type="button" className="link-btn" onClick={handleRestoreOriginal}>
              Restaurar tom original
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {onStepKey && (
        <div className="key-stepper-mini" aria-label="Transpor meio-tom">
          <button
            type="button"
            title="Meio tom abaixo"
            disabled={stepKeyDisabled || disabled}
            onClick={() => onStepKey(-1)}
          >
            <Minus className="h-3 w-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Meio tom acima"
            disabled={stepKeyDisabled || disabled}
            onClick={() => onStepKey(1)}
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
