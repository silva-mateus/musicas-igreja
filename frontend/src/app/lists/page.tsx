'use client'

import { useState, useEffect, useCallback } from 'react'

import { MainLayout } from '@/components/layout/main-layout'
import { ListsTable } from '@/components/lists/lists-table'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { listsApi, handleApiError } from '@/lib/api'
import type { MusicList, PaginatedResponse } from '@/types'
import { List, Plus, Search, RefreshCw, Music } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { debounce } from '@/lib/utils'
import Link from 'next/link'

export default function ListsPage() {
    const { toast } = useToast()

    const [lists, setLists] = useState<PaginatedResponse<MusicList>>({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
    })
    const [isLoading, setIsLoading] = useState(false) // Iniciando como false
    const [error, setError] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [page, setPage] = useState(1)

    const [isLoadingRef, setIsLoadingRef] = useState(false)

    const loadLists = async () => {
        // Evitar chamadas simultâneas com ref mais confiável
        if (isLoadingRef) {
            console.log('⏸️ [PAGE] Already loading, skipping...')
            return
        }

        try {
            console.log('🔄 [PAGE] Loading lists...')
            setIsLoadingRef(true)
            setIsLoading(true)
            setError('')

            const data = await listsApi.getLists(
                { page, limit: 20 },
                searchTerm || undefined
            )

            setLists(data)
            console.log('✅ [PAGE] Loaded', data.data?.length, 'lists')

        } catch (error) {
            console.error('❌ [PAGE] Error:', error)
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
            setIsLoadingRef(false)
        }
    }

    useEffect(() => {
        // Pequeno delay para evitar chamadas duplicadas
        const timeoutId = setTimeout(() => {
            loadLists()
        }, 50)

        return () => clearTimeout(timeoutId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, page])

    // Debounce search
    const debouncedSearch = debounce((term: string) => {
        setSearchTerm(term)
        setPage(1) // Reset to first page on search
    }, 500)

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        debouncedSearch(e.target.value)
    }

    const handleListCreated = (newList: MusicList) => {
        toast({
            title: "Lista criada!",
            description: `Lista "${newList.name}" foi criada com sucesso.`,
        })
        loadLists() // Reload lists
        setShowCreateDialog(false)
    }

    const handleListDeleted = (listId: number) => {
        toast({
            title: "Lista excluída",
            description: "A lista foi removida com sucesso.",
        })
        loadLists() // Reload lists
    }

    const handlePageChange = (newPage: number) => {
        setPage(newPage)
    }



    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <List className="h-8 w-8 text-primary" />
                            Listas de Música
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Organize suas músicas em listas personalizadas
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadLists} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </Button>
                        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nova Lista
                        </Button>
                    </div>
                </div>

                {/* Search and Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Buscar Listas
                            </span>
                            <Badge variant="secondary">
                                {lists.pagination.total} lista{lists.pagination.total !== 1 ? 's' : ''}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            Encontre suas listas por nome ou descrição
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Digite o nome da lista..."
                                    onChange={handleSearchChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                {lists.pagination.total === 0 && !isLoading && !searchTerm && (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted rounded-full">
                                    <Music className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-medium">Nenhuma lista encontrada</h3>
                                    <p className="text-muted-foreground">
                                        Comece criando sua primeira lista de músicas
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Criar Primeira Lista
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/music">
                                            Ver Músicas Disponíveis
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Lists Table */}
                {(lists.pagination.total > 0 || isLoading || error) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>
                                    Suas Listas ({lists.pagination.total})
                                </span>
                                {lists.pagination.pages > 1 && (
                                    <div className="text-sm text-muted-foreground">
                                        Página {lists.pagination.page} de {lists.pagination.pages}
                                    </div>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
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

                {/* Create List Dialog */}
                <CreateListDialog
                    open={showCreateDialog}
                    onOpenChange={setShowCreateDialog}
                    onListCreated={handleListCreated}
                />
            </div>
        </MainLayout>
    )
}