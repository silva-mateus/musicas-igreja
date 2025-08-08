'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    ArrowLeft,
    Download,
    Edit,
    Trash2,
    ExternalLink,
    Music,
    User,
    Tag,
    Calendar,
    Clock,
    FileText,
    PlayCircle,
    Eye,
    Share
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError } from '@/lib/api'

export default function MusicDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { isAuthenticated, isLoading: authLoading } = useRequireAuth()
    const { toast } = useToast()

    const [music, setMusic] = useState<MusicType | null>(null)
    const [loading, setLoading] = useState(true)
    const [showPdfViewer, setShowPdfViewer] = useState(false)

    const musicId = params.id as string

    useEffect(() => {
        if (isAuthenticated && musicId) {
            loadMusic()
        }
    }, [isAuthenticated, musicId])

    const loadMusic = async () => {
        try {
            setLoading(true)
            const musicData = await musicApi.getMusic(parseInt(musicId))
            setMusic(musicData)
        } catch (error) {
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive"
            })
            router.push('/music')
        } finally {
            setLoading(false)
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

            toast({
                title: "Download concluído",
                description: `Arquivo ${music.original_name} baixado com sucesso`
            })
        } catch (error) {
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive"
            })
        }
    }

    const handleDelete = async () => {
        if (!music || !confirm('Tem certeza que deseja excluir esta música?')) {
            return
        }

        try {
            await musicApi.deleteMusic(music.id)
            toast({
                title: "Música excluída",
                description: "A música foi removida com sucesso"
            })
            router.push('/music')
        } catch (error) {
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive"
            })
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (authLoading || loading) {
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

    if (!isAuthenticated || !music) {
        return null
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Back Button */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/music">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar
                        </Link>
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        <Link href="/music" className="hover:text-primary">Músicas</Link>
                        <span className="mx-2">/</span>
                        <span>{music.title}</span>
                    </div>
                </div>

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            {music.title}
                        </h1>
                        {music.artist && (
                            <p className="text-xl text-muted-foreground flex items-center gap-2 mb-4">
                                <User className="h-5 w-5" />
                                {music.artist}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {music.category && (
                                <Badge variant="secondary" className="text-sm">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {music.category}
                                </Badge>
                            )}
                            {music.liturgical_time && (
                                <Badge variant="outline" className="text-sm">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {music.liturgical_time}
                                </Badge>
                            )}
                            {music.musical_key && (
                                <Badge variant="outline" className="text-sm">
                                    <Music className="h-3 w-3 mr-1" />
                                    Tom: {music.musical_key}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        {music.youtube_link && (
                            <Button variant="outline" asChild>
                                <a href={music.youtube_link} target="_blank" rel="noopener noreferrer">
                                    <PlayCircle className="h-4 w-4 mr-2" />
                                    YouTube
                                </a>
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setShowPdfViewer(!showPdfViewer)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {showPdfViewer ? 'Ocultar PDF' : 'Visualizar PDF'}
                        </Button>
                        <Button variant="outline" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={`/music/${music.id}/edit`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                        </Button>
                    </div>
                </div>

                {/* PDF Viewer */}
                {showPdfViewer && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Visualização do PDF</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-gray-100 rounded-lg p-8 text-center">
                                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Visualizador PDF</h3>
                                <p className="text-muted-foreground mb-4">
                                    Funcionalidade em desenvolvimento
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Em breve você poderá visualizar o PDF diretamente aqui
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Description */}
                        {music.observations && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Descrição</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-700 leading-relaxed">
                                        {music.observations}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Ações Rápidas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Button variant="outline" className="justify-start">
                                        <Share className="h-4 w-4 mr-2" />
                                        Adicionar à Lista
                                    </Button>
                                    <Button variant="outline" className="justify-start">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Duplicar Música
                                    </Button>
                                    <Button variant="outline" className="justify-start">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Gerar Relatório
                                    </Button>
                                    <Button variant="outline" className="justify-start">
                                        <Share className="h-4 w-4 mr-2" />
                                        Compartilhar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* File Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações do Arquivo</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Nome do arquivo:</span>
                                    <span className="text-sm text-muted-foreground truncate ml-2">
                                        {music.original_name}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Tamanho:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatFileSize(music.file_size)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Páginas:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {music.pages}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Data de upload:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatDate(music.upload_date)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Metadados</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {music.category && (
                                    <div>
                                        <span className="text-sm font-medium block mb-1">Categoria:</span>
                                        <Badge variant="secondary">{music.category}</Badge>
                                    </div>
                                )}
                                {music.liturgical_time && (
                                    <div>
                                        <span className="text-sm font-medium block mb-1">Tempo Litúrgico:</span>
                                        <Badge variant="outline">{music.liturgical_time}</Badge>
                                    </div>
                                )}
                                {music.musical_key && (
                                    <div>
                                        <span className="text-sm font-medium block mb-1">Tom Musical:</span>
                                        <Badge variant="outline">{music.musical_key}</Badge>
                                    </div>
                                )}
                                {music.youtube_link && (
                                    <div>
                                        <span className="text-sm font-medium block mb-1">YouTube:</span>
                                        <a
                                            href={music.youtube_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Assistir vídeo
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Atividade Recente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Adicionada em {formatDate(music.upload_date)}
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Eye className="h-3 w-3" />
                                        Visualizada 12 vezes
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Download className="h-3 w-3" />
                                        Baixada 5 vezes
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}