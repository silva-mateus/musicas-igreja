'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Badge } from '@core/components/ui/badge'
import { ArrowLeft, Download, Edit, Trash2, ExternalLink, Music, User, Tag, Calendar, PlayCircle, Eye, Plus, RefreshCw } from 'lucide-react'
import { useToast } from '@core/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@core/components/ui/tooltip'
import Link from 'next/link'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError } from '@/lib/api'
import { AddToListModal } from '@/components/music/add-to-list-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '@core/contexts/auth-context'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'

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

    const [music, setMusic] = useState<MusicType | null>(null)
    const [loading, setLoading] = useState(true)
    const [pdfError, setPdfError] = useState(false)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [loadingPdf, setLoadingPdf] = useState(true)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const musicId = params.id as string

    useEffect(() => {
        if (musicId) loadMusic()
    }, [musicId])

    const loadMusic = async () => {
        try {
            setLoading(true)
            const musicData = await musicApi.getMusic(parseInt(musicId))
            setMusic(musicData)

            // Carregar PDF como blob para evitar problemas de CORS
            loadPdf(musicData.id)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
            router.push('/music')
        } finally {
            setLoading(false)
        }
    }

    const loadPdf = async (fileId: number) => {
        try {
            setLoadingPdf(true)
            setPdfError(false)

            const response = await fetch(`/api/files/${fileId}/stream`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf',
                },
                cache: 'no-store'
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('[Music] Error response:', errorText)
                throw new Error(`Falha ao carregar PDF: ${response.status} ${response.statusText}`)
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            setPdfUrl(url)
        } catch (error) {
            console.error('[Music] Error loading PDF:', error)
            setPdfError(true)
        } finally {
            setLoadingPdf(false)
        }
    }

    // Cleanup do blob URL quando o componente desmontar
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
            }
        }
    }, [pdfUrl])

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
            toast({ title: 'Download concluído', description: `Arquivo ${music.original_name} baixado com sucesso` })
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        }
    }

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!music) return
        try {
            setIsDeleting(true)
            await musicApi.deleteMusic(music.id)
            toast({ title: 'Música excluída', description: 'A música foi removida com sucesso' })
            router.push('/music')
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Carregando...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!music) return null

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header + ações */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <Button variant="outline" size="sm" asChild className="self-start">
                            <Link href="/music">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Voltar
                            </Link>
                        </Button>
                        <div className="text-sm text-muted-foreground truncate">
                            <Link href="/music" className="hover:text-primary">Músicas</Link>
                            <span className="mx-2">/</span>
                            <span className="underline truncate">{music.title}</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold break-words">{music.title}</h1>
                            {music.artist && (
                                <p className="text-lg sm:text-xl text-muted-foreground flex items-center gap-2 mt-2">
                                    <User className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                                    <span className="truncate">{music.artist}</span>
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {music.categories && music.categories.length > 0 ? (
                                    music.categories.map((cat, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs sm:text-sm">
                                            <Tag className="h-3 w-3 mr-1 shrink-0" />{cat}
                                        </Badge>
                                    ))
                                ) : music.category ? (
                                    <Badge variant="secondary" className="text-xs sm:text-sm">
                                        <Tag className="h-3 w-3 mr-1 shrink-0" />{music.category}
                                    </Badge>
                                ) : null}

                                {music.custom_filters && Object.entries(music.custom_filters).map(([slug, group]) =>
                                    group.values.map((val, idx) => (
                                        <Badge key={`${slug}-${idx}`} variant="outline" className="text-xs sm:text-sm">
                                            <Calendar className="h-3 w-3 mr-1 shrink-0" />{val}
                                        </Badge>
                                    ))
                                )}

                                {music.musical_key && (
                                    <Badge variant="outline" className="text-xs sm:text-sm">
                                        <Music className="h-3 w-3 mr-1 shrink-0" />Tom: {music.musical_key}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        
                        {/* Actions - Desktop: inline, Mobile: grid */}
                        <TooltipProvider>
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 shrink-0 items-center">
                                <InstructionsModal
                                    title={PAGE_INSTRUCTIONS.musicDetails.title}
                                    description={PAGE_INSTRUCTIONS.musicDetails.description}
                                    sections={PAGE_INSTRUCTIONS.musicDetails.sections}
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                            <Eye className="h-4 w-4" />
                                            <span className="hidden sm:inline">Visualizar PDF</span>
                                            <span className="sm:hidden">Ver PDF</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Abrir PDF em nova aba</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                            <Download className="h-4 w-4" />
                                            <span>Download</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Baixar arquivo PDF</p>
                                    </TooltipContent>
                                </Tooltip>

                                {canEdit && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline" size="sm" asChild className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                                <Link href={`/music/${music.id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                    <span>Editar</span>
                                                </Link>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Editar informações da música</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}

                                {canDelete && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive gap-1 sm:gap-2 text-xs sm:text-sm" onClick={handleDeleteClick}>
                                                <Trash2 className="h-4 w-4" />
                                                <span>Excluir</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Excluir esta música</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AddToListModal
                                            musicId={music.id}
                                            musicTitle={music.title || music.original_name}
                                            trigger={
                                                <Button variant="default" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm col-span-2 sm:col-span-1">
                                                    <Plus className="h-4 w-4" />
                                                    <span>Adicionar à lista</span>
                                                </Button>
                                            }
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Adicionar música a uma lista</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Conteúdo em 2 colunas: PDF + info à direita */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader><CardTitle>PDF</CardTitle></CardHeader>
                            <CardContent>
                                <div className="rounded-lg overflow-hidden border">
                                    {loadingPdf ? (
                                        <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                                <p className="text-muted-foreground">
                                                    Carregando PDF...
                                                </p>
                                            </div>
                                        </div>
                                    ) : pdfError ? (
                                        <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                            <div className="text-center">
                                                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground mb-2">
                                                    Não foi possível carregar o PDF
                                                </p>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    Tente abrir em uma nova aba
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => loadPdf(music.id)}
                                                        className="gap-2"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                        Tentar novamente
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')}
                                                        className="gap-2"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Abrir em nova aba
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : pdfUrl ? (
                                        <iframe
                                            src={pdfUrl}
                                            className="w-full h-[80vh]"
                                            title="PDF"
                                        />
                                    ) : (
                                        <div className="w-full h-[80vh] flex items-center justify-center bg-muted">
                                            <div className="text-center">
                                                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground">
                                                    PDF não disponível
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Informações do Arquivo</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <span className="text-sm font-medium shrink-0">Nome do arquivo:</span>
                                    <span className="text-sm text-muted-foreground break-all sm:text-right">{music.original_name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Tamanho:</span>
                                    <span className="text-sm text-muted-foreground">{(music.file_size / 1024).toFixed(2)} KB</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Páginas:</span>
                                    <span className="text-sm text-muted-foreground">{music.pages}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Upload:</span>
                                    <span className="text-sm text-muted-foreground">{new Date(music.upload_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                                {music.youtube_link && (
                                    <div>
                                        <span className="text-sm font-medium block mb-1">YouTube:</span>
                                        <a href={music.youtube_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 break-all">
                                            <ExternalLink className="h-3 w-3 shrink-0" /> Abrir no YouTube
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {isValidYouTube(music.youtube_link) && (
                            <Card>
                                <CardHeader><CardTitle>Vídeo</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="rounded-lg overflow-hidden aspect-video">
                                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${new URL(music.youtube_link!).searchParams.get('v') || ''}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Confirmar Exclusão"
                description={`Tem certeza que deseja excluir a música "${music?.title || 'esta música'}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                variant="destructive"
                onConfirm={handleDeleteConfirm}
                loading={isDeleting}
            />
        </MainLayout>
    )
}