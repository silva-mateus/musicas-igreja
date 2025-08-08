'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    ExternalLink
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { listsApi, handleApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

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
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome da Lista</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Músicas</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead>Última Atualização</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lists.map((list) => (
                                <TableRow key={list.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Music2 className="h-4 w-4 text-muted-foreground" />
                                            {list.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {list.observations ? (
                                            <div className="max-w-xs truncate text-sm text-muted-foreground">
                                                {list.observations}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="gap-1">
                                            <Music2 className="h-3 w-3" />
                                            {list.items?.length || 0}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(list.created_date)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {list.updated_date ? (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(list.updated_date)}
                                            </div>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
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
                                                onClick={() => handleDeleteClick(list)}
                                                title="Excluir lista"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                            {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(1)}
                                disabled={pagination.page === 1}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    let pageNum
                                    if (pagination.pages <= 5) {
                                        pageNum = i + 1
                                    } else if (pagination.page <= 3) {
                                        pageNum = i + 1
                                    } else if (pagination.page >= pagination.pages - 2) {
                                        pageNum = pagination.pages - 4 + i
                                    } else {
                                        pageNum = pagination.page - 2 + i
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pageNum === pagination.page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => onPageChange(pageNum)}
                                            className="w-8 h-8 p-0"
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
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(pagination.pages)}
                                disabled={pagination.page === pagination.pages}
                            >
                                <ChevronsRight className="h-4 w-4" />
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