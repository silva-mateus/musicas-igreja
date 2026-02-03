'use client'

import { useState, useEffect } from 'react'

import { MainLayout } from '@/components/layout/main-layout'
import { ListsTable } from '@/components/lists/lists-table'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { listsApi, handleApiError } from '@/lib/api'
import type { MusicList, PaginatedResponse } from '@/types'
import { List, Plus, Search, RefreshCw, ArrowUpDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { debounce } from '@/lib/utils'
import Link from 'next/link'

export default function ListsPage() {
    const { toast } = useToast()
    const { canEdit } = useAuth()

    const [lists, setLists] = useState<PaginatedResponse<MusicList>>({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [page, setPage] = useState(1)
    const [isLoadingRef, setIsLoadingRef] = useState(false)
    const [sortBy, setSortBy] = useState<{ field: string, order: 'asc' | 'desc' }>({ field: 'created_date', order: 'desc' })

    const loadLists = async () => {
        if (isLoadingRef) return

        try {
            setIsLoadingRef(true)
            setIsLoading(true)
            setError('')

            const data = await listsApi.getLists(
                { page, limit: 20 },
                searchTerm || undefined
            )

            setLists(data)
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
            setIsLoadingRef(false)
        }
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadLists()
        }, 50)

        return () => clearTimeout(timeoutId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, page, sortBy])

    const debouncedSearch = debounce((term: string) => {
        setSearchTerm(term)
        setPage(1)
    }, 500)

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        debouncedSearch(e.target.value)
    }

    const handleListCreated = (newList: MusicList) => {
        toast({
            title: "Lista criada!",
            description: `Lista "${newList.name}" foi criada com sucesso.`,
        })
        loadLists()
        setShowCreateDialog(false)
    }

    const handleListDeleted = () => {
        toast({
            title: "Lista excluída",
            description: "A lista foi removida com sucesso.",
        })
        loadLists()
    }

    const handlePageChange = (newPage: number) => {
        setPage(newPage)
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={List}
                    title="Listas de Música"
                    description="Organize suas músicas em listas personalizadas"
                >
                    <Button onClick={loadLists} variant="outline" size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Atualizar</span>
                    </Button>
                    {canEdit && (
                        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Nova Lista</span>
                            <span className="sm:hidden">Nova</span>
                        </Button>
                    )}
                </PageHeader>

                {/* Search and Sort */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar listas por nome..."
                                    onChange={handleSearchChange}
                                    className="pl-10"
                                />
                            </div>
                            <Select 
                                value={`${sortBy.field}:${sortBy.order}`}
                                onValueChange={(v) => {
                                    const [field, order] = v.split(':')
                                    setSortBy({ field, order: order as 'asc' | 'desc' })
                                }}
                            >
                                <SelectTrigger className="w-auto min-w-[160px] gap-2">
                                    <ArrowUpDown className="h-4 w-4" />
                                    <SelectValue placeholder="Ordenar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name:asc">Nome - Crescente</SelectItem>
                                    <SelectItem value="name:desc">Nome - Decrescente</SelectItem>
                                    <SelectItem value="created_date:asc">Data - Crescente</SelectItem>
                                    <SelectItem value="created_date:desc">Data - Decrescente</SelectItem>
                                    <SelectItem value="file_count:asc">Músicas - Crescente</SelectItem>
                                    <SelectItem value="file_count:desc">Músicas - Decrescente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">
                            {lists.pagination.total} lista{lists.pagination.total !== 1 ? 's' : ''} encontrada{lists.pagination.total !== 1 ? 's' : ''}
                        </div>
                    </CardContent>
                </Card>

                {/* Empty State */}
                {lists.pagination.total === 0 && !isLoading && !searchTerm && (
                    <Card>
                        <CardContent className="p-8">
                            <EmptyState
                                title="Nenhuma lista encontrada"
                                description="Comece criando sua primeira lista de músicas"
                                action={{
                                    label: "Criar Primeira Lista",
                                    onClick: () => setShowCreateDialog(true),
                                    icon: Plus
                                }}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Lists Table */}
                {(lists.pagination.total > 0 || isLoading || error) && (
                    <Card>
                        <CardContent className="pt-4">
                            {error ? (
                                <div className="text-center py-8">
                                    <p className="text-destructive">{error}</p>
                                    <Button onClick={loadLists} className="mt-4">
                                        Tentar novamente
                                    </Button>
                                </div>
                            ) : (
                                <ListsTable
                                    lists={lists?.data || []}
                                    isLoading={isLoading}
                                    pagination={lists.pagination}
                                    onPageChange={handlePageChange}
                                    onListDeleted={handleListDeleted}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                <CreateListDialog
                    open={showCreateDialog}
                    onOpenChange={setShowCreateDialog}
                    onListCreated={handleListCreated}
                />
            </div>
        </MainLayout>
    )
}
