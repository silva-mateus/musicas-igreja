'use client'

import { useState } from 'react'
import { Button } from '@core/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@core/components/ui/table'
import { Badge } from '@core/components/ui/badge'
import { Skeleton } from '@core/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@core/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@core/components/ui/dropdown-menu'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { ListCard } from './list-card'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
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
import { listsKeys } from '@/hooks/use-lists'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { useQueryClient } from '@tanstack/react-query'
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
    const { hasPermission } = useAuth()
    const queryClient = useQueryClient()
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canDelete = hasPermission('music:delete')
    
    // Pull to refresh functionality
    const pullToRefresh = usePullToRefresh({
        onRefresh: async () => {
            // This would typically trigger a data refetch
            // For now, we'll just reload the page
            window.location.reload()
        },
        disabled: isLoading
    })
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; list: MusicList | null }>({
        open: false,
        list: null
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [generatingReport, setGeneratingReport] = useState<number | null>(null)
    const [reportCopied, setReportCopied] = useState<number | null>(null)
    const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null)

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
        setDownloadingPdf(list.id)
        try {
            const blob = await listsApi.mergeListPdfs(list.id)
            const safeName = list.name.replace(/[<>:"/\\|?*]/g, '_')
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${safeName}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            setTimeout(() => URL.revokeObjectURL(url), 1000)

            toast({
                title: "Download iniciado",
                description: `PDF da lista "${list.name}" está sendo baixado.`
            })
        } catch (error) {
            toast({
                title: "Erro no download",
                description: handleApiError(error),
                variant: "destructive"
            })
        } finally {
            setDownloadingPdf(null)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                {isMobile ? (
                    /* Mobile: Card skeletons */
                    <div className="grid gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="bg-card border border-border rounded-lg p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-4 w-40" />
                                        </div>
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-3/4 mt-1" />
                                    </div>
                                    <Skeleton className="h-8 w-8" />
                                </div>
                                <div className="flex gap-3 text-xs">
                                    <Skeleton className="h-5 w-20" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Desktop: Table skeleton */
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
                )}
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
            <div 
                className="space-y-4" 
                ref={(el) => pullToRefresh.attachToElement(el)}
            >
                <PullToRefreshIndicator 
                    isPulling={pullToRefresh.isPulling}
                    canRefresh={pullToRefresh.canRefresh}
                    isRefreshing={pullToRefresh.isRefreshing}
                    pullDistance={pullToRefresh.pullDistance}
                    style={pullToRefresh.pullIndicatorStyle}
                    className="border-b border-border/30"
                />
                {isMobile ? (
                    /* Mobile: Cards Grid */
                    <div className="grid gap-3">
                        {lists.map((list) => (
                            <ListCard
                                key={list.id}
                                list={list}
                                onDeleteClick={handleDeleteClick}
                                onReportGenerated={() => {}}
                                generatingReport={generatingReport === list.id}
                                reportCopied={reportCopied === list.id}
                                downloadingPdf={downloadingPdf === list.id}
                                setGeneratingReport={setGeneratingReport}
                                setReportCopied={setReportCopied}
                                setDownloadingPdf={setDownloadingPdf}
                            />
                        ))}
                    </div>
                ) : (
                    /* Desktop: Table */
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
                                        <div className="flex justify-end gap-1">
                                            <SimpleTooltip label="Visualizar lista">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                >
                                                    <Link href={`/lists/${list.id}`}>
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </SimpleTooltip>
                                            {canEdit && (
                                                <SimpleTooltip label="Editar lista">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                    >
                                                        <Link href={`/lists/${list.id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </SimpleTooltip>
                                            )}
                                            <SimpleTooltip label="Gerar relatório">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleGenerateReport(list)}
                                                    disabled={generatingReport === list.id}
                                                >
                                                {reportCopied === list.id ? (
                                                    <Check className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <ClipboardList className="h-4 w-4" />
                                                )}
                                                </Button>
                                            </SimpleTooltip>
                                            <SimpleTooltip label="Baixar PDF">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDownloadPDF(list)}
                                                    disabled={downloadingPdf === list.id}
                                                >
                                                    {downloadingPdf === list.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </SimpleTooltip>
                                            {canEdit && (
                                                <DuplicateListDialog
                                                    listId={list.id}
                                                    listName={list.name}
                                                    onSuccess={() => queryClient.invalidateQueries({ queryKey: listsKeys.lists() })}
                                                />
                                            )}
                                            {canDelete && (
                                                <SimpleTooltip label="Excluir lista">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(list)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </SimpleTooltip>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

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
