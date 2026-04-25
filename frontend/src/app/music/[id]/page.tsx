'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Badge } from '@core/components/ui/badge'
import {
    ArrowLeft,
    Download,
    Edit,
    Trash2,
    ExternalLink,
    Music,
    Music2,
    User,
    Tag,
    Calendar,
    PlayCircle,
    Eye,
    Plus,
    RefreshCw,
    MoreVertical,
    Info,
    ChevronLeft,
    ChevronUp,
    Settings,
    Settings2,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Minimize2
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@core/components/ui/popover';
import { useToast } from '@core/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@core/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@core/components/ui/dropdown-menu'
import { Slider } from '@core/components/ui/slider'
import { Switch } from '@core/components/ui/switch'
import Link from 'next/link'
import { useAuth } from '@core/contexts/auth-context'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError, downloadFile } from '@/lib/api'
import { useMusicDetail } from '@/hooks/use-music'
import { AddToListModal } from '@/components/music/add-to-list-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { ChordPreview } from '@/components/music/chord-preview'
import { OcrConvertCard } from '@/components/music/ocr-convert-card'
import { TranspositionControls } from '@/components/music/transposition-controls'
import { parseChordProDocument } from '@/lib/chordpro'
import { MusicDisplaySettings } from '@/components/music/display-settings'
import { useMusicDisplayPrefs } from '@/hooks/use-music-display-prefs'
import { FloatingZoomControls } from '@/components/music/floating-zoom-controls'

function isValidYouTube(url?: string) {
    if (!url) return false
    try {
        const u = new URL(url)
        return u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')
    } catch {
        return false
    }
}

export default function MusicDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canDelete = hasPermission('music:delete')
    const canManageLists = hasPermission('lists:manage')

    const musicId = parseInt(params.id as string)
    const { data: music, isLoading: loading, error } = useMusicDetail(musicId)

    const [pdfError, setPdfError] = useState(false)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [loadingPdf, setLoadingPdf] = useState(true)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showFileInfo, setShowFileInfo] = useState(false)

    // User Preferences State
    const [userPrefKey, setUserPrefKey] = useState<string | null>(null)
    const [userPrefCapo, setUserPrefCapo] = useState<number>(0)
    const [userArrangement, setUserArrangement] = useState<string | null>(null)
    const [isSavingPref, setIsSavingPref] = useState(false)
    const [isEditArrangement, setIsEditArrangement] = useState(false)

    // Display Settings State — persisted in localStorage
    const [displayPrefs, updateDisplayPrefs] = useMusicDisplayPrefs()
    const fontSize = displayPrefs.fontSize
    const showChords = displayPrefs.showChords
    const chordColor = displayPrefs.chordColor
    const columnView = displayPrefs.columnView
    const setFontSize = (v: number) => updateDisplayPrefs({ fontSize: v })
    const setShowChords = (v: boolean) => updateDisplayPrefs({ showChords: v })
    const setChordColor = (v: string) => updateDisplayPrefs({ chordColor: v })
    const setColumnView = (v: boolean) => updateDisplayPrefs({ columnView: v })

    // Load preferences
    useEffect(() => {
        if (!music || music.content_type !== 'chord') return;
        
        const fetchPreferences = async () => {
            try {
                const data = await musicApi.getPreferences(music.id)
                if (data.success && data.preferences) {
                    const originalKeyMatch = music.chord_content?.match(/^\{key:\s*([A-G][#b]?)\}/m) || music.chord_content?.match(/^\{k:\s*([A-G][#b]?)\}/m)
                    const originalKey = originalKeyMatch ? originalKeyMatch[1] : 'C'
                    
                    const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    const originalIndex = MUSICAL_KEYS.indexOf(originalKey)
                    const prefTranspose = data.preferences.transpose_amount || 0
                    
                    if (originalIndex !== -1) {
                        const newIndex = (originalIndex + prefTranspose) % 12
                        setUserPrefKey(MUSICAL_KEYS[newIndex < 0 ? newIndex + 12 : newIndex])
                    } else {
                        setUserPrefKey(music.musical_key || 'C')
                    }
                    
                    setUserPrefCapo(data.preferences.capo_fret || 0)
                    setUserArrangement(data.preferences.arrangement_json || null)
                }
            } catch (err) {
                console.error("Failed to load user preferences", err)
            }
        }
        
        fetchPreferences()
    }, [music])

    // Save preferences
    const savePreferences = async (newKey: string, newCapo: number, newArrangement: string | null) => {
        if (!music) return;
        try {
            const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            
            const originalKeyMatch = music.chord_content?.match(/^\{key:\s*([A-G][#b]?)\}/m) || music.chord_content?.match(/^\{k:\s*([A-G][#b]?)\}/m)
            const originalKey = originalKeyMatch ? originalKeyMatch[1] : 'C'
            
            const originalIndex = MUSICAL_KEYS.indexOf(originalKey)
            const newIndex = MUSICAL_KEYS.indexOf(newKey)
            
            let transpose_amount = 0
            if (originalIndex !== -1 && newIndex !== -1) {
                transpose_amount = (newIndex - originalIndex + 12) % 12
            }
            
            await musicApi.updatePreferences(music.id, {
                transpose_amount,
                capo_fret: newCapo,
                arrangement_json: newArrangement || undefined
            })
            
            setUserPrefKey(newKey)
            setUserPrefCapo(newCapo)
            setUserArrangement(newArrangement)
        } catch (err) {
            console.error("Failed to save user preferences", err)
            toast({ title: 'Erro', description: 'Não foi possível salvar suas preferências.', variant: 'destructive' })
        }
    }

    useEffect(() => {
        if (music?.id && music.content_type !== 'chord') {
            loadPdf(music.id)
        }
    }, [music?.id, music?.content_type])

    const handleDownload = async () => {
        if (!music) return;
        try {
            const blob = await musicApi.downloadMusic(music.id);
            downloadFile(blob, music.filename || `${music.title}.pdf`);
            toast({ title: 'Sucesso', description: 'Download iniciado.' });
        } catch (err) {
            console.error("Download failed:", err);
            toast({ title: 'Erro', description: 'Falha ao baixar o arquivo.', variant: 'destructive' });
        }
    }

    const handleDeleteConfirm = async () => {
        if (!music) return;
        try {
            setIsDeleting(true)
            await musicApi.deleteMusic(music.id)
            toast({ title: 'Sucesso', description: 'Música excluída com sucesso.' })
            router.push('/music')
        } catch (err) {
            console.error("Delete failed:", err)
            toast({ title: 'Erro', description: 'Não foi possível excluir a música.', variant: 'destructive' })
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
        }
    }

    const handleDeleteClick = (e?: React.MouseEvent) => {
        if (e) e.preventDefault()
        setDeleteDialogOpen(true)
    }

    const loadPdf = async (id: number) => {
        try {
            setLoadingPdf(true)
            setPdfError(false)
            const blob = await musicApi.downloadMusic(id)
            const url = URL.createObjectURL(blob)
            setPdfUrl(url)
        } catch (error) {
            console.error('[Music] Error loading PDF:', error)
            setPdfError(true)
        } finally {
            setLoadingPdf(false)
        }
    }

    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
            }
        }
    }, [pdfUrl])

    if (loading) {
        return (
            <MainLayout>
                <LoadingOverlay message="Carregando música..." />
            </MainLayout>
        )
    }

    if (!music) return null

    return (
        <MainLayout className={isFullscreen ? 'p-0' : 'p-4 sm:p-6'}>
            <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-[100] bg-background overflow-auto p-4 sm:p-8' : ''}`}>
                {/* Compact Song Header — Songbook Pro inspired */}
                <div className={`flex items-center gap-3 ${isFullscreen ? 'opacity-20 hover:opacity-100 transition-opacity absolute top-4 left-4 right-4 z-10 bg-background/80 backdrop-blur-md p-2 rounded-xl border border-border shadow-lg' : ''}`}>
                    <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => isFullscreen ? setIsFullscreen(false) : router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Voltar</span>
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold truncate">{music.title}</h1>
                        {music.artist && (
                            <p className="text-sm text-muted-foreground truncate">{music.artist}</p>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                        </Button>

                        {/* Display Settings */}
                        {music.content_type === 'chord' && (
                            <MusicDisplaySettings
                                fontSize={fontSize}
                                setFontSize={setFontSize}
                                showChords={showChords}
                                setShowChords={setShowChords}
                                chordColor={chordColor}
                                setChordColor={setChordColor}
                                columnView={columnView}
                                setColumnView={setColumnView}
                            />
                        )}

                        <div className="hidden sm:flex items-center gap-2">
                            {userPrefCapo > 0 && (
                                <Badge variant="secondary" className="gap-1 px-2 py-1 h-8 animate-in fade-in zoom-in duration-300">
                                    <ChevronUp className="w-3 h-3" />
                                    Capo {userPrefCapo}
                                </Badge>
                            )}

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 h-9 border-primary/20 hover:border-primary/50 transition-colors">
                                        <Music2 className="w-4 h-4 text-primary" />
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Tom</span>
                                            <span className="font-bold">{userPrefKey || music.musical_key || 'C'}</span>
                                        </div>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4" align="end">
                                    <TranspositionControls
                                        originalKey={music.musical_key}
                                        transposedKey={userPrefKey || music.musical_key || 'C'}
                                        capoFret={userPrefCapo}
                                        onKeyChange={(k) => savePreferences(k, userPrefCapo, userArrangement)}
                                        onCapoChange={(c) => savePreferences(userPrefKey || music.musical_key || 'C', c, userArrangement)}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Overflow menu for secondary actions */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9">
                                    <MoreVertical className="h-5 w-5" />
                                    <span className="sr-only">Mais ações</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualizar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDownload}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                </DropdownMenuItem>
                                {canEdit && (
                                    <DropdownMenuItem asChild>
                                        <Link href={music.content_type === 'chord' ? `/music/${music.id}/chord` : `/music/${music.id}/edit`}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            {music.content_type === 'chord' ? 'Editar Cifra' : 'Editar'}
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                {canManageLists && (
                                    <AddToListModal
                                        musicId={music.id}
                                        musicTitle={music.title || music.original_name}
                                        trigger={
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Adicionar à lista
                                            </DropdownMenuItem>
                                        }
                                    />
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowFileInfo(!showFileInfo)}>
                                    <Info className="h-4 w-4 mr-2" />
                                    {showFileInfo ? 'Ocultar informações' : 'Informações do arquivo'}
                                </DropdownMenuItem>
                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteClick}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Excluir
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* File Info Panel */}
                {showFileInfo && (
                    <Card className="animate-in slide-in-from-top duration-300">
                        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Formato</p>
                                <p className="font-medium uppercase">{music.content_type}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Tom Original</p>
                                <p className="font-medium">{music.musical_key || 'Não informado'}</p>
                            </div>
                            {music.file_size > 0 && (
                                <div>
                                    <p className="text-muted-foreground">Tamanho</p>
                                    <p className="font-medium">{(music.file_size / 1024).toFixed(1)} KB</p>
                                </div>
                            )}
                            <div>
                                <p className="text-muted-foreground">Adicionado em</p>
                                <p className="font-medium">{music.upload_date ? new Date(music.upload_date).toLocaleDateString() : '?'}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Main content area */}
                {music.content_type === 'chord' && music.chord_content ? (
                    <div className={`space-y-3 ${isFullscreen ? 'mt-16' : ''}`}>

                        <ChordPreview
                            chordContent={music.chord_content}
                            transposedKey={userPrefKey || music.musical_key || 'C'}
                            capoFret={userPrefCapo}
                            arrangementJson={userArrangement || undefined}
                            fontSize={fontSize}
                            showChords={showChords}
                            chordColor={chordColor}
                            columnView={columnView}
                        />

                        <FloatingZoomControls 
                            onZoomIn={() => setFontSize(prev => Math.min(prev + 2, 40))}
                            onZoomOut={() => setFontSize(prev => Math.max(prev - 2, 10))}
                            onReset={() => setFontSize(16)}
                            onFitToPage={() => setColumnView(!columnView)}
                        />
                    </div>
                ) : (
                    <div className={`rounded-lg overflow-hidden border border-border ${isFullscreen ? 'h-full' : ''}`}>
                        {loadingPdf ? (
                            <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                <LoadingOverlay message="Carregando PDF..." />
                            </div>
                        ) : pdfError ? (
                            <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                <div className="text-center">
                                    <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground mb-2">Não foi possível carregar o PDF</p>
                                    <div className="flex gap-2 justify-center">
                                        <Button variant="outline" onClick={() => loadPdf(music.id)} className="gap-2">
                                            <RefreshCw className="h-4 w-4" /> Tentar novamente
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : pdfUrl ? (
                            <iframe src={pdfUrl} className="w-full h-[80vh]" title="PDF" />
                        ) : (
                            <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                <p className="text-muted-foreground">PDF não disponível</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Confirmar Exclusão"
                description={`Tem certeza que deseja excluir "${music?.title || 'esta música'}"?`}
                confirmText="Excluir"
                cancelText="Cancelar"
                variant="destructive"
                onConfirm={handleDeleteConfirm}
                loading={isDeleting}
            />
        </MainLayout>
    )
}
