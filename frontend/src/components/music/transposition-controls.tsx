'use client'

import { useState } from 'react'
import { Button } from '@core/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Badge } from '@core/components/ui/badge'
import { ChevronDown, ChevronUp, Music2 } from 'lucide-react'
import { Label } from '@core/components/ui/label'

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface TranspositionControlsProps {
    originalKey?: string
    transposedKey: string
    capoFret?: number
    onKeyChange: (key: string) => void
    onCapoChange: (capo: number) => void
    showCapoIndicator?: boolean
}

export function TranspositionControls({
    originalKey,
    transposedKey,
    capoFret = 0,
    onKeyChange,
    onCapoChange,
}: TranspositionControlsProps) {
    const [useFlats, setUseFlats] = useState(false)
    const keysToShow = useFlats ? FLATS : MUSICAL_KEYS

    const transposeSemitones = (delta: number) => {
        const currentIndex = MUSICAL_KEYS.indexOf(transposedKey)
        const newIndex = (currentIndex + delta + 12) % 12
        onKeyChange(MUSICAL_KEYS[newIndex])
    }

    return (
        <div className="space-y-4 p-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Transposição</span>
                </div>
                {originalKey && (
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        Original: {originalKey}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Tom Atual</Label>
                    <div className="flex items-center gap-1">
                        <Select value={transposedKey} onValueChange={onKeyChange}>
                            <SelectTrigger className="h-9 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {keysToShow.map((key) => (
                                    <SelectItem key={key} value={MUSICAL_KEYS[keysToShow.indexOf(key)]}>
                                        {key}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Capotraste</Label>
                    <Select value={String(capoFret)} onValueChange={(v) => onCapoChange(parseInt(v))}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((fret) => (
                                <SelectItem key={fret} value={String(fret)}>
                                    {fret === 0 ? 'Nenhum' : `${fret}ª Casa`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 gap-2"
                    onClick={() => transposeSemitones(-1)}
                >
                    <ChevronDown className="w-4 h-4" />
                    Semitom
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 gap-2"
                    onClick={() => transposeSemitones(1)}
                >
                    <ChevronUp className="w-4 h-4" />
                    Semitom
                </Button>
            </div>

            <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-7 text-muted-foreground hover:text-primary"
                onClick={() => setUseFlats(!useFlats)}
            >
                Usar {useFlats ? 'Sustenidos (#)' : 'Bemóis (b)'}
            </Button>
        </div>
    )
}
