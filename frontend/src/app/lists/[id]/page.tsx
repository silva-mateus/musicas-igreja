'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { listsApi, handleApiError } from '@/lib/api'
import type { MusicList } from '@/types'
import {
    List,
    Edit,
    Download,
    Music2,
    Calendar,
    ArrowLeft,
    Eye,
    Trash2,
    ClipboardList,
    Check,
    FileText,
    Copy
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { DuplicateListDialog } from '@/components/lists/duplicate-list-dialog'

export default function ListDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const { toast } = useToast()
    const listId = parseInt(params.id as string)

    const [list, setList] = useState<MusicList | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [reportCopied, setReportCopied] = useState(false)

    const loadList = async () => {
        try {
            setIsLoading(true)
            setError('')
            const data = await listsApi.getList(listId)
            setList(data)
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (listId) {
            loadList()
        }
    }, [listId])

    const handleDelete = async () => {
        if (!list || !confirm(`Tem certeza que deseja excluir a lista "${list.name}"?`)) return

        try {
            await listsApi.deleteList(list.id)
            toast({
                title: "Lista excluída",
                description: "A lista foi removida com sucesso.",
            })
            router.push('/lists')
        } catch (error) {
            toast({
                title: "Erro ao excluir lista",
                description: handleApiError(error),
                variant: "destructive",
            })
        }
    }

    const handleExport = async () => {
        if (!list) return

        try {
            const blob = await listsApi.mergeListPdfs(list.id)
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${list.name}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            toast({
                title: "Erro ao exportar",
                description: handleApiError(error),
                variant: "destructive",
            })
        }
    }

    const handleGenerateReport = async () => {
        if (!list || !list.items?.length) return

        setIsGeneratingReport(true)
        try {
            // Gerar relatório de texto
            let report = `${list.name}\n`
            report += '='.repeat(list.name.length) + '\n\n'

            list.items.forEach((item, index) => {
                const title = item.music?.title || 'Título não disponível'
                const key = item.music?.musical_key || 'Tom não informado'
                const artist = item.music?.artist || 'Artista não informado'
                report += `${index + 1}. ${title} - ${key} - ${artist}\n`
            })

            // Copiar para clipboard
            await navigator.clipboard.writeText(report)
            setReportCopied(true)

            toast({
                title: "Relatório copiado!",
                description: "O relatório da lista foi copiado para a área de transferência.",
            })

            // Reset animation after 2 seconds
            setTimeout(() => setReportCopied(false), 2000)
        } catch (error) {
            toast({
                title: "Erro ao gerar relatório",
                description: "Não foi possível copiar o relatório para a área de transferência.",
                variant: "destructive",
            })
        } finally {
            setIsGeneratingReport(false)
        }
    }

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Carregando lista...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (error || !list) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h1 className="text-2xl font-bold text-destructive mb-4">Erro ao carregar lista</h1>
                    <p className="text-muted-foreground mb-6">{error || 'Lista não encontrada'}</p>
                    <Button asChild>
                        <Link href="/lists">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar às listas
                        </Link>
                    </Button>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href="/lists">
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            Voltar
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Voltar para lista de listas</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <List className="h-8 w-8 text-primary" />
                                {list.name}
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                {list.items?.length || 0} música{(list.items?.length || 0) !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <TooltipProvider>
                        <div className="flex gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport || !list.items?.length}
                                        className="gap-2"
                                    >
                                        {reportCopied ? (
                                            <>
                                                <Check className="h-4 w-4 text-green-600" />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardList className="h-4 w-4" />
                                                {isGeneratingReport ? 'Gerando...' : 'Relatório'}
                                            </>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Copiar relatório de texto para área de transferência</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={handleExport} className="gap-2">
                                        <Download className="h-4 w-4" />
                                        Exportar PDF
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Baixar todas as músicas mescladas em um PDF</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DuplicateListDialog
                                        listId={list.id}
                                        listName={list.name}
                                        onSuccess={loadList}
                                        trigger={
                                            <Button variant="outline" className="gap-2">
                                                <Copy className="h-4 w-4" />
                                                Duplicar
                                            </Button>
                                        }
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Criar uma cópia desta lista</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild className="gap-2">
                                        <Link href={`/lists/${list.id}/edit`}>
                                            <Edit className="h-4 w-4" />
                                            Editar Lista
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Editar informações e músicas da lista</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="destructive" onClick={handleDelete} className="gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Excluir
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Excluir esta lista permanentemente</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Music2 className="h-5 w-5" />
                                Informações
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total de músicas</p>
                                <p className="text-2xl font-bold">{list.items?.length || 0}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Criada em</p>
                                <p className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {list.created_date ? new Date(list.created_date).toLocaleDateString('pt-BR') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Última atualização</p>
                                <p className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {list.updated_date ? new Date(list.updated_date).toLocaleDateString('pt-BR') : '-'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Observações</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {list.observations ? (
                                <p className="text-sm">{list.observations}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    Nenhuma observação adicionada
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Músicas da Lista */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Music2 className="h-5 w-5" />
                                Músicas da Lista
                            </span>
                            <Badge variant="secondary">
                                {list.items?.length || 0} música{(list.items?.length || 0) !== 1 ? 's' : ''}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {list.items && list.items.length > 0 ? (
                            <div className="space-y-3">
                                {list.items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                                {index + 1}
                                            </Badge>
                                            <div>
                                                <h4 className="font-medium">{item.music?.title || 'Título não disponível'}</h4>
                                                {item.music?.artist && (
                                                    <p className="text-sm text-muted-foreground">{item.music.artist}</p>
                                                )}
                                            </div>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/music/${item.music_id}`} target="_blank">
                                                            <FileText className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Ver detalhes da música</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium mb-2">Lista vazia</h3>
                                <p className="text-muted-foreground mb-4">
                                    Esta lista ainda não possui músicas
                                </p>
                                <Button asChild>
                                    <Link href={`/lists/${list.id}/edit`}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Adicionar Músicas
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
