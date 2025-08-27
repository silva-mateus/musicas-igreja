'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Autocomplete } from '@/components/ui/autocomplete'
import { ArrowLeft, Save, X, Music, User, Tag, Calendar, Link as LinkIcon, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError } from '@/lib/api'
import { UploadZone } from '@/components/upload/upload-zone'

const CATEGORIES = ['Adoração', 'Louvor', 'Comunhão', 'Entrada', 'Ofertório', 'Final', 'Santíssimo', 'Missa']
const LITURGICAL_TIMES = ['Advento', 'Natal', 'Quaresma', 'Páscoa', 'Tempo Comum']
const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

interface FormData {
    song_name: string
    artist: string
    categories: string[]
    liturgical_times: string[]
    musical_key: string
    youtube_link: string
    observations: string
}

interface FilterSuggestions {
    categories: string[]
    liturgical_times: string[]
    artists: string[]
    musical_keys: string[]
}

export default function EditMusicPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()

    const [music, setMusic] = useState<MusicType | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [pendingPdf, setPendingPdf] = useState<File | null>(null)
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: CATEGORIES,
        liturgical_times: LITURGICAL_TIMES,
        artists: [],
        musical_keys: MUSICAL_KEYS
    })

    const [formData, setFormData] = useState<FormData>({
        song_name: '',
        artist: '',
        categories: [],
        liturgical_times: [],
        musical_key: '',
        youtube_link: '',
        observations: '',
    })

    const musicId = params.id as string

    useEffect(() => {
        if (musicId) {
            loadMusic()
            loadSuggestions()
        }
    }, [musicId])

    const loadSuggestions = async () => {
        try {
            const response = await fetch('/api/filters/suggestions')
            const data = await response.json()
            setSuggestions({
                categories: data.categories || CATEGORIES,
                liturgical_times: data.liturgical_times || LITURGICAL_TIMES,
                artists: data.artists || [],
                musical_keys: data.musical_keys || MUSICAL_KEYS
            })
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error)
        }
    }

    const loadMusic = async () => {
        try {
            setLoading(true)
            const musicData = await musicApi.getMusic(parseInt(musicId))
            setMusic(musicData)
            setFormData({
                song_name: musicData.title || '',
                artist: musicData.artist || '',
                categories: musicData.categories || (musicData.category ? [musicData.category] : []),
                liturgical_times: musicData.liturgical_times || (musicData.liturgical_time ? [musicData.liturgical_time] : []),
                musical_key: musicData.musical_key || '',
                youtube_link: musicData.youtube_link || '',
                observations: musicData.observations || '',
            })
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
            router.push('/music')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (field: keyof FormData, value: string | string[]) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        setHasChanges(true)
    }

    // Detectar mudanças quando um PDF é selecionado
    useEffect(() => {
        if (pendingPdf) {
            setHasChanges(true)
        }
    }, [pendingPdf])

    const handleSave = async () => {
        if (!music) return
        if (!formData.song_name.trim()) {
            toast({ title: 'Erro', description: 'Nome da música é obrigatório', variant: 'destructive' })
            return
        }
        if (formData.categories.length === 0) {
            toast({ title: 'Erro', description: 'Pelo menos uma categoria deve ser selecionada', variant: 'destructive' })
            return
        }
        try {
            setSaving(true)
            await musicApi.updateMusic(music.id, {
                title: formData.song_name,
                artist: formData.artist,
                categories: formData.categories,
                liturgical_times: formData.liturgical_times,
                musical_key: formData.musical_key,
                youtube_link: formData.youtube_link,
                observations: formData.observations,
            })
            if (pendingPdf) {
                const form = new FormData()
                form.append('replacement_pdf', pendingPdf)
                const res = await fetch(`/api/files/${music.id}/replace_pdf`, { method: 'POST', body: form })
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}))

                    // Verificar se é erro de backend indisponível
                    if (res.status === 503) {
                        throw new Error(j?.error || 'Servidor backend não está disponível. Execute: cd backend && python app.py')
                    }

                    throw new Error(j?.error || 'Falha ao substituir PDF')
                }
            }
            toast({ title: 'Sucesso', description: 'Música atualizada com sucesso!' })
            setHasChanges(false)
            setPendingPdf(null)
            router.push(`/music/${musicId}`)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        if (hasChanges && !confirm('Você tem alterações não salvas. Deseja realmente cancelar?')) return
        router.push(`/music/${musicId}`)
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
                {/* Header */}
                <div className="flex items-center justify-between">
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
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')}>
                            <Eye className="h-4 w-4 mr-2" /> Visualizar PDF
                        </Button>
                        <Button variant="outline" onClick={handleCancel} disabled={saving}>
                            <X className="h-4 w-4 mr-2" /> Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving || !hasChanges}>
                            <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </div>

                {/* Form & Replace PDF Zone */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações Básicas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Campos do formulário */}
                                <div>
                                    <Label htmlFor="song_name">Nome da Música *</Label>
                                    <div className="relative mt-1">
                                        <Music className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="song_name" value={formData.song_name} onChange={(e) => handleInputChange('song_name', e.target.value)} placeholder="Nome da música" className="pl-10" required />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="artist">Artista/Compositor</Label>
                                    <div className="mt-1">
                                        <Autocomplete
                                            options={suggestions.artists}
                                            value={formData.artist}
                                            onChange={(value) => handleInputChange('artist', value)}
                                            onCreateNew={(newArtist) => {
                                                // Adicionar à lista de sugestões localmente
                                                setSuggestions(prev => ({
                                                    ...prev,
                                                    artists: [...prev.artists, newArtist].sort()
                                                }))
                                            }}
                                            placeholder="Digite o nome do artista ou compositor"
                                            createLabel="Criar artista"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="categories">Categorias *</Label>
                                        <div className="mt-1">
                                            <MultiSelect
                                                options={suggestions.categories}
                                                value={formData.categories}
                                                onChange={(value) => handleInputChange('categories', value)}
                                                onCreateNew={(newCategory) => {
                                                    // Adicionar à lista de sugestões localmente
                                                    setSuggestions(prev => ({
                                                        ...prev,
                                                        categories: [...prev.categories, newCategory].sort()
                                                    }))
                                                }}
                                                placeholder="Selecionar categorias"
                                                createLabel="Criar categoria"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="liturgical_times">Tempos Litúrgicos</Label>
                                        <div className="mt-1">
                                            <MultiSelect
                                                options={suggestions.liturgical_times}
                                                value={formData.liturgical_times}
                                                onChange={(value) => handleInputChange('liturgical_times', value)}
                                                onCreateNew={(newTime) => {
                                                    // Adicionar à lista de sugestões localmente
                                                    setSuggestions(prev => ({
                                                        ...prev,
                                                        liturgical_times: [...prev.liturgical_times, newTime].sort()
                                                    }))
                                                }}
                                                placeholder="Selecionar tempos litúrgicos"
                                                createLabel="Criar tempo litúrgico"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="musical_key">Tom Musical</Label>
                                    <div className="mt-1">
                                        <Select value={formData.musical_key} onValueChange={(value) => handleInputChange('musical_key', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar tom" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suggestions.musical_keys.map((key) => (
                                                    <SelectItem key={key} value={key}>
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="youtube_link">Link do YouTube</Label>
                                    <div className="relative mt-1">
                                        <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="youtube_link" type="url" value={formData.youtube_link} onChange={(e) => handleInputChange('youtube_link', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="pl-10" />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="description">Descrição</Label>
                                    <div className="relative mt-1">
                                        <Textarea id="description" value={formData.observations} onChange={(e) => handleInputChange('observations', e.target.value)} placeholder="Descrição adicional sobre a música..." rows={4} />
                                    </div>
                                </div>

                                {/* Replace PDF Zone (compact) */}
                                <div>
                                    <Label>Substituir PDF</Label>
                                    <UploadZone
                                        compact
                                        maxFiles={1}
                                        onFilesSelected={(files) => setPendingPdf(files[0] || null)}
                                        selectedFiles={pendingPdf ? [pendingPdf] : []}
                                        onRemoveFile={() => setPendingPdf(null)}
                                        className="mt-2"
                                    />
                                    {pendingPdf && <p className="text-xs text-muted-foreground mt-1">Será aplicado somente após salvar</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações do Arquivo</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <span className="text-sm font-medium block mb-1">Nome original:</span>
                                    <span className="text-sm text-muted-foreground">{music.original_name}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Tamanho:</span>
                                    <span className="text-sm text-muted-foreground">{(music.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Páginas:</span>
                                    <span className="text-sm text-muted-foreground">{music.pages}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium block mb-1">Upload:</span>
                                    <span className="text-sm text-muted-foreground">{new Date(music.upload_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}