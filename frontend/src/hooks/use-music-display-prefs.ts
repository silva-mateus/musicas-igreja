'use client'

import { useState, useCallback } from 'react'

export interface MusicDisplayPrefs {
  fontSize: number
  showChords: boolean
  chordColor: string
  displayMode: 'normal' | 'fit'
  hideHeaders: boolean
}

const DEFAULT_PREFS: MusicDisplayPrefs = {
  fontSize: 16,
  showChords: true,
  chordColor: 'oklch(0.62 0.18 50)',
  displayMode: 'normal',
  hideHeaders: false,
}

const STORAGE_KEY = 'music-display-prefs'

export function useMusicDisplayPrefs() {
  const [prefs, setPrefsState] = useState<MusicDisplayPrefs>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return DEFAULT_PREFS
      const parsed = JSON.parse(stored)
      // Migrate legacy displayMode values
      if (parsed.displayMode === 'scroll' || parsed.displayMode === 'auto-scale') {
        parsed.displayMode = 'normal'
      } else if (parsed.displayMode === 'auto-fit') {
        parsed.displayMode = 'fit'
      }
      if (parsed.chordColor === 'text-primary' || (typeof parsed.chordColor === 'string' && parsed.chordColor.startsWith('text-'))) {
        parsed.chordColor = 'oklch(0.62 0.18 50)'
      }
      delete parsed.columnView
      return { ...DEFAULT_PREFS, ...parsed }
    } catch {
      return DEFAULT_PREFS
    }
  })

  const updatePrefs = useCallback((updates: Partial<MusicDisplayPrefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch { /* ignore quota errors */ }
      return next
    })
  }, [])

  return [prefs, updatePrefs] as const
}
