'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Input } from '@core/components/ui/input'
import { Label } from '@core/components/ui/label'
import { Textarea } from '@core/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Autocomplete } from '@/components/ui/autocomplete'
import { ArrowLeft, Save, X, Music, User, Tag, Calendar, Link as LinkIcon, Eye, Lock } from 'lucide-react'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import Link from 'next/link'
import type { MusicFile as MusicType } from '@/types'
import { musicApi, handleApiError, getActiveWorkspaceId } from '@/lib/api'
import { UploadZone } from '@/components/upload/upload-zone'

const CATEGORIES = ['Adoração', 'Louvor', 'Comunhão', 'Entrada', 'Ofertório', 'Final', 'Santíssimo', 'Missa']
const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

interface CustomFilterGroupOption {
    id: number
    name: string
    slug: string
    values: Array<{ name: string; slug: string }>
}

interface FormData {
    song_name: string
    artist: string
    categories: string[]
    custom_filters: Record<string, string[]>
    musical_key: string
    youtube_link: string
    observations: string
}

interface FilterSuggestions {
    categories: string[]
    customFilterGroups: CustomFilterGroupOption[]
    artists: string[]
    musical_keys: string[]
}

export default function EditMusicPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const { hasPermission, isAuthenticated } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')

    const [music, setMusic] = useState<MusicType | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [pendingPdf, setPendingPdf] = useState<File | null>(null)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: CATEGORIES,
        customFilterGroups: [],
        artists: [],
        musical_keys: MUSICAL_KEYS
    })

    const [formData, setFormData] = useState<FormData>({
        song_name: '',
        artist: '',
        categories: [],
        custom_filters: {},
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
            const response = await fetch(`/api/filters/suggestions?workspace_id=${getActiveWorkspaceId()}`)
            const data = await response.json()
            setSuggestions({
                categories: data.categories || CATEGORIES,
                customFilterGroups: (data.custom_filter_groups || []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                    values: (g.values || []).map((v: any) => ({ name: v.name, slug: v.slug })),
                })),
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
                custom_filters: musicData.custom_filters
                    ? Object.fromEntries(
                        Object.entries(musicData.custom_filters).map(([slug, group]) => [slug, group.values])
                    )
                    : {},
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
                custom_filters: formData.custom_filters,
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

    const handleCancelClick = () => {
        if (hasChanges) {
            setCancelDialogOpen(true)
        } else {
            router.push(`/music/${musicId}`)
        }
    }

    const handleCancelConfirm = () => {
        router.push(`/music/${musicId}`)
    }

    // Permission check
    if (!isAuthenticated || !canEdit) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                    <p className="text-muted-foreground">
                        {!isAuthenticated 
                            ? 'Você precisa estar logado para editar músicas.'
                            : 'Você não tem permissão para editar músicas.'}
                    </p>
                </div>
            </MainLayout>
        )
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
                <div className="flex flex-col gap-4">
                    {/* Navigation */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <Button variant="outline" size="sm" onClick={handleCancelClick} className="self-start shrink-0">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar
                        </Button>
                        <div className="text-sm text-muted-foreground truncate">
                            <Link href="/music" className="hover:text-primary">Músicas</Link>
                            <span className="mx-2">/</span>
                            <Link href={`/music/${musicId}`} className="hover:text-primary truncate">{music.title}</Link>
                            <span className="mx-2">/</span>
                            <span>Editar</span>
                        </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(`/api/files/${music.id}/stream`, '_blank')} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Visualizar PDF</span>
                            <span className="sm:hidden">Ver PDF</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancelClick} disabled={saving} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                            <X className="h-4 w-4" />
                            <span>Cancelar</span>
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="gap-1 sm:gap-2 text-xs sm:text-sm col-span-2 sm:col-span-1">
                            <Save className="h-4 w-4" />
                            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
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
                                    {suggestions.customFilterGroups.map(group => (
                                        <div key={group.slug}>
                                            <Label>{group.name}</Label>
                                            <div className="mt-1">
                                                <MultiSelect
                                                    options={group.values.map(v => v.name)}
                                                    value={formData.custom_filters[group.slug] || []}
                                                    onChange={(values) => {
                                                        const newFilters = { ...formData.custom_filters }
                                                        if (values.length > 0) {
                                                            newFilters[group.slug] = values
                                                        } else {
                                                            delete newFilters[group.slug]
                                                        }
                                                        handleInputChange('custom_filters' as keyof FormData, newFilters as any)
                                                    }}
                                                    placeholder={`Selecionar ${group.name.toLowerCase()}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
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
                                    <span className="text-sm text-muted-foreground break-all">{music.original_name}</span>
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

            {/* Confirm Cancel Dialog */}
            <ConfirmDialog
                open={cancelDialogOpen}
                onOpenChange={setCancelDialogOpen}
                title="Alterações Não Salvas"
                description="Você tem alterações não salvas. Deseja realmente cancelar e descartar estas alterações?"
                confirmText="Descartar Alterações"
                cancelText="Continuar Editando"
                variant="destructive"
                onConfirm={handleCancelConfirm}
            />
        </MainLayout>
    )
}