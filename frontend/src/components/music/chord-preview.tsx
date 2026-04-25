'use client'

import { ChordViewer } from '@/components/chord-viewer'

interface ChordPreviewProps {
    chordContent: string
    transposedKey?: string
    capoFret?: number
    arrangementJson?: string
    fontSize?: number
    showChords?: boolean
    chordColor?: string
    columnView?: boolean
}

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function ChordPreview({ 
    chordContent, 
    transposedKey, 
    capoFret, 
    arrangementJson,
    fontSize,
    showChords,
    chordColor,
    columnView
}: ChordPreviewProps) {
    if (!chordContent) {
        return (
            <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground text-center">Nenhuma cifra para visualizar</p>
            </div>
        )
    }

    let transposeSteps = 0;
    if (transposedKey) {
        // We need the original key from metadata to calculate the delta
        const originalKeyMatch = chordContent.match(/^\{key:\s*([A-G][#b]?)\}/m) || chordContent.match(/^\{k:\s*([A-G][#b]?)\}/m);
        const originalKey = originalKeyMatch ? originalKeyMatch[1] : 'C'; // fallback to C
        
        const originalIndex = MUSICAL_KEYS.indexOf(originalKey);
        const transposedIndex = MUSICAL_KEYS.indexOf(transposedKey);
        
        if (originalIndex !== -1 && transposedIndex !== -1) {
            transposeSteps = (transposedIndex - originalIndex + 12) % 12;
            
            // If we have capo, the capo ALSO transposes up. 
            // So if we wanted to transpose by +2 and we put Capo on 2, the app shouldn't transpose the base chords twice.
            // Typically: Display Key = Original Key + Transpose + Capo
            // For the viewer, transposeAmount is how much to shift the CHORDS.
            // If user wants to sing in D (+2 from C) with Capo 2, the CHORDS played should be C.
            // So chordShift = totalShift - capoFret.
            transposeSteps = transposeSteps - (capoFret || 0);
            
            // keep it positive/proper modulo
            transposeSteps = (transposeSteps % 12 + 12) % 12;
        }
    }
    
    return (
        <div className="chord-preview-container">
            <ChordViewer 
                content={chordContent} 
                transposeAmount={transposeSteps} 
                capoFret={capoFret}
                arrangementJson={arrangementJson}
                fontSize={fontSize}
                showChords={showChords}
                chordColor={chordColor}
                columnView={columnView}
            />
        </div>
    )
}
