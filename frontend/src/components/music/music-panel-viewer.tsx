'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@core/components/ui/badge'
import { Button } from '@core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@core/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@core/components/ui/popover'
import {
  Download,
  Edit,
  ExternalLink,
  Eye,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@core/contexts/auth-context'
import { musicApi, handleApiError } from '@/lib/api'
import { useMusicDetail } from '@/hooks/use-music'
import { useMusicDisplayPrefs } from '@/hooks/use-music-display-prefs'
import { ChordPreview } from '@/components/music/chord-preview'
import { MusicDisplaySettings } from '@/components/music/display-settings'
import { AddToListModal } from '@/components/music/add-to-list-modal'
import { OcrConvertCard } from '@/components/music/ocr-convert-card'
import { useToast } from '@core/hooks/use-toast'
import { cn } from '@/lib/utils'

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

interface MusicPanelViewerProps {
  musicId: number
}

export function MusicPanelViewer({ musicId }: MusicPanelViewerProps) {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
  const canManageLists = hasPermission('lists:manage')

  const { data: music, isLoading, error } = useMusicDetail(musicId)

  const [prefs, updatePrefs] = useMusicDisplayPrefs()

  const [transposedKey, setTransposedKey] = useState<string | null>(null)
  const [capoFret, setCapoFret] = useState(0)
  const [arrangementJson, setArrangementJson] = useState<string | null>(null)
  const [isSavingPref, setIsSavingPref] = useState(false)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(true)
  const [pdfError, setPdfError] = useState(false)

  useEffect(() => {
    if (!music || music.content_type !== 'chord') {
      setTransposedKey(null)
      setCapoFret(0)
      setArrangementJson(null)
      return
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/files/${music.id}/preferences`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.preferences) {
            const originalKeyMatch =
              music.chord_content?.match(/^\{key:\s*([A-G][#b]?)\}/m) ||
              music.chord_content?.match(/^\{k:\s*([A-G][#b]?)\}/m)
            const originalKey = originalKeyMatch?.[1] ?? 'C'
            const originalIndex = MUSICAL_KEYS.indexOf(originalKey)
            const transposeAmount = data.preferences.transposeAmount || 0
            if (originalIndex !== -1) {
              const newIndex = (originalIndex + transposeAmount + 12) % 12
              setTransposedKey(MUSICAL_KEYS[newIndex])
            } else {
              setTransposedKey(music.musical_key || 'C')
            }
            setCapoFret(data.preferences.capoFret || 0)
            setArrangementJson(data.preferences.arrangementJson || null)
          } else {
            setTransposedKey(music.musical_key || 'C')
          }
        } else {
          setTransposedKey(music.musical_key || 'C')
        }
      } catch {
        setTransposedKey(music.musical_key || 'C')
      }
    }
    load()
  }, [music?.id])

  const savePreferences = async (newKey: string, newCapo: number, newArrangement: string | null) => {
    if (!music) return
    try {
      setIsSavingPref(true)
      const originalKeyMatch =
        music.chord_content?.match(/^\{key:\s*([A-G][#b]?)\}/m) ||
        music.chord_content?.match(/^\{k:\s*([A-G][#b]?)\}/m)
      const originalKey = originalKeyMatch?.[1] ?? 'C'
      const originalIndex = MUSICAL_KEYS.indexOf(originalKey)
      const newIndex = MUSICAL_KEYS.indexOf(newKey)
      let transposeAmount = 0
      if (originalIndex !== -1 && newIndex !== -1) {
        transposeAmount = (newIndex - originalIndex + 12) % 12
      }
      await fetch(`/api/files/${music.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transposeAmount, capoFret: newCapo, arrangementJson: newArrangement }),
      })
      setTransposedKey(newKey)
      setCapoFret(newCapo)
      setArrangementJson(newArrangement)
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar preferências.', variant: 'destructive' })
    } finally {
      setIsSavingPref(false)
    }
  }

  const transposeSemitones = (delta: number) => {
    const idx = MUSICAL_KEYS.indexOf(effectiveKey)
    const newKey = MUSICAL_KEYS[(idx + delta + 12) % 12]
    savePreferences(newKey, capoFret, arrangementJson)
  }

  useEffect(() => {
    if (music?.id && music.content_type !== 'chord') {
      loadPdf(music.id)
    } else {
      setPdfUrl(null)
      setPdfError(false)
    }
  }, [music?.id, music?.content_type])

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  const loadPdf = async (fileId: number) => {
    try {
      setLoadingPdf(true)
      setPdfError(false)
      const res = await fetch(`/api/files/${fileId}/stream`, {
        headers: { Accept: 'application/pdf' },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
    } catch {
      setPdfError(true)
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleDownload = async () => {
    if (!music) return
    try {
      const blob = await musicApi.downloadMusic(music.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = music.original_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
    }
  }

  const effectiveKey = transposedKey || music?.musical_key || 'C'

  const hasCategories =
    (music?.categories && music.categories.length > 0) ||
    !!music?.category ||
    (music?.custom_filters && Object.keys(music.custom_filters).length > 0)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 pt-5 pb-4 space-y-3">
          <div className="h-9 w-64 bg-muted rounded animate-pulse" />
          <div className="h-3.5 w-40 bg-muted rounded animate-pulse" />
          <div className="flex gap-2 mt-3">
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

  const editHref = music.content_type === 'chord'
    ? `/music/${music.id}/chord`
    : `/music/${music.id}/edit`

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Viewer head — title left, key block right */}
      <div className="shrink-0 border-b border-border bg-card px-6 pt-5 pb-4 grid grid-cols-[1fr_auto] gap-4 items-start">
        {/* Left: title + artist + pill actions */}
        <div className="min-w-0">
          <h1
            className="text-[2.5rem] leading-[1.1] font-normal break-words"
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
          >
            {music.title || music.original_name}
          </h1>
          {music.artist && (
            <p className="text-sm text-muted-foreground mt-1">{music.artist}</p>
          )}

          {/* Pill actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Informações */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border text-xs hover:bg-muted transition-colors">
                  <Info className="h-3 w-3" />
                  Informações
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-4 space-y-3">
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
                        ? music.categories.map((cat, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>
                          ))
                        : music.category
                        ? <Badge variant="secondary" className="text-xs">{music.category}</Badge>
                        : null}
                      {music.custom_filters &&
                        Object.entries(music.custom_filters).map(([slug, group]) =>
                          group.values.map((val, i) => (
                            <Badge key={`${slug}-${i}`} variant="outline" className="text-xs">{val}</Badge>
                          ))
                        )}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Adicionar à lista */}
            {canManageLists && (
              <AddToListModal
                musicId={music.id}
                musicTitle={music.title || music.original_name}
                trigger={
                  <button className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border text-xs hover:bg-muted transition-colors">
                    <Plus className="h-3 w-3" />
                    Adicionar à lista
                  </button>
                }
              />
            )}

            {/* Edit */}
            {canEdit && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border text-xs hover:bg-muted transition-colors"
              >
                <Edit className="h-3 w-3" />
                Editar
              </Link>
            )}

            {/* More */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-border hover:bg-muted transition-colors">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Mais ações</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/music/${music.id}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right: key block — chord only */}
        {music.content_type === 'chord' && (
          <div className="text-right shrink-0 pt-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Tom</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-[1.375rem] font-bold leading-none hover:opacity-70 transition-opacity"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {effectiveKey}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-2 w-auto">
                <div className="grid grid-cols-4 gap-1">
                  {MUSICAL_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => savePreferences(k, capoFret, arrangementJson)}
                      className={cn(
                        'h-8 w-8 rounded text-xs font-mono font-bold hover:bg-muted transition-colors',
                        k === effectiveKey && 'bg-foreground text-background'
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {capoFret > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">Capo {capoFret}</p>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto relative">
        {music.content_type === 'chord' && music.chord_content ? (
          <>
            {isSavingPref && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-6 py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando…
              </div>
            )}
            <div className="px-6 py-4">
              <ChordPreview
                chordContent={music.chord_content}
                transposedKey={effectiveKey}
                capoFret={capoFret}
                arrangementJson={arrangementJson || undefined}
                fontSize={prefs.fontSize}
                showChords={prefs.showChords}
                chordColor={prefs.chordColor}
                columnView={prefs.columnView}
              />
            </div>

            {/* Floating sticky toolbar */}
            <div className="sticky bottom-4 flex justify-center pointer-events-none px-4 pb-1">
              <div className="pointer-events-auto inline-flex items-center gap-0.5 px-3 py-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg">
                {/* Key stepper */}
                <button
                  onClick={() => transposeSemitones(-1)}
                  className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-sm leading-none transition-colors"
                  aria-label="Semitom abaixo"
                >
                  −
                </button>
                <span
                  className="text-xs font-bold w-8 text-center"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {effectiveKey}
                </span>
                <button
                  onClick={() => transposeSemitones(1)}
                  className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-sm leading-none transition-colors"
                  aria-label="Semitom acima"
                >
                  +
                </button>

                <div className="w-px h-3.5 bg-border mx-1.5" />

                {/* Capo popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-6 px-2 rounded-full hover:bg-muted text-xs transition-colors text-muted-foreground hover:text-foreground whitespace-nowrap">
                      {capoFret > 0 ? `Capo ${capoFret}` : 'Capo'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="center" side="top" className="w-auto p-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => savePreferences(effectiveKey, 0, arrangementJson)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-sm transition-colors"
                        title="Remover capo"
                      >
                        ×
                      </button>
                      <button
                        onClick={() => savePreferences(effectiveKey, Math.max(0, capoFret - 1), arrangementJson)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-base leading-none transition-colors"
                      >
                        −
                      </button>
                      <span
                        className="text-sm font-bold w-5 text-center"
                        style={{ fontFamily: 'var(--font-mono, monospace)' }}
                      >
                        {capoFret}
                      </span>
                      <button
                        onClick={() => savePreferences(effectiveKey, Math.min(9, capoFret + 1), arrangementJson)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-base leading-none transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="w-px h-3.5 bg-border mx-1.5" />

                {/* Display settings */}
                <MusicDisplaySettings
                  fontSize={prefs.fontSize}
                  setFontSize={(v) => updatePrefs({ fontSize: v })}
                  showChords={prefs.showChords}
                  setShowChords={(v) => updatePrefs({ showChords: v })}
                  chordColor={prefs.chordColor}
                  setChordColor={(v) => updatePrefs({ chordColor: v })}
                  columnView={prefs.columnView}
                  setColumnView={(v) => updatePrefs({ columnView: v })}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full">
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadPdf(music.id)} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
                  </Button>
                </div>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full min-h-[60vh]" title="PDF" />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                PDF não disponível
              </div>
            )}
          </div>
        )}

        {(music.content_type === 'pdf_only' || music.content_type === 'chord_converting') && (
          <div className="p-4">
            <OcrConvertCard
              musicId={music.id}
              contentType={music.content_type}
              ocrStatus={music.ocr_status}
              canConvert={canEdit}
            />
          </div>
        )}
      </div>
    </div>
  )
}
