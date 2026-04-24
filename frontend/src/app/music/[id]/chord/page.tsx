'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Label } from '@core/components/ui/label'
import { Input } from '@core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@core/components/ui/tabs'
import { Badge } from '@core/components/ui/badge'
import { Separator } from '@core/components/ui/separator'
import { ArrowLeft, Loader2, Save, Download } from 'lucide-react'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { ChordEditor } from '@/components/music/chord-editor'
import { ChordPreview } from '@/components/music/chord-preview'
import { TranspositionControls } from '@/components/music/transposition-controls'
import type { MusicFile, UpdateChordContentDto } from '@/types'
import { musicApi, downloadFile } from '@/lib/api'
import { useMusicDetail } from '@/hooks/use-music'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RadioGroup, RadioGroupItem } from '@core/components/ui/radio-group'
import Link from 'next/link'

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function ChordEditorPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')

    const musicId = parseInt(params.id as string)
    const { data: music, isLoading, error: queryError } = useMusicDetail(musicId)

    const [loading, setLoading] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [chordContent, setChordContent] = useState('')
    const [title, setTitle] = useState('')
    const [artist, setArtist] = useState('')
    const [musicalKey, setMusicalKey] = useState('C')
    const [previewKey, setPreviewKey] = useState('C')
    const [editorMode, setEditorMode] = useState<'chordpro' | 'visual'>('chordpro')
    const [showConfirmExit, setShowConfirmExit] = useState(false)
    const [pendingUrl, setPendingUrl] = useState<string | null>(null)

    useEffect(() => {
        if (music) {
            if (!music.chord_content && music.content_type !== 'chord_converting') {
                toast({
                    title: 'Erro',
                    description: 'Esta música não é do tipo cifra',
                    variant: 'destructive',
                })
                router.push(`/music/${musicId}`)
                return
            }
            setChordContent(music.chord_content || '')
            setTitle(music.title || '')
            setArtist(music.artist || '')
            setMusicalKey(music.musical_key || 'C')
            setPreviewKey(music.musical_key || 'C')
        }
    }, [music])

    useEffect(() => {
        if (queryError) {
            toast({
                title: 'Erro',
                description: (queryError as Error).message,
                variant: 'destructive',
            })
            router.push('/music')
        }
    }, [queryError])

    if (!canEdit) {
        return (
            <MainLayout>
                <div className="p-6">
                    <p className="text-red-600">Sem permissão para editar músicas.</p>
                </div>
            </MainLayout>
        )
    }

    if (isLoading) {
        return (
            <MainLayout>
                <LoadingOverlay message="Carregando música..." />
            </MainLayout>
        )
    }

    if (!music) {
        return (
            <MainLayout>
                <div className="p-6">
                    <p className="text-red-600">Música não encontrada.</p>
                </div>
            </MainLayout>
        )
    }

    const handleSave = async () => {
        if (!chordContent.trim()) {
            toast({
                title: 'Erro',
                description: 'Conteúdo de cifra não pode estar vazio',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)

            const dto: UpdateChordContentDto = {
                chord_content: chordContent,
                musical_key: musicalKey,
                song_name: title,
                artist: artist
            }

            await musicApi.updateChord(musicId, dto)

            setIsDirty(false)
            toast({
                title: 'Sucesso',
                description: 'Cifra atualizada com sucesso',
            })

            router.push(`/music/${musicId}`)
        } catch (error) {
            console.error('Error saving chord content:', error)
            toast({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Falha ao salvar cifra',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        if (isDirty) {
            setShowConfirmExit(true)
            setPendingUrl(`/music/${musicId}`)
        } else {
            router.push(`/music/${musicId}`)
        }
    }

    const handleExport = async (useCapo: boolean) => {
        try {
            setLoading(true)
            const capoFret = previewKey !== musicalKey
                ? ((MUSICAL_KEYS.indexOf(previewKey) - MUSICAL_KEYS.indexOf(musicalKey) + 12) % 12)
                : 0
            const blob = await musicApi.exportChordPdf(musicId, {
                transposed_key: previewKey,
                use_capo: useCapo,
                capo_fret: useCapo ? capoFret : undefined,
            })
            const name = (music?.title || music?.filename || 'cifra') + '.pdf'
            downloadFile(blob, name)
        } catch (error) {
            toast({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Falha ao exportar PDF',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveAsDefaultKey = async () => {
        try {
            setLoading(true)

            const dto: UpdateChordContentDto = {
                chord_content: chordContent,
                musical_key: previewKey,
            }

            await musicApi.updateChord(musicId, dto)

            setMusicalKey(previewKey)
            toast({
                title: 'Sucesso',
                description: `Tom padrão salvo como ${previewKey}`,
            })
        } catch (error) {
            console.error('Error saving default key:', error)
            toast({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Falha ao salvar tom padrão',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainLayout>
            <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={handleCancel}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">Editar Cifra</h1>
                            <p className="text-xs text-muted-foreground">{music.original_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={loading || !isDirty} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>

                {/* Split Content */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
                    {/* Left Panel: Editor */}
                    <div className="flex flex-col border-r border-border bg-muted/10 overflow-auto">
                        <Tabs defaultValue="geral" className="flex-1 flex flex-col">
                            <div className="px-6 pt-4">
                                <TabsList className="bg-muted/50">
                                    <TabsTrigger value="geral">Geral</TabsTrigger>
                                    <TabsTrigger value="editor">Conteúdo</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="geral" className="flex-1 p-6 space-y-6">
                                <div className="space-y-4 max-w-md">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Título</Label>
                                        <Input 
                                            id="title" 
                                            value={title} 
                                            onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }} 
                                            placeholder="Título da música"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="artist">Artista</Label>
                                        <Input 
                                            id="artist" 
                                            value={artist} 
                                            onChange={(e) => { setArtist(e.target.value); setIsDirty(true); }} 
                                            placeholder="Nome do artista"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="musicalKey">Tom Original</Label>
                                            <Select value={musicalKey} onValueChange={(val) => { setMusicalKey(val); setIsDirty(true); }}>
                                                <SelectTrigger id="musicalKey">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {MUSICAL_KEYS.map((key) => (
                                                        <SelectItem key={key} value={key}>{key}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Separator className="my-6" />

                                    <div className="space-y-3">
                                        <Label>Formato do Editor</Label>
                                        <RadioGroup 
                                            value={editorMode} 
                                            onValueChange={(val: 'chordpro' | 'visual') => setEditorMode(val)}
                                            className="flex gap-4"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="visual" id="r1" />
                                                <Label htmlFor="r1" className="cursor-pointer">Acorde sobre Letra</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="chordpro" id="r2" />
                                                <Label htmlFor="r2" className="cursor-pointer">ChordPro</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="editor" className="flex-1 flex flex-col p-6 m-0">
                                <ChordEditor
                                    value={chordContent}
                                    onChange={(content) => {
                                        setChordContent(content)
                                        setIsDirty(true)
                                    }}
                                    // We can pass the mode to the existing component if we want, 
                                    // but currently ChordEditor handles its own mode.
                                    // I'll update it later to sync.
                                />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Panel: Preview */}
                    <div className="hidden lg:flex flex-col bg-background overflow-auto p-8 relative">
                        <div className="max-w-2xl mx-auto w-full space-y-6">
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <div>
                                    <h2 className="text-3xl font-bold">{title || 'Título'}</h2>
                                    <p className="text-lg text-muted-foreground">{artist || 'Artista'}</p>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline" className="text-sm border-primary/20 bg-primary/5">
                                        Tom: {musicalKey}
                                    </Badge>
                                </div>
                            </div>

                            <ChordPreview
                                chordContent={chordContent}
                                transposedKey={musicalKey}
                                fontSize={16}
                                showChords={true}
                                chordColor="text-primary"
                            />
                        </div>

                        {/* Floating Indicator */}
                        <div className="fixed bottom-6 right-6 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full shadow-lg">
                            Live Preview
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={showConfirmExit}
                onOpenChange={setShowConfirmExit}
                title="Alterações não salvas"
                description="Você tem alterações que não foram salvas. Deseja realmente sair?"
                confirmText="Sair sem salvar"
                cancelText="Continuar editando"
                variant="destructive"
                onConfirm={() => {
                    setShowConfirmExit(false)
                    if (pendingUrl) router.push(pendingUrl)
                }}
            />
        </MainLayout>
    )
}
