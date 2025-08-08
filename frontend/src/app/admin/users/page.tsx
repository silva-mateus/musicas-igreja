'use client'

import { useState, useEffect } from 'react'
import { useRequireAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout/main-layout'
import { UsersTable } from '@/components/admin/users-table'
import { CreateUserDialog } from '@/components/admin/create-user-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminApi, handleApiError } from '@/lib/api'
import type { User, PaginatedResponse } from '@/types'
import { Users, Plus, Search, RefreshCw, Shield, UserCheck, UserX } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { debounce } from '@/lib/utils'

export default function AdminUsersPage() {
    const { user: currentUser, isAuthenticated, isLoading: authLoading } = useRequireAuth(['admin'])
    const { toast } = useToast()

    const [users, setUsers] = useState<PaginatedResponse<User>>({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [page, setPage] = useState(1)

    useEffect(() => {
        if (isAuthenticated && currentUser?.role === 'admin') {
            loadUsers()
        }
    }, [isAuthenticated, currentUser, searchTerm, roleFilter, statusFilter, page])

    const loadUsers = async () => {
        try {
            setIsLoading(true)
            setError('')

            const filters: any = {}
            if (searchTerm) filters.search = searchTerm
            if (roleFilter !== 'all') filters.role = roleFilter
            if (statusFilter !== 'all') filters.is_active = statusFilter === 'active'

            const data = await adminApi.getUsers(
                { page, limit: 20 },
                filters
            )
            setUsers(data)
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    // Debounce search
    const debouncedSearch = debounce((term: string) => {
        setSearchTerm(term)
        setPage(1) // Reset to first page on search
    }, 500)

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        debouncedSearch(e.target.value)
    }

    const handleUserCreated = (newUser: User) => {
        toast({
            title: "Usuário criado!",
            description: `Usuário "${newUser.username}" foi criado com sucesso.`,
        })
        loadUsers() // Reload users
        setShowCreateDialog(false)
    }

    const handleUserUpdated = () => {
        loadUsers() // Reload users
    }

    const handlePageChange = (newPage: number) => {
        setPage(newPage)
    }

    const handleRoleFilterChange = (value: string) => {
        setRoleFilter(value)
        setPage(1)
    }

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value)
        setPage(1)
    }

    if (authLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Carregando...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!isAuthenticated || currentUser?.role !== 'admin') {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Acesso Negado</h3>
                        <p className="text-muted-foreground">
                            Você precisa ter permissões de administrador para acessar esta página.
                        </p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    const stats = {
        total: users.pagination.total,
        active: users.data.filter(u => u.is_active).length,
        admins: users.data.filter(u => u.role === 'admin').length,
        users: users.data.filter(u => u.role === 'user').length
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Users className="h-8 w-8 text-primary" />
                            Gerenciar Usuários
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Administre contas de usuário e permissões do sistema
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadUsers} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </Button>
                        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Novo Usuário
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-sm text-muted-foreground">Total</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                                    <UserCheck className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.active}</p>
                                    <p className="text-sm text-muted-foreground">Ativos</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded">
                                    <Shield className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.admins}</p>
                                    <p className="text-sm text-muted-foreground">Admins</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded">
                                    <Users className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.users}</p>
                                    <p className="text-sm text-muted-foreground">Usuários</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search and Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Buscar e Filtrar Usuários
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Use os filtros para encontrar usuários específicos
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome ou email..."
                                    onChange={handleSearchChange}
                                    className="pl-10"
                                />
                            </div>

                            {/* Role Filter */}
                            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por função" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as funções</SelectItem>
                                    <SelectItem value="admin">Administradores</SelectItem>
                                    <SelectItem value="user">Usuários</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os status</SelectItem>
                                    <SelectItem value="active">Ativos</SelectItem>
                                    <SelectItem value="inactive">Inativos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                Usuários ({users.pagination.total})
                            </span>
                            {users.pagination.pages > 1 && (
                                <div className="text-sm text-muted-foreground">
                                    Página {users.pagination.page} de {users.pagination.pages}
                                </div>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="text-center py-8">
                                <p className="text-destructive">{error}</p>
                                <Button onClick={loadUsers} className="mt-4">
                                    Tentar novamente
                                </Button>
                            </div>
                        ) : (
                            <UsersTable
                                users={users.data}
                                currentUser={currentUser}
                                isLoading={isLoading}
                                pagination={users.pagination}
                                onPageChange={handlePageChange}
                                onUserUpdated={handleUserUpdated}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Create User Dialog */}
                <CreateUserDialog
                    open={showCreateDialog}
                    onOpenChange={setShowCreateDialog}
                    onUserCreated={handleUserCreated}
                />
            </div>
        </MainLayout>
    )
}