'use client'

import { useState, useCallback, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { MainLayout } from '@/components/layout/main-layout'
import { ListsTable } from '@/components/lists/lists-table'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { Button } from '@core/components/ui/button'
import { Card, CardContent } from '@core/components/ui/card'
import { Input } from '@core/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { listsKeys } from '@/hooks/use-lists'
import type { MusicList } from '@/types'
import { List, Plus, Search, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { getActiveWorkspaceId } from '@/lib/api'
import { debounce } from '@/lib/utils'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { useUrlParams, parseString, parseNumber } from '@/hooks/use-url-state'

export default function ListsPage() {
    return (
        <Suspense>
            <ListsPageContent />
        </Suspense>
    )
}

function ListsPageContent() {
    const { toast } = useToast()
    const { hasPermission } = useAuth()
    const { activeWorkspace } = useWorkspace()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const queryClient = useQueryClient()
    const { searchParams, setParams } = useUrlParams()

    const searchTerm = parseString(searchParams, 'search') ?? ''
    const [inputValue, setInputValue] = useState(searchTerm)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const page = parseNumber(searchParams, 'page') ?? 1
    const sortField = parseString(searchParams, 'sort_field') ?? 'created_date'
    const sortOrder = (parseString(searchParams, 'sort_order') as 'asc' | 'desc') ?? 'desc'
    const sortBy = { field: sortField, order: sortOrder }

    // Fetch lists using TanStack Query
    const wsId = activeWorkspace?.id ?? getActiveWorkspaceId()
    const { data: listsResponse, isLoading, error, refetch } = useQuery({
        queryKey: [...listsKeys.lists(), { search: searchTerm, sortBy, page, wsId }],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.append('workspace_id', String(wsId))
            if (searchTerm) params.append('search', searchTerm)
            if (sortBy.field) params.append('sort_by', sortBy.field)
            if (sortBy.order) params.append('sort_order', sortBy.order)

            const response = await fetch(`/api/merge_lists?${params.toString()}`)
            const listsData = await response.json()

            return {
                data: listsData.map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    observations: l.observations || '',
                    created_date: l.created_date,
                    updated_date: l.updated_date,
                    file_count: l.file_count,
                    items: []
                })) as MusicList[],
                pagination: { 
                    page: 1, 
                    limit: listsData.length, 
                    total: listsData.length, 
                    pages: 1 
                }
            }
        },
        staleTime: 60 * 1000, // 1 minute
    })

    const lists = listsResponse || { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSearch = useCallback(
        debounce((term: string) => {
            setParams({
                search: term || undefined,
                page: undefined,
            })
        }, 500),
        [setParams],
    )

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
        debouncedSearch(e.target.value)
    }

    const handleListCreated = (newList: MusicList) => {
        toast({
            title: "Lista criada!",
            description: `Lista "${newList.name}" foi criada com sucesso.`,
        })
        queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
        setShowCreateDialog(false)
    }

    const handleListDeleted = () => {
        toast({
            title: "Lista excluída",
            description: "A lista foi removida com sucesso.",
        })
        queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
    }

    const handlePageChange = (newPage: number) => {
        setParams({ page: newPage <= 1 ? undefined : String(newPage) })
    }

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={List}
                    title="Listas de Música"
                    description="Organize suas músicas em listas personalizadas"
                >
                    <div className="flex items-center gap-2">
                        <InstructionsModal
                            title={PAGE_INSTRUCTIONS.lists.title}
                            description={PAGE_INSTRUCTIONS.lists.description}
                            sections={PAGE_INSTRUCTIONS.lists.sections}
                        />
                        <SimpleTooltip label="Recarregar listas">
                            <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                <span className="hidden sm:inline">Atualizar</span>
                            </Button>
                        </SimpleTooltip>
                        {canEdit && (
                            <SimpleTooltip label="Criar uma nova lista">
                                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nova Lista</span>
                                    <span className="sm:hidden">Nova</span>
                                </Button>
                            </SimpleTooltip>
                        )}
                    </div>
                </PageHeader>

                {/* Search and Sort */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar listas por nome..."
                                    value={inputValue}
                                    onChange={handleSearchChange}
                                    className="pl-10"
                                />
                            </div>
                            <Select 
                                value={`${sortBy.field}:${sortBy.order}`}
                                onValueChange={(v) => {
                                    const [field, order] = v.split(':')
                                    setParams({
                                        sort_field: field === 'created_date' ? undefined : field,
                                        sort_order: order === 'desc' ? undefined : order,
                                    })
                                }}
                            >
                                <SelectTrigger className="w-auto min-w-[160px] gap-2">
                                    <ArrowUpDown className="h-4 w-4" />
                                    <SelectValue placeholder="Ordenar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name:asc">
                                        <span className="flex items-center gap-1.5">Nome <ChevronUp className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
                                    <SelectItem value="name:desc">
                                        <span className="flex items-center gap-1.5">Nome <ChevronDown className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
                                    <SelectItem value="created_date:asc">
                                        <span className="flex items-center gap-1.5">Data <ChevronUp className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
                                    <SelectItem value="created_date:desc">
                                        <span className="flex items-center gap-1.5">Data <ChevronDown className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
                                    <SelectItem value="file_count:asc">
                                        <span className="flex items-center gap-1.5">Músicas <ChevronUp className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
                                    <SelectItem value="file_count:desc">
                                        <span className="flex items-center gap-1.5">Músicas <ChevronDown className="h-3.5 w-3.5" /></span>
                                    </SelectItem>
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
                                description={canEdit ? "Comece criando sua primeira lista de músicas" : "Nenhuma lista disponível no momento"}
                                action={canEdit ? {
                                    label: "Criar Primeira Lista",
                                    onClick: () => setShowCreateDialog(true),
                                    icon: Plus
                                } : undefined}
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
                                    <p className="text-destructive">{error instanceof Error ? error.message : 'Erro ao carregar listas'}</p>
                                    <Button onClick={() => refetch()} className="mt-4">
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
