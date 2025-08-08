'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    ArrowLeft,
    Save,
    X,
    Music,
    User,
    Tag,
    Calendar,
    Link as LinkIcon,
    FileText
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError } from '@/lib/api'

const CATEGORIES = [
    'Adoração', 'Louvor', 'Comunhão', 'Entrada', 'Ofertório', 'Final', 'Santíssimo', 'Missa'
]

const LITURGICAL_TIMES = [
    'Advento', 'Natal', 'Quaresma', 'Páscoa', 'Tempo Comum'
]

const MUSICAL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
]

interface FormData {
    song_name: string
    artist: string
    category: string
    liturgical_time: string
    musical_key: string
    youtube_link: string
    observations: string
}

export default function EditMusicPage() {
    const params = useParams()
    const router = useRouter()
    const { isAuthenticated, isLoading: authLoading } = useRequireAuth()
    const { toast } = useToast()

    const [music, setMusic] = useState<MusicType | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    const [formData, setFormData] = useState<FormData>({
        song_name: '',
        artist: '',
        category: '',
        liturgical_time: '',
        musical_key: '',
        youtube_link: '',
        observations: ''
    })

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
            setFormData({
                song_name: musicData.title || '',
                artist: musicData.artist || '',
                category: musicData.category || '',
                liturgical_time: musicData.liturgical_time || '',
                musical_key: musicData.musical_key || '',
                youtube_link: musicData.youtube_link || '',
                observations: musicData.observations || ''
            })
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

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        if (!music) return

        // Validation
        if (!formData.song_name.trim()) {
            toast({
                title: "Erro",
                description: "Nome da música é obrigatório",
                variant: "destructive"
            })
            return
        }

        try {
            setSaving(true)

            await musicApi.updateMusic(music.id, {
                title: formData.song_name,
                artist: formData.artist,
                category: formData.category,
                liturgical_time: formData.liturgical_time,
                musical_key: formData.musical_key,
                youtube_link: formData.youtube_link,
                observations: formData.observations
            })

            toast({
                title: "Sucesso",
                description: "Música atualizada com sucesso!"
            })

            setHasChanges(false)
            router.push(`/music/${musicId}`)

        } catch (error) {
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive"
            })
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        if (hasChanges) {
            if (confirm('Você tem alterações não salvas. Deseja realmente cancelar?')) {
                router.push(`/music/${musicId}`)
            }
        } else {
            router.push(`/music/${musicId}`)
        }
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
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        <Link href="/music" className="hover:text-primary">Músicas</Link>
                        <span className="mx-2">/</span>
                        <Link href={`/music/${musicId}`} className="hover:text-primary">{music.title}</Link>
                        <span className="mx-2">/</span>
                        <span>Editar</span>
                    </div>
                </div>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Editar Música
                        </h1>
                        <p className="text-gray-600">
                            Atualize as informações da música
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={saving}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving || !hasChanges}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações Básicas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Song Name */}
                                <div>
                                    <Label htmlFor="song_name">Nome da Música *</Label>
                                    <div className="relative mt-1">
                                        <Music className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="song_name"
                                            value={formData.song_name}
                                            onChange={(e) => handleInputChange('song_name', e.target.value)}
                                            placeholder="Nome da música"
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Artist */}
                                <div>
                                    <Label htmlFor="artist">Artista/Compositor</Label>
                                    <div className="relative mt-1">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="artist"
                                            value={formData.artist}
                                            onChange={(e) => handleInputChange('artist', e.target.value)}
                                            placeholder="Nome do artista ou compositor"
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                {/* Category and Liturgical Time */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="category">Categoria</Label>
                                        <div className="relative mt-1">
                                            <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                                            <select
                                                id="category"
                                                value={formData.category}
                                                onChange={(e) => handleInputChange('category', e.target.value)}
                                                className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background"
                                            >
                                                <option value="">Selecione uma categoria</option>
                                                {CATEGORIES.map(category => (
                                                    <option key={category} value={category}>
                                                        {category}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="liturgical_time">Tempo Litúrgico</Label>
                                        <div className="relative mt-1">
                                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                                            <select
                                                id="liturgical_time"
                                                value={formData.liturgical_time}
                                                onChange={(e) => handleInputChange('liturgical_time', e.target.value)}
                                                className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background"
                                            >
                                                <option value="">Selecione um tempo</option>
                                                {LITURGICAL_TIMES.map(time => (
                                                    <option key={time} value={time}>
                                                        {time}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Musical Key */}
                                <div>
                                    <Label htmlFor="musical_key">Tom Musical</Label>
                                    <div className="relative mt-1">
                                        <Music className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                                        <select
                                            id="musical_key"
                                            value={formData.musical_key}
                                            onChange={(e) => handleInputChange('musical_key', e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background"
                                        >
                                            <option value="">Selecione um tom</option>
                                            {MUSICAL_KEYS.map(key => (
                                                <option key={key} value={key}>
                                                    {key}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* YouTube Link */}
                                <div>
                                    <Label htmlFor="youtube_link">Link do YouTube</Label>
                                    <div className="relative mt-1">
                                        <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="youtube_link"
                                            type="url"
                                            value={formData.youtube_link}
                                            onChange={(e) => handleInputChange('youtube_link', e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <Label htmlFor="description">Descrição</Label>
                                    <div className="relative mt-1">
                                        <Textarea
                                            id="description"
                                            value={formData.observations}
                                            onChange={(e) => handleInputChange('observations', e.target.value)}
                                            placeholder="Descrição adicional sobre a música..."
                                            rows={4}
                                        />
                                    </div>
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
                                <div>
                                    <span className="text-sm font-medium block mb-1">Nome original:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {music.original_name}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Tamanho:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {(music.file_size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Páginas:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {music.pages}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Upload:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(music.upload_date).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Ações</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button variant="outline" className="w-full justify-start">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Visualizar PDF
                                </Button>
                                <Button variant="outline" className="w-full justify-start" asChild>
                                    <Link href={`/music/${musicId}`}>
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Ver Detalhes
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Help */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Dicas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p>• O nome da música é obrigatório</p>
                                    <p>• Use categorias para organizar melhor</p>
                                    <p>• Links do YouTube devem ser válidos</p>
                                    <p>• Descrições ajudam na busca</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}