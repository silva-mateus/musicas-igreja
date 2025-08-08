'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { User } from '@/types'
import {
    Edit,
    Trash2,
    Calendar,
    Shield,
    User as UserIcon,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    MoreHorizontal
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { adminApi, handleApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface UsersTableProps {
    users: User[]
    currentUser?: User
    isLoading: boolean
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
    onPageChange: (page: number) => void
    onUserUpdated: () => void
}

export function UsersTable({
    users,
    currentUser,
    isLoading,
    pagination,
    onPageChange,
    onUserUpdated
}: UsersTableProps) {
    const { toast } = useToast()
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({
        open: false,
        user: null
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [updatingUser, setUpdatingUser] = useState<number | null>(null)

    const handleDeleteClick = (user: User) => {
        setDeleteDialog({ open: true, user })
    }

    const handleDeleteConfirm = async () => {
        if (!deleteDialog.user) return

        setIsDeleting(true)
        try {
            await adminApi.deleteUser(deleteDialog.user.id)
            onUserUpdated()
            setDeleteDialog({ open: false, user: null })

            toast({
                title: "Usuário excluído",
                description: `Usuário "${deleteDialog.user.username}" foi excluído com sucesso.`,
            })
        } catch (error) {
            toast({
                title: "Erro ao excluir usuário",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleToggleActive = async (user: User) => {
        if (user.id === currentUser?.id) {
            toast({
                title: "Operação não permitida",
                description: "Você não pode desativar sua própria conta.",
                variant: "destructive",
            })
            return
        }

        setUpdatingUser(user.id)
        try {
            await adminApi.updateUser(user.id, { is_active: !user.is_active })
            onUserUpdated()

            toast({
                title: "Status atualizado",
                description: `Usuário ${user.is_active ? 'desativado' : 'ativado'} com sucesso.`,
            })
        } catch (error) {
            toast({
                title: "Erro ao atualizar status",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setUpdatingUser(null)
        }
    }

    const getRoleBadge = (role: string) => {
        if (role === 'admin') {
            return (
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                </Badge>
            )
        }
        return (
            <Badge variant="secondary">
                <UserIcon className="h-3 w-3 mr-1" />
                Usuário
            </Badge>
        )
    }

    const getStatusBadge = (isActive: boolean) => {
        if (isActive) {
            return (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">
                    Ativo
                </Badge>
            )
        }
        return (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                Inativo
            </Badge>
        )
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Criado em</TableHead>
                                <TableHead>Último Login</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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

    if (users.length === 0) {
        return (
            <div className="text-center py-12">
                <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum usuário encontrado</h3>
                <p className="text-muted-foreground">
                    Tente ajustar os filtros ou criar um novo usuário.
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
                                <TableHead>Usuário</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Criado em</TableHead>
                                <TableHead>Último Login</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                                                <span className="text-xs font-medium text-primary-foreground">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium">{user.username}</div>
                                                {user.id === currentUser?.id && (
                                                    <div className="text-xs text-muted-foreground">Você</div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {user.email}
                                    </TableCell>
                                    <TableCell>
                                        {getRoleBadge(user.role)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(user.is_active || false)}
                                            <Switch
                                                checked={user.is_active || false}
                                                onCheckedChange={() => handleToggleActive(user)}
                                                disabled={updatingUser === user.id || user.id === currentUser?.id}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {user.created_at ? (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(user.created_at)}
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {user.last_login ? (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDate(user.last_login)}
                                            </div>
                                        ) : (
                                            'Nunca'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                {user.id !== currentUser?.id && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteClick(user)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
                            {pagination.total} usuário{pagination.total !== 1 ? 's' : ''}
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
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Usuário</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir o usuário "{deleteDialog.user?.username}"?
                            <br />
                            <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialog({ open: false, user: null })}
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