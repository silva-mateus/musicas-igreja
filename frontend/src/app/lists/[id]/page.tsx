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
    Copy,
    Youtube,
    Lock
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import Link from 'next/link'
import { DuplicateListDialog } from '@/components/lists/duplicate-list-dialog'

export default function ListDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const { toast } = useToast()
    const { canEdit, canDelete } = useAuth()
    const listId = parseInt(params.id as string)

    const [list, setList] = useState<MusicList | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [reportCopied, setReportCopied] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

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

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!list) return

        try {
            setIsDeleting(true)
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
        } finally {
            setIsDeleting(false)
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
            // Usar a API do backend para gerar o relatório (garante youtube_link correto)
            const result = await listsApi.generateReport(list.id)

            if (!result.success || !result.report) {
                toast({
                    title: "Erro ao gerar relatório",
                    description: result.message || "Não foi possível gerar o relatório.",
                    variant: "destructive",
                })
                return
            }

            // Montar relatório com cabeçalho personalizado
            let report = `${list.name}\n`
            report += '='.repeat(list.name.length) + '\n'

            // Adicionar observações se existirem
            if (list.observations?.trim()) {
                report += `${list.observations.trim()}\n`
            }
            report += '\n'

            // Adicionar as músicas do backend (com youtube_link correto)
            // O backend retorna no formato: "Música - Artista - Link"
            // Vamos numerar as linhas
            const lines = result.report.split('\n').filter((line: string) => line.trim())
            lines.forEach((line: string, index: number) => {
                report += `${index + 1}. ${line}\n`
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

    const handleViewPdf = (musicId: number) => {
        window.open(`/api/files/${musicId}/stream`, '_blank')
    }

    const handleDownloadPdf = async (musicId: number, title: string) => {
        try {
            const response = await fetch(`/api/files/${musicId}/download`)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${title || 'musica'}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            toast({
                title: "Erro ao baixar",
                description: "Não foi possível baixar o arquivo.",
                variant: "destructive",
            })
        }
    }

    const openYouTube = (url: string) => {
        window.open(url, '_blank')
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
                <div className="flex flex-col gap-4">
                    {/* Navigation and Title */}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" asChild className="self-start shrink-0">
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
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                                <List className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                                <span className="truncate">{list.name}</span>
                            </h1>
                            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                                {list.items?.length || 0} música{(list.items?.length || 0) !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {/* Actions - Responsive Grid */}
                    <TooltipProvider>
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport || !list.items?.length}
                                        className="gap-1 sm:gap-2 text-xs sm:text-sm"
                                    >
                                        {reportCopied ? (
                                            <>
                                                <Check className="h-4 w-4 text-green-600" />
                                                <span className="hidden sm:inline">Copiado!</span>
                                                <span className="sm:hidden">OK</span>
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardList className="h-4 w-4" />
                                                <span>{isGeneratingReport ? 'Gerando...' : 'Relatório'}</span>
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
                                    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline">Exportar PDF</span>
                                        <span className="sm:hidden">PDF</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Baixar todas as músicas mescladas em um PDF</p>
                                </TooltipContent>
                            </Tooltip>
                            {canEdit && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DuplicateListDialog
                                            listId={list.id}
                                            listName={list.name}
                                            onSuccess={loadList}
                                            trigger={
                                                <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                                    <Copy className="h-4 w-4" />
                                                    <span>Duplicar</span>
                                                </Button>
                                            }
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Criar uma cópia desta lista</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {canEdit && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="default" size="sm" asChild className="gap-1 sm:gap-2 text-xs sm:text-sm">
                                            <Link href={`/lists/${list.id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                                <span>Editar</span>
                                            </Link>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Editar informações e músicas da lista</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {canDelete && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={handleDeleteClick} className="text-destructive hover:text-destructive gap-1 sm:gap-2 text-xs sm:text-sm col-span-2 sm:col-span-1">
                                            <Trash2 className="h-4 w-4" />
                                            <span>Excluir</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Excluir esta lista permanentemente</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </TooltipProvider>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

                    <Card className="sm:col-span-2 lg:col-span-2">
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
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b text-sm text-muted-foreground">
                                            <th className="text-left py-2 px-2 w-10">#</th>
                                            <th className="text-left py-2 px-2 min-w-[180px] max-w-[320px]">Música</th>
                                            <th className="text-left py-2 px-2 hidden md:table-cell min-w-[140px] max-w-[220px]">Artista</th>
                                            <th className="text-left py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">Categoria</th>
                                            <th className="text-left py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">Tempo Litúrgico</th>
                                            <th className="text-center py-2 px-2 w-16">Tom</th>
                                            <th className="text-right py-2 px-2 w-28">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.items.map((item, index) => (
                                            <tr key={item.id} className="border-b hover:bg-muted/50">
                                                <td className="py-3 px-2">
                                                    <Badge variant="outline" className="w-7 h-7 rounded-full flex items-center justify-center text-xs">
                                                        {index + 1}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-2 min-w-[180px] max-w-[320px]">
                                                    <div className="font-medium text-sm truncate">{item.music?.title || 'Sem título'}</div>
                                                    <div className="text-xs text-muted-foreground md:hidden">{item.music?.artist || ''}</div>
                                                </td>
                                                <td className="py-3 px-2 hidden md:table-cell text-sm text-muted-foreground min-w-[140px] max-w-[220px]">
                                                    {item.music?.artist || '-'}
                                                </td>
                                                <td className="py-3 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                                    {item.music?.category ? (
                                                        <Badge variant="secondary" className="text-xs">{item.music.category}</Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-3 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                                    {item.music?.liturgical_time ? (
                                                        <Badge variant="outline" className="text-xs">{item.music.liturgical_time}</Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    {item.music?.musical_key ? (
                                                        <Badge className="text-xs">{item.music.musical_key}</Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className="flex gap-1 justify-end">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                                        <Link href={`/music/${item.music_id}`} target="_blank">
                                                                            <FileText className="h-4 w-4" />
                                                                        </Link>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Ver detalhes</p></TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewPdf(item.music_id)}>
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Visualizar PDF</p></TooltipContent>
                                                            </Tooltip>
<Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadPdf(item.music_id, item.music?.title || '')}>
                                                                                        <Download className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent><p>Baixar PDF</p></TooltipContent>
                                                                            </Tooltip>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    {item.music?.youtube_link ? (
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="icon" 
                                                                                            className="h-8 w-8 text-destructive hover:text-destructive" 
                                                                                            onClick={() => openYouTube(item.music!.youtube_link!)}
                                                                                        >
                                                                                            <Youtube className="h-4 w-4" />
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="icon" 
                                                                                            className="h-8 w-8" 
                                                                                            disabled
                                                                                        >
                                                                                            <Youtube className="h-4 w-4" />
                                                                                        </Button>
                                                                                    )}
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>{item.music?.youtube_link ? 'Abrir YouTube' : 'Sem link do YouTube'}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Confirmar Exclusão"
                description={`Tem certeza que deseja excluir a lista "${list?.name || 'esta lista'}"? Esta ação não pode ser desfeita e todas as músicas associadas serão removidas da lista.`}
                confirmText="Excluir Lista"
                cancelText="Cancelar"
                variant="destructive"
                onConfirm={handleDeleteConfirm}
                loading={isDeleting}
            />
        </MainLayout>
    )
}
