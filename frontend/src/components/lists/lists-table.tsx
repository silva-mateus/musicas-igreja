'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { MusicList } from '@/types'
import {
    Eye,
    Edit,
    Trash2,
    Copy,
    ClipboardList,
    Download,
    Check,
    MoreHorizontal,
    Loader2
} from 'lucide-react'
import { listsApi, handleApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
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
    const { canEdit, canDelete } = useAuth()
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; list: MusicList | null }>({
        open: false,
        list: null
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [generatingReport, setGeneratingReport] = useState<number | null>(null)
    const [reportCopied, setReportCopied] = useState<number | null>(null)

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
            const result = await listsApi.generateReport(list.id)

            if (!result.success || !result.report) {
                toast({
                    title: "Erro",
                    description: result.message || "Não foi possível gerar o relatório.",
                    variant: "destructive"
                })
                return
            }

            const fullList = await listsApi.getList(list.id)

            let report = `${fullList.name}\n`
            report += '='.repeat(fullList.name.length) + '\n'

            if (fullList.observations?.trim()) {
                report += `${fullList.observations.trim()}\n`
            }
            report += '\n'

            const lines = result.report.split('\n').filter((line: string) => line.trim())
            lines.forEach((line: string, index: number) => {
                report += `${index + 1}. ${line}\n`
            })

            await navigator.clipboard.writeText(report)
            setReportCopied(list.id)

            toast({
                title: "Relatório copiado!",
                description: "O relatório da lista foi copiado para a área de transferência."
            })

            setTimeout(() => setReportCopied(null), 2000)

        } catch (error) {
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
            <EmptyState
                title="Nenhuma lista encontrada"
                description="Tente ajustar os filtros ou criar uma nova lista."
            />
        )
    }

    return (
        <>
            <div className="space-y-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[200px] max-w-[360px]">Nome da Lista</TableHead>
                            <TableHead className="hidden md:table-cell min-w-[200px] max-w-[360px]">Descrição</TableHead>
                            <TableHead className="hidden sm:table-cell w-20">Músicas</TableHead>
                            <TableHead className="hidden lg:table-cell w-28">Criada em</TableHead>
                            <TableHead className="hidden xl:table-cell w-36">Última Atualização</TableHead>
                            <TableHead className="text-right w-28">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lists.map((list) => (
                            <TableRow key={list.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium min-w-[200px] max-w-[360px]">
                                    <div>
                                        <span className="line-clamp-2">{list.name}</span>
                                        {/* Mobile info */}
                                        <div className="mt-2 space-y-1">
                                            <div className="sm:hidden">
                                                <Badge variant="secondary" className="text-xs">
                                                    {list.file_count ?? 0} música{(list.file_count ?? 0) !== 1 ? 's' : ''}
                                                </Badge>
                                            </div>
                                            {list.created_date && (
                                                <div className="lg:hidden text-xs text-muted-foreground">
                                                    {new Date(list.created_date).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                            {list.observations && (
                                                <div className="md:hidden text-xs text-muted-foreground line-clamp-2">
                                                    {list.observations}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell min-w-[200px] max-w-[360px]">
                                    {list.observations ? (
                                        <div className="line-clamp-2 text-sm text-muted-foreground">
                                            {list.observations}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant="secondary">
                                        {list.file_count ?? 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                    {list.created_date ? new Date(list.created_date).toLocaleDateString('pt-BR') : '-'}
                                </TableCell>
                                <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                                    {list.updated_date ? new Date(list.updated_date).toLocaleDateString('pt-BR') : '-'}
                                </TableCell>
                                <TableCell className="text-right w-auto">
                                    {/* Desktop Actions */}
                                    <div className="hidden sm:flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                            title="Visualizar lista"
                                        >
                                            <Link href={`/lists/${list.id}`}>
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                                title="Editar lista"
                                            >
                                                <Link href={`/lists/${list.id}/edit`}>
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleGenerateReport(list)}
                                            title="Gerar relatório"
                                            disabled={generatingReport === list.id}
                                        >
                                            {reportCopied === list.id ? (
                                                <Check className="h-4 w-4 text-primary" />
                                            ) : (
                                                <ClipboardList className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDownloadPDF(list)}
                                            title="Baixar PDF"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        {canEdit && (
                                            <DuplicateListDialog
                                                listId={list.id}
                                                listName={list.name}
                                                onSuccess={() => window.location.reload()}
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Duplicar lista"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                }
                                            />
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteClick(list)}
                                                title="Excluir lista"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Mobile Actions - Dropdown */}
                                    <div className="sm:hidden">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Abrir menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/lists/${list.id}`} className="flex items-center">
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Visualizar Lista
                                                    </Link>
                                                </DropdownMenuItem>
                                                {canEdit && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/lists/${list.id}/edit`} className="flex items-center">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Editar Lista
                                                        </Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleGenerateReport(list)}
                                                    disabled={generatingReport === list.id}
                                                >
                                                    {reportCopied === list.id ? (
                                                        <Check className="mr-2 h-4 w-4 text-primary" />
                                                    ) : (
                                                        <ClipboardList className="mr-2 h-4 w-4" />
                                                    )}
                                                    Gerar Relatório
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDownloadPDF(list)}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Baixar PDF
                                                </DropdownMenuItem>
                                                {canEdit && (
                                                    <>
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
                                                    </>
                                                )}
                                                {canDelete && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteClick(list)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Excluir Lista
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Pagination
                    page={pagination.page}
                    pages={pagination.pages}
                    total={pagination.total}
                    limit={pagination.limit}
                    onPageChange={onPageChange}
                    itemLabel="lista"
                />
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, list: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Lista</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a lista &quot;{deleteDialog.list?.name}&quot;?
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
                                    <Loader2 className="h-4 w-4 animate-spin" />
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
