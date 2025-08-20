'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { MusicList } from '@/types'
import {
    Eye,
    Edit,
    Trash2,
    Calendar,
    Music2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Copy,
    ClipboardList,
    Download,
    Check,
    MoreHorizontal
} from 'lucide-react'
import { listsApi, handleApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { DuplicateListDialog } from './duplicate-list-dialog'

interface ListsTableProps {
    lists: MusicList[]
    isLoading: boolean
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
    onPageChange: (page: number) => void
    onListDeleted: (listId: number) => void
}

export function ListsTable({
    lists,
    isLoading,
    pagination,
    onPageChange,
    onListDeleted
}: ListsTableProps) {
    const { toast } = useToast()
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; list: MusicList | null }>({
        open: false,
        list: null
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [generatingReport, setGeneratingReport] = useState<number | null>(null)
    const [reportCopied, setReportCopied] = useState<number | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Debug logs (reduzido)
    console.log('📋 [TABLE] ListsTable rendered with', lists?.length, 'lists, loading:', isLoading)

    const handleDeleteClick = (list: MusicList) => {
        setDeleteDialog({ open: true, list })
    }

    const handleDeleteConfirm = async () => {
        if (!deleteDialog.list) return

        setIsDeleting(true)
        try {
            await listsApi.deleteList(deleteDialog.list.id)
            onListDeleted(deleteDialog.list.id)
            setDeleteDialog({ open: false, list: null })
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

    const handleGenerateReport = async (list: MusicList) => {
        setGeneratingReport(list.id)
        try {
            // Buscar detalhes completos da lista
            const fullList = await listsApi.getList(list.id)

            if (!fullList.items?.length) {
                toast({
                    title: "Lista vazia",
                    description: "Esta lista não possui músicas para gerar relatório.",
                    variant: "destructive"
                })
                return
            }

            // Gerar relatório
            let report = `${fullList.name}\n`
            report += '='.repeat(fullList.name.length) + '\n\n'

            fullList.items.forEach((item, index) => {
                const title = item.music?.title || 'Título não disponível'
                const key = item.music?.musical_key || 'Tom não informado'
                const artist = item.music?.artist || 'Artista não informado'
                report += `${index + 1}. ${title} - ${key} - ${artist}\n`
            })

            // Copiar para clipboard
            await navigator.clipboard.writeText(report)
            setReportCopied(list.id)

            toast({
                title: "Relatório copiado!",
                description: "O relatório da lista foi copiado para a área de transferência."
            })

            // Reset animation after 2 seconds
            setTimeout(() => setReportCopied(null), 2000)

        } catch (error) {
            console.error('Erro ao gerar relatório:', error)
            toast({
                title: "Erro",
                description: "Não foi possível gerar o relatório.",
                variant: "destructive"
            })
        } finally {
            setGeneratingReport(null)
        }
    }

    const handleDownloadPDF = async (list: MusicList) => {
        try {
            const blob = await listsApi.mergeListPdfs(list.id)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${list.name}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast({
                title: "Download iniciado",
                description: `PDF da lista "${list.name}" está sendo baixado.`
            })
        } catch (error) {
            console.error('Erro ao baixar PDF:', error)
            toast({
                title: "Erro no download",
                description: "Não foi possível baixar o PDF da lista.",
                variant: "destructive"
            })
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Músicas</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    if (lists.length === 0) {
        return (
            <div className="text-center py-12">
                <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma lista encontrada</h3>
                <p className="text-muted-foreground">
                    Tente ajustar os filtros ou criar uma nova lista.
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-4">
                {/* Table */}
                <div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome da Lista</TableHead>
                                <TableHead className="hidden md:table-cell">Descrição</TableHead>
                                <TableHead className="hidden sm:table-cell">Músicas</TableHead>
                                <TableHead className="hidden lg:table-cell">Criada em</TableHead>
                                <TableHead className="hidden xl:table-cell">Última Atualização</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lists.map((list) => (
                                <TableRow key={list.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium w-full max-w-0">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="line-clamp-2">{list.name}</span>
                                            </div>
                                            {/* Show mobile info */}
                                            <div className="mt-2 space-y-1">
                                                {/* Show music count on mobile */}
                                                <div className="sm:hidden">
                                                    <Badge variant="secondary" className="gap-1 text-xs">
                                                        <Music2 className="h-3 w-3" />
                                                        {list.file_count ?? 0} música{(list.file_count ?? 0) !== 1 ? 's' : ''}
                                                    </Badge>
                                                </div>
                                                {/* Show created date on mobile */}
                                                {list.created_date && (
                                                    <div className="lg:hidden text-xs text-muted-foreground">
                                                        <Calendar className="h-3 w-3 inline mr-1" />
                                                        {new Date(list.created_date).toLocaleDateString('pt-BR')}
                                                    </div>
                                                )}
                                                {/* Show description on mobile */}
                                                {list.observations && (
                                                    <div className="md:hidden text-xs text-muted-foreground line-clamp-2">
                                                        {list.observations}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {list.observations ? (
                                            <div className="max-w-xs line-clamp-2 text-sm text-muted-foreground">
                                                {list.observations}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        <Badge variant="secondary" className="gap-1">
                                            <Music2 className="h-3 w-3" />
                                            {list.file_count ?? 0}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {list.created_date ? new Date(list.created_date).toLocaleDateString('pt-BR') : '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                                        {list.updated_date ? (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(list.updated_date).toLocaleDateString('pt-BR')}
                                            </div>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right w-auto">
                                        {/* Desktop Actions - Inline Buttons */}
                                        <div className="hidden sm:flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                title="Visualizar lista"
                                            >
                                                <Link href={`/lists/${list.id}`}>
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                title="Editar lista"
                                            >
                                                <Link href={`/lists/${list.id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleGenerateReport(list)}
                                                title="Gerar relatório"
                                                disabled={generatingReport === list.id}
                                                className="gap-1"
                                            >
                                                {reportCopied === list.id ? (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <ClipboardList className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDownloadPDF(list)}
                                                title="Baixar PDF"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <DuplicateListDialog
                                                listId={list.id}
                                                listName={list.name}
                                                onSuccess={() => window.location.reload()}
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Duplicar lista"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                }
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteClick(list)}
                                                title="Excluir lista"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Mobile Actions - Dropdown Menu */}
                                        <div className="sm:hidden">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Abrir menu de ações</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/lists/${list.id}`} className="flex items-center">
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            Visualizar Lista
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/lists/${list.id}/edit`} className="flex items-center">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Editar Lista
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleGenerateReport(list)}
                                                        disabled={generatingReport === list.id}
                                                    >
                                                        {reportCopied === list.id ? (
                                                            <Check className="mr-2 h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <ClipboardList className="mr-2 h-4 w-4" />
                                                        )}
                                                        Gerar Relatório
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(list)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Baixar PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DuplicateListDialog
                                                        listId={list.id}
                                                        listName={list.name}
                                                        onSuccess={() => window.location.reload()}
                                                        trigger={
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                <Copy className="mr-2 h-4 w-4" />
                                                                Duplicar Lista
                                                            </DropdownMenuItem>
                                                        }
                                                    />
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteClick(list)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Excluir Lista
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-muted-foreground order-2 sm:order-1">
                            <span className="hidden sm:inline">
                                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                                {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
                            </span>
                            <span className="sm:hidden">
                                {pagination.page} de {pagination.pages}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(1)}
                                disabled={pagination.page === 1}
                                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(isMobile ? 3 : 5, pagination.pages) }, (_, i) => {
                                    let pageNum
                                    const maxPages = isMobile ? 3 : 5
                                    if (pagination.pages <= maxPages) {
                                        pageNum = i + 1
                                    } else if (pagination.page <= Math.floor(maxPages / 2) + 1) {
                                        pageNum = i + 1
                                    } else if (pagination.page >= pagination.pages - Math.floor(maxPages / 2)) {
                                        pageNum = pagination.pages - maxPages + 1 + i
                                    } else {
                                        pageNum = pagination.page - Math.floor(maxPages / 2) + i
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pageNum === pagination.page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => onPageChange(pageNum)}
                                            className="w-8 h-8 p-0 sm:w-9 sm:h-9"
                                        >
                                            {pageNum}
                                        </Button>
                                    )
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages}
                                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(pagination.pages)}
                                disabled={pagination.page === pagination.pages}
                                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                                <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, list: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Lista</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a lista "{deleteDialog.list?.name}"?
                            <br />
                            <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialog({ open: false, list: null })}
                            disabled={isDeleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Excluindo...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Excluir
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}