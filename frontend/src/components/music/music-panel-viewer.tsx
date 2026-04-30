'use client'

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { Badge } from '@core/components/ui/badge'
import { Button } from '@core/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@core/components/ui/popover'
import { TouchTarget } from '@/components/ui/touch-target'
import { ResponsivePopover } from '@/components/ui/responsive-popover'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import {
  ArrowLeft,
  Download,
  Eye,
  Info,
  Loader2,
  Minus,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scan,
  Settings,
  Type,
  X,
} from 'lucide-react'
import { useAuth } from '@core/contexts/auth-context'
import { musicApi, handleApiError } from '@/lib/api'
import { useMusicDetail, musicKeys } from '@/hooks/use-music'
import { useMusicDisplayPrefs } from '@/hooks/use-music-display-prefs'
import { ChordPreview } from '@/components/music/chord-preview'
import { AddToListModal } from '@/components/music/add-to-list-modal'
import { OcrConvertCard } from '@/components/music/ocr-convert-card'
import { EditorInsertChip } from '@/components/music/editor-insert-chip'
import { TomControl } from '@/components/music/tom-control'
import { CapoControl } from '@/components/music/capo-control'
import {
  parseChordProDocument,
  extractUniqueChords,
  convertChordProToText,
  convertTextToChordPro,
} from '@/lib/chordpro'
import { useToast } from '@core/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { hapticFeedback } from '@/lib/haptic-feedback'
import { cn } from '@/lib/utils'

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const ACCENTS = [
  { name: 'Âmbar',  value: 'oklch(0.62 0.18 50)' },
  { name: 'Carmim', value: 'oklch(0.55 0.19 25)' },
  { name: 'Índigo', value: 'oklch(0.50 0.18 265)' },
  { name: 'Oliva',  value: 'oklch(0.55 0.13 125)' },
  { name: 'Tinta',  value: 'oklch(0.30 0.02 260)' },
]

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

interface MusicPanelViewerProps {
  musicId: number
  mode: 'read' | 'edit'
  onExitEdit?: () => void
  onEnterEdit?: () => void
}

export function MusicPanelViewer({ musicId, mode, onExitEdit, onEnterEdit }: MusicPanelViewerProps) {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
  const canManageLists = hasPermission('lists:manage')

  const { data: music, isLoading, error } = useMusicDetail(musicId)
  const [prefs, updatePrefs] = useMusicDisplayPrefs()
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'

  // ── Key / capo (read mode) ────────────────────────────────────────────────
  const [transposedKey, setTransposedKey] = useState<string | null>(null)
  const [capoFret, setCapoFret] = useState(0)
  const [arrangementJson, setArrangementJson] = useState<string | null>(null)
  const [isSavingPref, setIsSavingPref] = useState(false)

  // ── PDF streaming ─────────────────────────────────────────────────────────
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(true)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // ── Editor state ──────────────────────────────────────────────────────────
  const [editorTab, setEditorTab] = useState<'geral' | 'avancado' | 'arranjo'>('geral')
  const [editorView, setEditorView] = useState<'chordpro' | 'chords-over-lyrics'>('chordpro')
  const [editorContent, setEditorContent] = useState('')
  const [editorTitle, setEditorTitle] = useState('')
  const [editorArtist, setEditorArtist] = useState('')
  const [editorKey, setEditorKey] = useState('C')
  const [mobileEditorTab, setMobileEditorTab] = useState<'editor' | 'preview'>('editor')
  const [editorYoutube, setEditorYoutube] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [editorArrangement, setEditorArrangement] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Undo/Redo history ──────────────────────────────────────────────────────
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const pushTimerRef = useRef<number | null>(null)

  // ── Chord autocomplete popup ───────────────────────────────────────────────
  const [chordPopup, setChordPopup] = useState<{ query: string; selIdx: number } | null>(null)

  // ── YouTube modal ─────────────────────────────────────────────────────────
  const [youtubeOpen, setYoutubeOpen] = useState(false)

  // ── Popover refs ──────────────────────────────────────────────────────────
  const [displayOpen, setDisplayOpen] = useState(false)
  const displayRef = useRef<HTMLDivElement>(null)

  // ── Auto-layout refs + state (cols + scale) ───────────────────────────────
  const contentContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [autoColumns, setAutoColumns] = useState(1)
  const [autoScale, setAutoScale] = useState(1)
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (displayRef.current && !displayRef.current.contains(e.target as Node)) setDisplayOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Load user preferences ─────────────────────────────────────────────────
  useEffect(() => {
    if (!music || music.content_type !== 'chord') {
      setTransposedKey(null); setCapoFret(0); setArrangementJson(null)
      return
    }
    const load = async () => {
      try {
        const res = await musicApi.getPreferences(music.id)
        if (res.success && res.preferences) {
          const directiveKey = extractOrigKey(music.chord_content)
          const baseKey = directiveKey || music.musical_key || 'C'
          const origIdx = MUSICAL_KEYS.indexOf(baseKey)
          const amount = res.preferences.transpose_amount || 0
          setTransposedKey(origIdx !== -1 ? MUSICAL_KEYS[((origIdx + amount) % 12 + 12) % 12] : baseKey)
          setCapoFret(res.preferences.capo_fret || 0)
          setArrangementJson(res.preferences.arrangement_json || null)
          return
        }
      } catch { /* ignore */ }
      setTransposedKey(music.musical_key || 'C')
    }
    load()
  }, [music?.id])

  // ── Load editor content when entering edit mode ───────────────────────────
  useEffect(() => {
    if (mode === 'edit' && music) {
      const initial = music.chord_content || music.chord_content_draft || ''
      setEditorContent(initial)
      setEditorTitle(music.title || music.original_name || '')
      setEditorArtist(music.artist || '')
      setEditorKey(music.musical_key || 'C')
      setEditorYoutube(music.youtube_link || '')
      setEditorDesc(music.observations || '')
      try {
        setEditorArrangement(arrangementJson ? JSON.parse(arrangementJson) || [] : [])
      } catch { setEditorArrangement([]) }
      setHistory([initial])
      setHistoryIdx(0)
      setIsDirty(false)
    }
  }, [mode, music?.id, arrangementJson])


  // ── Editor helpers ─────────────────────────────────────────────────────────
  const editorDoc = useMemo(() => parseChordProDocument(editorContent || ''), [editorContent])
  const editorUniqueChords = useMemo(() => extractUniqueChords(editorContent || ''), [editorContent])
  const editorLabeledSections = useMemo(() => editorDoc.sections.filter((s) => s.label), [editorDoc])
  const displayedContent = useMemo(
    () => editorView === 'chordpro' ? editorContent : convertChordProToText(editorContent),
    [editorView, editorContent]
  )

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setEditorContent((v) => v + text)
      setIsDirty(true)
      return
    }
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const next = editorContent.substring(0, s) + text + editorContent.substring(e)
    pushHistory(next)
    setEditorContent(next)
    setIsDirty(true)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(s + text.length, s + text.length)
    }, 0)
  }

  // ── Diatonic chords for current editor key ─────────────────────────────────
  const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
  const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim']
  const ROMAN_DEGREES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  const diatonicChords = useMemo(() => {
    const idx = MUSICAL_KEYS.indexOf(editorKey)
    if (idx === -1) return []
    return MAJOR_INTERVALS.map((semi, i) => ({
      degree: ROMAN_DEGREES[i],
      chord: MUSICAL_KEYS[(idx + semi) % 12] + MAJOR_QUALITIES[i],
    }))
  }, [editorKey])

  // ── Undo/Redo helpers ──────────────────────────────────────────────────────
  const pushHistory = (content: string) => {
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
    pushTimerRef.current = window.setTimeout(() => {
      setHistory((h) => {
        const trimmed = h.slice(0, historyIdx + 1)
        if (trimmed[trimmed.length - 1] === content) return trimmed
        const next = [...trimmed, content]
        return next.length > 100 ? next.slice(-100) : next
      })
      setHistoryIdx((i) => Math.min(i + 1, 99))
    }, 500)
  }

  // ── Chord autocomplete candidates ──────────────────────────────────────────
  const chordCandidates = useMemo(() => {
    if (!chordPopup) return []
    const all = Array.from(new Set([
      ...editorUniqueChords,
      ...diatonicChords.map((d) => d.chord),
    ]))
    const q = chordPopup.query.toLowerCase()
    return all.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 8)
  }, [chordPopup, editorUniqueChords, diatonicChords])

  // ── Textarea change handler (view-aware + history + popup detection) ───────
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value
    const newContent = editorView === 'chordpro' ? raw : convertTextToChordPro(raw)
    pushHistory(newContent)
    setEditorContent(newContent)
    setIsDirty(true)

    // Autocomplete: only in chordpro view, only when [ open without ]
    if (editorView !== 'chordpro') { setChordPopup(null); return }
    const pos = e.target.selectionStart ?? raw.length
    const upToCursor = raw.substring(0, pos)
    const lastBracket = upToCursor.lastIndexOf('[')
    const lastClose = upToCursor.lastIndexOf(']')
    if (lastBracket > lastClose && pos - lastBracket <= 8) {
      const query = upToCursor.substring(lastBracket + 1)
      setChordPopup({ query, selIdx: 0 })
    } else {
      setChordPopup(null)
    }
  }

  const insertChordFromPopup = (chord: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? 0
    const upToCursor = editorContent.substring(0, pos)
    const lastBracket = upToCursor.lastIndexOf('[')
    if (lastBracket === -1) return
    const before = editorContent.substring(0, lastBracket)
    const after = editorContent.substring(pos)
    const next = `${before}[${chord}]${after}`
    pushHistory(next)
    setEditorContent(next)
    setIsDirty(true)
    setChordPopup(null)
    const newPos = lastBracket + chord.length + 2
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newPos, newPos) }, 0)
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Undo/Redo — always preventDefault to override browser back-nav fallback
    const meta = e.ctrlKey || e.metaKey
    if (meta && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (pushTimerRef.current) { window.clearTimeout(pushTimerRef.current); pushTimerRef.current = null }
      if (historyIdx > 0) {
        const idx = historyIdx - 1
        setHistoryIdx(idx)
        setEditorContent(history[idx])
        setIsDirty(true)
      }
      return
    }
    if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (pushTimerRef.current) { window.clearTimeout(pushTimerRef.current); pushTimerRef.current = null }
      if (historyIdx < history.length - 1) {
        const idx = historyIdx + 1
        setHistoryIdx(idx)
        setEditorContent(history[idx])
        setIsDirty(true)
      }
      return
    }

    // Autocomplete keys
    if (!chordPopup || chordCandidates.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setChordPopup({ ...chordPopup, selIdx: (chordPopup.selIdx + 1) % chordCandidates.length })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setChordPopup({ ...chordPopup, selIdx: (chordPopup.selIdx - 1 + chordCandidates.length) % chordCandidates.length })
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertChordFromPopup(chordCandidates[chordPopup.selIdx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setChordPopup(null)
    }
  }

  // ── PDF loader ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (music?.id && music.content_type !== 'chord') loadPdf(music.id)
    else { setPdfUrl(null); setPdfError(null) }
  }, [music?.id, music?.content_type])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const loadPdf = async (fileId: number) => {
    try {
      setLoadingPdf(true); setPdfError(null)
      const res = await fetch(`/api/files/${fileId}/stream`, { headers: { Accept: 'application/pdf' }, cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPdfUrl(URL.createObjectURL(await res.blob()))
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'erro desconhecido')
    } finally { setLoadingPdf(false) }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const extractOrigKey = (content?: string | null): string | null => {
    const m = content?.match(/^\{key:\s*([A-G][#b]?)\}/m) || content?.match(/^\{k:\s*([A-G][#b]?)\}/m)
    return m?.[1] ?? null
  }

  const effectiveKey = transposedKey || music?.musical_key || 'C'

  const savePreferences = async (newKey: string, newCapo: number, newArr: string | null) => {
    if (!music) return
    try {
      setIsSavingPref(true)
      const baseKey = extractOrigKey(music.chord_content) || music.musical_key || 'C'
      const origIdx = MUSICAL_KEYS.indexOf(baseKey)
      const newIdx = MUSICAL_KEYS.indexOf(newKey)
      const transposeAmount = origIdx !== -1 && newIdx !== -1 ? (newIdx - origIdx + 12) % 12 : 0
      await musicApi.updatePreferences(music.id, {
        transpose_amount: transposeAmount,
        capo_fret: newCapo,
        arrangement_json: newArr ?? undefined,
      })
      setTransposedKey(newKey); setCapoFret(newCapo); setArrangementJson(newArr)
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar preferências.', variant: 'destructive' })
    } finally { setIsSavingPref(false) }
  }

  const stepKey = (delta: number) => {
    const idx = MUSICAL_KEYS.indexOf(effectiveKey)
    savePreferences(MUSICAL_KEYS[(idx + delta + 12) % 12], capoFret, arrangementJson)
  }

  const updateArrangement = (next: string[]) => {
    setEditorArrangement(next)
    savePreferences(effectiveKey, capoFret, next.length ? JSON.stringify(next) : null)
  }

  const handleDownload = async () => {
    if (!music) return
    try {
      const blob = await musicApi.downloadMusic(music.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = music.original_name
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
    }
  }

  const handleSave = async () => {
    if (!music) return
    try {
      setIsSaving(true)
      const hasChordEditing = music.content_type === 'chord' || !!music.chord_content_draft
      if (hasChordEditing) {
        await musicApi.updateChord(music.id, {
          chord_content: editorContent,
          musical_key: editorKey,
        })
      }
      await musicApi.updateMusic(music.id, {
        title: editorTitle,
        artist: editorArtist,
        musical_key: editorKey,
        youtube_link: editorYoutube,
        observations: editorDesc,
      })
      queryClient.invalidateQueries({ queryKey: musicKeys.detail(music.id) })
      queryClient.invalidateQueries({ queryKey: musicKeys.lists() })
      setIsDirty(false)
      toast({ title: 'Salvo', description: 'Música atualizada com sucesso.' })
    } catch (error) {
      toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
    } finally { setIsSaving(false) }
  }

  // ── Auto-layout engine (cols + scale, Songbook Pro style) ─────────────────
  const isChordForScale = mode === 'read' && music?.content_type === 'chord' && !!music?.chord_content

  useLayoutEffect(() => {
    if (!isChordForScale) {
      setAutoColumns(1); setAutoScale(1); setLayoutReady(true); return
    }
    const ct = contentContainerRef.current
    const mr = measureRef.current
    if (!ct || !mr) return

    const cw = ct.clientWidth
    const ch = ct.clientHeight
    const lineW = mr.scrollWidth
    const totalH = mr.scrollHeight
    if (cw === 0 || ch === 0 || lineW === 0 || totalH === 0) {
      setLayoutReady(true); return
    }

    const GUTTER = 32
    const MAX_COLS = 3
    const colWidthFor = (n: number) => (cw - GUTTER * (n - 1)) / n
    const colHeightFor = (n: number) => totalH / n

    // Max cols allowed by width (lines don't wrap)
    let maxByWidth = 1
    for (let n = MAX_COLS; n >= 1; n--) {
      if (lineW <= colWidthFor(n)) { maxByWidth = n; break }
    }

    if (prefs.displayMode === 'normal') {
      // Songbook Pro-style: prefer cols when content uses meaningful viewport height.
      // ratio < 0.6 → 1 col (small song, no fragmentation)
      // 0.6 ≤ ratio < 1.4 → 2 cols (uses horizontal space, each col ~0.5–0.7 ch)
      // ratio ≥ 1.4 → 3 cols (long song, splits aggressively)
      const ratio = totalH / ch
      let preferred = 1
      if (ratio >= 1.4) preferred = 3
      else if (ratio >= 0.6) preferred = 2
      const chosen = Math.min(preferred, maxByWidth, MAX_COLS)
      setAutoColumns(chosen)
      setAutoScale(1)
    } else {
      // fit: maximize scale across N candidates (constrained by width)
      let best = { n: 1, scale: 0 }
      for (let n = 1; n <= maxByWidth; n++) {
        const sx = colWidthFor(n) / lineW
        const sy = ch / colHeightFor(n)
        const s = Math.min(sx, sy, 1)
        if (s > best.scale) best = { n, scale: s }
      }
      setAutoColumns(best.n)
      setAutoScale(best.scale > 0 ? best.scale : 1)
    }
    setLayoutReady(true)
  }, [
    isChordForScale,
    prefs.displayMode,
    prefs.fontSize,
    prefs.showChords,
    prefs.chordColor,
    music?.chord_content,
    arrangementJson,
    effectiveKey,
    capoFret,
  ])

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 pt-5 pb-4 space-y-3">
          <div className="h-9 w-64 bg-muted rounded animate-pulse" />
          <div className="h-3.5 w-40 bg-muted rounded animate-pulse" />
          <div className="flex gap-2 mt-4">
            <div className="h-7 w-28 bg-muted rounded-full animate-pulse" />
            <div className="h-7 w-28 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !music) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground p-8">
        <Eye className="h-10 w-10 opacity-30" />
        <p className="text-sm">Não foi possível carregar a música.</p>
      </div>
    )
  }

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  if (mode === 'edit') {
    const isChord = music.content_type === 'chord'
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Editor bar */}
        <div className="shrink-0 border-b border-border bg-card flex items-center gap-2 md:gap-3 px-2 md:px-4 h-[48px] overflow-x-auto">
          {onExitEdit && (
            <button
              onClick={onExitEdit}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              title="Voltar para leitura"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Voltar</span>
            </button>
          )}

          <div className="flex items-center gap-0.5 self-stretch">
            {(['geral', 'avancado', 'arranjo'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEditorTab(t)}
                className={cn(
                  'relative px-3 text-xs font-medium transition-colors',
                  editorTab === t
                    ? 'text-foreground after:content-[""] after:absolute after:left-3 after:right-3 after:bottom-0 after:h-[2px] after:bg-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'geral' ? 'Geral' : t === 'avancado' ? 'Avançado' : 'Arranjo'}
              </button>
            ))}
          </div>

          {/* Mobile: Layout tabs (Editar | Visualizar) */}
          {isMobile && (
            <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5 text-[11px]">
              <TouchTarget
                onClick={() => setMobileEditorTab('editor')}
                variant="button"
                size="sm"
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap text-center',
                  mobileEditorTab === 'editor' 
                    ? 'bg-card text-foreground border border-border shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Editar
              </TouchTarget>
              <TouchTarget
                onClick={() => setMobileEditorTab('preview')}
                variant="button"
                size="sm"
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap text-center',
                  mobileEditorTab === 'preview' 
                    ? 'bg-card text-foreground border border-border shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Visualizar
              </TouchTarget>
            </div>
          )}

          <div className="flex-1" />

          {isChord && editorTab !== 'arranjo' && (
            <div className="hidden sm:inline-flex items-center bg-muted rounded-full p-0.5 gap-0.5 text-[11px] shrink-0">
              <button
                onClick={() => setEditorView('chords-over-lyrics')}
                className={cn('px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap',
                  editorView === 'chords-over-lyrics' ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Acordes sobre letra
              </button>
              <button
                onClick={() => setEditorView('chordpro')}
                className={cn('px-2.5 py-1 rounded-full font-medium transition-colors',
                  editorView === 'chordpro' ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                ChordPro
              </button>
            </div>
          )}

          <span className="inline-flex items-center text-[11px] text-muted-foreground shrink-0">
            <span
              className="inline-block w-[7px] h-[7px] rounded-full md:mr-1.5 animate-pulse"
              style={{ background: 'oklch(0.72 0.14 145)', boxShadow: '0 0 0 3px oklch(0.72 0.14 145 / 0.2)' }}
            />
            <span className="hidden md:inline">Pré-visualização</span>
          </span>

          <TouchTarget
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            variant="button"
            className={cn(
              "gap-1.5 text-xs shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3",
              (isSaving || !isDirty) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar
          </TouchTarget>
        </div>

        {/* Editor layout */}
        <div className={cn(
          "flex flex-1 min-h-0",
          isMobile ? "flex-col" : "flex-col md:flex-row"
        )}>
          {/* Editor pane */}
          <div className={cn(
            "flex flex-col min-h-0 bg-card border-border",
            isMobile 
              ? mobileEditorTab === 'editor' ? 'flex-1' : 'hidden'
              : 'md:w-1/2 h-1/2 md:h-auto md:border-r border-b md:border-b-0'
          )}>
            {(editorTab === 'geral' || editorTab === 'avancado') && (
              <>
                {/* Meta grid */}
                <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 border-b border-dashed border-border shrink-0">
                  {editorTab === 'geral' ? (
                    <>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Título</label>
                        <input
                          value={editorTitle}
                          onChange={(e) => { setEditorTitle(e.target.value); setIsDirty(true) }}
                          className={cn(
                            "border-0 border-b border-border px-0 text-xl bg-transparent focus:outline-none focus:border-foreground transition-colors",
                            "py-1 md:py-1 min-h-11 md:min-h-6"
                          )}
                          style={{ 
                            fontFamily: 'var(--font-serif, Georgia, serif)',
                            fontSize: isMobile ? 'max(16px, 1.25rem)' : '1.25rem'
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Artista</label>
                        <input
                          value={editorArtist}
                          onChange={(e) => { setEditorArtist(e.target.value); setIsDirty(true) }}
                          className={cn(
                            "border-0 border-b border-border px-0 text-sm bg-transparent focus:outline-none focus:border-foreground transition-colors",
                            "py-1 md:py-1 min-h-11 md:min-h-6"
                          )}
                          style={{
                            fontSize: isMobile ? 'max(16px, 0.875rem)' : '0.875rem'
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tom original</label>
                        <select
                          value={editorKey}
                          onChange={(e) => { setEditorKey(e.target.value); setIsDirty(true) }}
                          className={cn(
                            "border-0 border-b border-border px-0 text-sm font-mono bg-transparent focus:outline-none focus:border-foreground transition-colors",
                            "py-1 md:py-1 min-h-11 md:min-h-6"
                          )}
                          style={{
                            fontSize: isMobile ? 'max(16px, 0.875rem)' : '0.875rem'
                          }}
                        >
                          {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Link URL</label>
                        <input
                          value={editorYoutube}
                          onChange={(e) => { setEditorYoutube(e.target.value); setIsDirty(true) }}
                          placeholder="https://youtube.com/..."
                          className={cn(
                            "border-0 border-b border-border px-0 text-sm font-mono bg-transparent focus:outline-none focus:border-foreground transition-colors",
                            "py-1 md:py-1 min-h-11 md:min-h-6"
                          )}
                          style={{
                            fontSize: isMobile ? 'max(16px, 0.875rem)' : '0.875rem'
                          }}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Observações</label>
                        <input
                          value={editorDesc}
                          onChange={(e) => { setEditorDesc(e.target.value); setIsDirty(true) }}
                          placeholder="Ex.: tocar os 2 primeiros versos sem bateria"
                          className={cn(
                            "border-0 border-b border-border px-0 text-sm bg-transparent focus:outline-none focus:border-foreground transition-colors",
                            "py-1 md:py-1 min-h-11 md:min-h-6"
                          )}
                          style={{
                            fontSize: isMobile ? 'max(16px, 0.875rem)' : '0.875rem'
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {isChord && (
                  <>
                    {/* Chord bar */}
                    {editorUniqueChords.length > 0 && (
                      <div className="px-4 md:px-6 py-2.5 border-b border-border flex items-center gap-1.5 flex-wrap bg-background shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Acordes na música</span>
                        {editorUniqueChords.map((c) => (
                          <EditorInsertChip
                            key={c}
                            variant="chord"
                            onClick={() => insertAtCursor(`[${c}]`)}
                          >
                            {c}
                          </EditorInsertChip>
                        ))}
                      </div>
                    )}

                    {/* Diatonic bar (Geral only) */}
                    {editorTab === 'geral' && diatonicChords.length > 0 && (
                      <div className="px-4 md:px-6 py-2 border-b border-border flex items-center gap-1.5 flex-wrap shrink-0 bg-muted/20">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Tom de {editorKey}</span>
                        {diatonicChords.map(({ degree, chord }) => (
                          <EditorInsertChip
                            key={degree}
                            variant="degree"
                            degreeLabel={degree}
                            title={`Grau ${degree}`}
                            onClick={() => insertAtCursor(`[${chord}]`)}
                          >
                            {chord}
                          </EditorInsertChip>
                        ))}
                      </div>
                    )}

                    {/* Section bar (Geral only) */}
                    {editorTab === 'geral' && (
                      <div className="px-4 md:px-6 py-2 border-b border-border flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Inserir seção</span>
                        {[
                          { label: 'Verso', tpl: '\n\n{sov: Verso}\n\n{eov}\n' },
                          { label: 'Refrão', tpl: '\n\n{soc: Refrão}\n\n{eoc}\n' },
                          { label: 'Ponte', tpl: '\n\n{sob: Ponte}\n\n{eob}\n' },
                          { label: 'Comentário', tpl: '\n{comment: Intro}\n' },
                        ].map((s) => (
                          <EditorInsertChip
                            key={s.label}
                            variant="section"
                            onClick={() => insertAtCursor(s.tpl)}
                          >
                            {s.label}
                          </EditorInsertChip>
                        ))}
                      </div>
                    )}

                    {/* Textarea + autocomplete popup */}
                    <div className="relative flex-1 min-h-0 flex">
                      <textarea
                        key={editorView}
                        ref={textareaRef}
                        value={displayedContent}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        onBlur={() => setTimeout(() => setChordPopup(null), 150)}
                        spellCheck={false}
                        className="flex-1 min-h-0 resize-none border-0 outline-none px-4 md:px-6 py-4 font-mono leading-[1.7] bg-card text-foreground"
                        style={{
                          fontSize: isMobile ? 'max(16px, 14px)' : '13px'
                        }}
                      />

                      {chordPopup && chordCandidates.length > 0 && editorView === 'chordpro' && (
                        <div className="absolute bottom-3 left-4 md:left-6 bg-card border border-border rounded-lg shadow-lg p-1 max-h-48 overflow-y-auto z-30 min-w-[140px]">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 py-1">Acordes</p>
                          {chordCandidates.map((c, i) => (
                            <button
                              key={c}
                              onMouseDown={(e) => { e.preventDefault(); insertChordFromPopup(c) }}
                              className={cn(
                                'block w-full text-left px-2 py-1 text-xs font-mono rounded',
                                i === chordPopup.selIdx ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
                              )}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {editorTab === 'arranjo' && (
              <div className="p-6 overflow-y-auto">
                <div className="mb-4">
                  <h3 className="text-2xl font-normal mb-1" style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>Montador de arranjo</h3>
                  <p className="text-xs text-muted-foreground">
                    Construa a sequência da música. Clique em uma seção para adicioná-la à ordem.
                  </p>
                </div>

                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Seções disponíveis</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {editorLabeledSections.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Nenhuma seção rotulada na música.</span>
                  ) : editorLabeledSections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateArrangement([...editorArrangement, s.id])}
                      className="inline-flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" /> {s.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Sequência atual</p>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg min-h-[44px]">
                  {editorArrangement.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Nenhuma seção selecionada. Usando ordem original.</span>
                  ) : editorArrangement.map((ref, idx) => {
                    const sec = editorLabeledSections.find((s) => s.id === ref)
                    if (!sec) return null
                    return (
                      <span key={`${ref}-${idx}`} className="inline-flex items-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs font-medium">
                          {sec.label}
                          <button
                            onClick={() => updateArrangement(editorArrangement.filter((_, i) => i !== idx))}
                            className="w-3.5 h-3.5 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                        {idx < editorArrangement.length - 1 && <span className="mx-1 text-muted-foreground text-[10px]">→</span>}
                      </span>
                    )
                  })}
                </div>

                <div className="mt-5 p-3.5 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <b className="text-foreground">Dica.</b> Um arranjo personalizado é salvo como preferência por música; o original nunca é modificado.
                </div>
              </div>
            )}
          </div>

          {/* Preview pane */}
          <div className={cn(
            "overflow-y-auto bg-background",
            isMobile
              ? mobileEditorTab === 'preview' ? 'flex-1' : 'hidden'
              : 'md:w-1/2 h-1/2 md:h-auto'
          )}>
            <div className="flex justify-between items-start gap-3 px-4 md:px-10 pt-4 md:pt-9 pb-3 md:pb-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-normal leading-tight truncate" style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                  {editorTitle || 'Sem título'}
                </h2>
                {editorArtist && <p className="text-xs text-muted-foreground mt-1 truncate">{editorArtist}</p>}
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0 pt-1">
                Tom: <b className="text-foreground">{editorKey}</b>
              </span>
            </div>
            {isChord ? (
              <div className="px-4 md:px-10 pt-4 md:pt-7 pb-8 md:pb-12">
                <ChordPreview
                  chordContent={editorContent}
                  transposedKey={editorKey}
                  capoFret={0}
                  arrangementJson={editorTab === 'arranjo' && editorArrangement.length ? JSON.stringify(editorArrangement) : undefined}
                  fontSize={prefs.fontSize}
                  showChords={prefs.showChords}
                  chordColor={prefs.chordColor}
                  columnCount={1}
                  originalKey={editorKey}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Pré-visualização disponível apenas para cifras
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── READ MODE ─────────────────────────────────────────────────────────────
  const isChord = music.content_type === 'chord'
  const hasCategories =
    (music.categories && music.categories.length > 0) ||
    !!music.category ||
    (music.custom_filters && Object.keys(music.custom_filters).length > 0)

  const isFitMode = prefs.displayMode === 'fit'
  const originalKeyResolved = extractOrigKey(music.chord_content) || music.musical_key || 'C'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative z-20 shrink-0 border-b border-border bg-card px-3 md:px-6">
        <div className="viewer-head v2">
          <div className="viewer-head__scroll">
            <div className="vh-title-block">
              <h1
                className="text-xl md:text-2xl font-normal truncate"
                style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
              >
                {music.title || music.original_name}
              </h1>
              {music.artist && <p className="vh-artist">{music.artist}</p>}
            </div>

            {isChord && (
              <div className="vh-key-stack">
                <TomControl
                  currentKey={effectiveKey}
                  originalKey={originalKeyResolved}
                  onKeyChange={(newKey) => savePreferences(newKey, capoFret, arrangementJson)}
                  onTranspose={() => {}}
                  onStepKey={(d) => stepKey(d)}
                  stepKeyDisabled={isSavingPref}
                  disabled={isSavingPref}
                />
                <CapoControl
                  capo={capoFret}
                  onCapoChange={(fret) => savePreferences(effectiveKey, fret, arrangementJson)}
                  disabled={isSavingPref}
                />
              </div>
            )}
          </div>

          <div className="vh-tools">
            <ResponsivePopover
              align="end"
              className="w-72 p-4 space-y-3 max-w-[calc(100vw-2rem)] z-[100]"
              side="bottom"
              trigger={
                <button type="button" className="tool-btn iconic" title="Informações" aria-label="Informações">
                  <Info className="h-[15px] w-[15px]" aria-hidden />
                </button>
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações</p>
              {music.artist && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Artista</p>
                  <p className="text-sm">{music.artist}</p>
                </div>
              )}
              {music.musical_key && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Tom Original</p>
                  <p className="text-sm font-mono font-bold">{music.musical_key}</p>
                </div>
              )}
              {hasCategories && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Categorias</p>
                  <div className="flex flex-wrap gap-1">
                    {music.categories && music.categories.length > 0
                      ? music.categories.map((cat, i) => <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>)
                      : music.category
                      ? <Badge variant="secondary" className="text-xs">{music.category}</Badge>
                      : null}
                    {music.custom_filters &&
                      Object.entries(music.custom_filters).map(([slug, group]) =>
                        group.values.map((val, i) => <Badge key={`${slug}-${i}`} variant="outline" className="text-xs">{val}</Badge>)
                      )}
                  </div>
                </div>
              )}
              {music.youtube_link && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">YouTube</p>
                  <a href={music.youtube_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                    {music.youtube_link}
                  </a>
                </div>
              )}
            </ResponsivePopover>

            {canManageLists && (
              <AddToListModal
                musicId={music.id}
                musicTitle={music.title || music.original_name}
                trigger={
                  <button type="button" className="tool-btn iconic" title="Adicionar à lista" aria-label="Adicionar à lista">
                    <Plus className="h-[14px] w-[14px]" aria-hidden />
                  </button>
                }
              />
            )}

            {isChord && (
              <>
              <button
                type="button"
                title="Mostrar/Ocultar cifras"
                className={cn('tool-btn iconic', !prefs.showChords && 'active')}
                onClick={() => updatePrefs({ showChords: !prefs.showChords })}
              >
                <Music2 className="h-[15px] w-[15px]" aria-hidden />
              </button>

              <button
                type="button"
                title={prefs.displayMode === 'fit' ? 'Desativar ajuste à tela' : 'Ajustar à tela (fit)'}
                className={cn('tool-btn iconic', prefs.displayMode === 'fit' && 'active')}
                onClick={() => updatePrefs({ displayMode: prefs.displayMode === 'fit' ? 'normal' : 'fit' })}
              >
                <Scan className="h-[14px] w-[14px]" aria-hidden />
              </button>

              <div className="tool-sep-v" aria-hidden />

              {isMobile && (
                <ResponsivePopover
                  trigger={
                    <button type="button" className="tool-btn iconic" title="Exibição e ajustes" aria-label="Exibição e ajustes">
                      <Settings className="h-[15px] w-[15px]" />
                    </button>
                  }
                >
                    <div className="space-y-4 p-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cor das cifras</p>
                        <div className="flex gap-2 flex-wrap">
                          {ACCENTS.map((a) => (
                            <button
                              key={a.value}
                              type="button"
                              title={a.name}
                              aria-label={a.name}
                              onClick={() => updatePrefs({ chordColor: a.value })}
                              className={cn(
                                'h-8 w-8 shrink-0 rounded-full border-2 transition-transform hover:scale-110',
                                prefs.chordColor === a.value ? 'border-foreground' : 'border-transparent'
                              )}
                              style={{ background: a.value }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Modo de exibição</p>
                        <div className="flex gap-1">
                          {(['normal', 'fit'] as const).map((m) => (
                            <TouchTarget
                              key={m}
                              onClick={() => updatePrefs({ displayMode: m })}
                              variant="button"
                              className={cn(
                                'flex-1 text-[11px] px-2 py-1.5 rounded border transition-colors text-center',
                                prefs.displayMode === m
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'border-border hover:bg-muted text-muted-foreground'
                              )}
                            >
                              {m === 'normal' ? 'Normal' : 'Ajuste auto'}
                            </TouchTarget>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {prefs.displayMode === 'normal' && 'Colunas automáticas conforme conteúdo'}
                          {prefs.displayMode === 'fit' && 'Reduz texto + colunas para caber na tela'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Tamanho do texto</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updatePrefs({ fontSize: Math.max(13, prefs.fontSize - 1) })}
                            className="h-8 w-8 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs font-mono flex-1 text-center">{prefs.fontSize}px</span>
                          <button
                            type="button"
                            onClick={() => updatePrefs({ fontSize: Math.min(28, prefs.fontSize + 1) })}
                            className="h-8 w-8 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ajustar à tela</p>
                        <button
                          type="button"
                          title={prefs.displayMode === 'fit' ? 'Desativar ajuste automático' : 'Ajuste automático'}
                          className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors',
                            prefs.displayMode === 'fit' ? 'bg-foreground text-background' : 'hover:bg-muted'
                          )}
                          onClick={() => updatePrefs({ displayMode: prefs.displayMode === 'fit' ? 'normal' : 'fit' })}
                        >
                          <Scan className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ocultar cabeçalhos</p>
                        <button
                          type="button"
                          aria-label={prefs.hideHeaders ? 'Mostrar cabeçalhos' : 'Ocultar cabeçalhos'}
                          onClick={() => updatePrefs({ hideHeaders: !prefs.hideHeaders })}
                          className={cn(
                            'relative h-7 w-12 rounded-full border-2 transition-colors',
                            prefs.hideHeaders ? 'bg-foreground border-foreground' : 'border-border bg-muted'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform',
                            prefs.hideHeaders && 'translate-x-5'
                          )} />
                        </button>
                      </div>
                    </div>
                  </ResponsivePopover>
                )}

                {!isMobile && (
                  <div className="relative" ref={displayRef}>
                    <button
                      type="button"
                      title="Exibição"
                      aria-label="Exibição"
                      onClick={() => setDisplayOpen((v) => !v)}
                      className={cn('tool-btn iconic', displayOpen && 'active')}
                    >
                      <Type className="h-[14px] w-[14px]" />
                    </button>
                      {displayOpen && (
                        <div className="absolute top-full right-0 mt-1 z-[200] bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-4 w-72 space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cor das cifras</p>
                            <div className="flex gap-2">
                              {ACCENTS.map((a) => (
                                <button
                                  key={a.value}
                                  title={a.name}
                                  onClick={() => updatePrefs({ chordColor: a.value })}
                                  className={cn(
                                    'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                                    prefs.chordColor === a.value ? 'border-foreground' : 'border-transparent'
                                  )}
                                  style={{ background: a.value }}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Modo de exibição</p>
                            <div className="flex gap-1">
                              {(['normal', 'fit'] as const).map((m) => (
                                <button
                                  key={m}
                                  onClick={() => updatePrefs({ displayMode: m })}
                                  className={cn(
                                    'flex-1 text-[11px] px-2 py-1.5 rounded border transition-colors',
                                    prefs.displayMode === m
                                      ? 'bg-foreground text-background border-foreground'
                                      : 'border-border hover:bg-muted text-muted-foreground'
                                  )}
                                >
                                  {m === 'normal' ? 'Normal' : 'Ajuste auto'}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {prefs.displayMode === 'normal' && 'Colunas automáticas conforme conteúdo'}
                              {prefs.displayMode === 'fit' && 'Reduz texto + colunas para caber na tela'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Tamanho do texto</p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updatePrefs({ fontSize: Math.max(13, prefs.fontSize - 1) })}
                                className="h-6 w-6 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-mono flex-1 text-center">{prefs.fontSize}px</span>
                              <button
                                type="button"
                                onClick={() => updatePrefs({ fontSize: Math.min(28, prefs.fontSize + 1) })}
                                className="h-6 w-6 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ajustar à tela</p>
                            <button
                              type="button"
                              title={prefs.displayMode === 'fit' ? 'Desativar ajuste automático' : 'Ajuste automático'}
                              className={cn(
                                'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors',
                                prefs.displayMode === 'fit' ? 'bg-foreground text-background' : 'hover:bg-muted'
                              )}
                              onClick={() => updatePrefs({ displayMode: prefs.displayMode === 'fit' ? 'normal' : 'fit' })}
                            >
                              <Scan className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ocultar cabeçalhos</p>
                            <button
                              onClick={() => updatePrefs({ hideHeaders: !prefs.hideHeaders })}
                              className={cn(
                                'relative h-5 w-9 rounded-full border-2 transition-colors',
                                prefs.hideHeaders ? 'bg-foreground border-foreground' : 'border-border bg-muted'
                              )}
                            >
                              <span className={cn(
                                'absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-background transition-transform',
                                prefs.hideHeaders && 'translate-x-4'
                              )} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                )}

              <div className="tool-sep-v" aria-hidden />

              {music.youtube_link && (
                <button
                  type="button"
                  className="tool-btn iconic"
                  title="Assistir no YouTube"
                  onClick={() => setYoutubeOpen(true)}
                >
                  <Play className="h-3 w-3" fill="currentColor" aria-hidden />
                </button>
              )}

              <button
                type="button"
                className="tool-btn iconic"
                title="Baixar PDF"
                onClick={handleDownload}
              >
                <Download className="h-[13px] w-[13px]" aria-hidden />
              </button>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={contentContainerRef}
        className={cn(
          "relative z-0 flex-1 min-h-0",
          isChord && isFitMode ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        {isChord && music.chord_content ? (
          <>
            {/* Hidden measurement clone — single column, scale 1, natural width */}
            <div
              ref={measureRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
                width: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <div className="px-6 py-4">
                <ChordPreview
                  chordContent={music.chord_content}
                  transposedKey={effectiveKey}
                  capoFret={capoFret}
                  arrangementJson={arrangementJson || undefined}
                  fontSize={prefs.fontSize}
                  showChords={prefs.showChords}
                  chordColor={prefs.chordColor}
                  columnCount={1}
                  originalKey={originalKeyResolved}
                  hideHeaders={prefs.hideHeaders}
                />
              </div>
            </div>

            <div
              className="mx-auto"
              style={{
                transform: `scale(${autoScale})`,
                transformOrigin: 'top center',
                visibility: layoutReady ? 'visible' : 'hidden',
                width: '100%',
              }}
            >
              <div className="px-6 py-4">
                <ChordPreview
                  chordContent={music.chord_content}
                  transposedKey={effectiveKey}
                  capoFret={capoFret}
                  arrangementJson={arrangementJson || undefined}
                  fontSize={prefs.fontSize}
                  showChords={prefs.showChords}
                  chordColor={prefs.chordColor}
                  columnCount={autoColumns}
                  originalKey={originalKeyResolved}
                  hideHeaders={prefs.hideHeaders}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col">
            {loadingPdf ? (
              <div className="flex items-center justify-center h-64 bg-muted/30">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Carregando PDF…</span>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <Eye className="h-10 w-10 opacity-30" />
                <p className="text-sm">Não foi possível carregar o PDF</p>
                <p className="text-xs font-mono text-destructive/70">{pdfError}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadPdf(music.id)} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                  </Button>
                </div>
              </div>
            ) : pdfUrl ? (
              isMobile ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 p-4">
                  <div className="text-center space-y-2">
                    <Eye className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="text-sm font-medium">PDF disponível</p>
                    <p className="text-xs text-muted-foreground max-w-64">
                      Toque para abrir o PDF no visualizador nativo do seu dispositivo
                    </p>
                  </div>
                  <TouchTarget
                    onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                    variant="button"
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3"
                  >
                    <Eye className="h-4 w-4" />
                    Abrir PDF
                  </TouchTarget>
                </div>
              ) : (
                <iframe src={pdfUrl} className="w-full h-full min-h-[60vh] flex-1" title="PDF" />
              )
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                PDF não disponível
              </div>
            )}

            {(music.content_type === 'pdf_only' || music.content_type === 'chord_converting') && (
              <div className="p-4 shrink-0">
                <OcrConvertCard
                  musicId={music.id}
                  contentType={music.content_type}
                  ocrStatus={music.ocr_status}
                  hasDraft={!!music.chord_content_draft}
                  canConvert={canEdit}
                  onReviewDraft={onEnterEdit}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* YouTube floating modal */}
      {youtubeOpen && music.youtube_link && (() => {
        const videoId = extractYoutubeId(music.youtube_link)
        if (!videoId) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setYoutubeOpen(false)}
          >
            <div
              className="relative bg-card rounded-xl shadow-2xl w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <TouchTarget
                onClick={() => setYoutubeOpen(false)}
                title="Fechar"
                variant="icon"
                rounded
                className="absolute -top-3 -right-3 bg-card border shadow hover:bg-muted z-10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </TouchTarget>
              <div className="rounded-xl overflow-hidden aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
