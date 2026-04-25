'use client'

import { Settings2, Type, Music as MusicIcon, Palette } from 'lucide-react'
import { Button } from '@core/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@core/components/ui/popover'
import { Slider } from '@core/components/ui/slider'
import { Switch } from '@core/components/ui/switch'
import { Label } from '@core/components/ui/label'
import { Separator } from '@core/components/ui/separator'

interface MusicDisplaySettingsProps {
  fontSize: number
  setFontSize: (size: number) => void
  showChords: boolean
  setShowChords: (show: boolean) => void
  chordColor: string
  setChordColor: (color: string) => void
  columnView: boolean
  setColumnView: (cols: boolean) => void
}

export function MusicDisplaySettings({
  fontSize,
  setFontSize,
  showChords,
  setShowChords,
  chordColor,
  setChordColor,
  columnView,
  setColumnView
}: MusicDisplaySettingsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Exibição</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-5 shadow-2xl border-border bg-background/95 backdrop-blur-md rounded-2xl" align="end" sideOffset={10}>
        <div className="space-y-6">
          <div>
            <h4 className="font-bold text-base mb-1">Ajustes de Exibição</h4>
            <p className="text-xs text-muted-foreground">Personalize sua experiência de prática.</p>
          </div>
          
          <div className="space-y-4">
            {/* Font Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 font-semibold">
                  <Type className="h-4 w-4 text-primary" />
                  Tamanho do Texto
                </Label>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {fontSize}px
                </span>
              </div>
              <Slider
                value={[fontSize]}
                min={10}
                max={40}
                step={1}
                onValueChange={(val) => setFontSize(val[0])}
                className="py-2"
              />
            </div>

            <Separator className="opacity-50" />

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between group">
                <Label htmlFor="show-chords" className="flex items-center gap-3 cursor-pointer group-hover:text-primary transition-colors">
                  <MusicIcon className={`h-4 w-4 ${showChords ? 'text-primary' : 'text-muted-foreground opacity-50'}`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Mostrar Cifras</span>
                    <span className="text-[10px] text-muted-foreground">Desative para modo &quot;Somente Letra&quot;</span>
                  </div>
                </Label>
                <Switch
                  id="show-chords"
                  checked={showChords}
                  onCheckedChange={setShowChords}
                />
              </div>

              <div className="flex items-center justify-between group">
                <Label htmlFor="column-view" className="flex items-center gap-3 cursor-pointer group-hover:text-primary transition-colors">
                  <div className={`h-4 w-4 flex gap-0.5 border border-current rounded-sm p-0.5 transition-colors ${columnView ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>
                    <div className="w-full h-full bg-current opacity-30" />
                    <div className="w-full h-full bg-current opacity-30" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Múltiplas Colunas</span>
                    <span className="text-[10px] text-muted-foreground">Melhor para telas largas</span>
                  </div>
                </Label>
                <Switch
                  id="column-view"
                  checked={columnView}
                  onCheckedChange={setColumnView}
                />
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Chord Color */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 font-semibold">
                <Palette className="h-4 w-4 text-primary" />
                Cor das Cifras
              </Label>
              <div className="flex flex-wrap justify-between gap-2 pt-1">
                {[
                  { name: 'Padrão', value: 'text-primary' },
                  { name: 'Azul', value: 'text-blue-500' },
                  { name: 'Vermelho', value: 'text-red-500' },
                  { name: 'Verde', value: 'text-green-500' },
                  { name: 'Laranja', value: 'text-orange-500' },
                ].map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setChordColor(color.value)}
                    className={`h-8 w-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      chordColor === color.value 
                        ? 'border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background scale-110 shadow-lg' 
                        : 'border-transparent hover:scale-110 hover:border-muted-foreground/30'
                    }`}
                    title={color.name}
                  >
                    <div className={`h-5 w-5 rounded-full ${color.value.replace('text-', 'bg-')} shadow-inner`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

