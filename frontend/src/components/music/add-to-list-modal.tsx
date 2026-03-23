'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@core/components/ui/dialog'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Skeleton } from '@core/components/ui/skeleton'
import { Card } from '@core/components/ui/card'
import { Separator } from '@core/components/ui/separator'
import {
    ListPlus,
    Search,
    Calendar,
    Plus,
    ChevronDown,
    ChevronUp,
    Loader2
} from 'lucide-react'
import { useLists, useAddMusicToList, useCreateList } from '@/hooks/use-lists'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@core/hooks/use-toast'

interface AddToListModalProps {
    musicId: number
    musicTitle: string
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function AddToListModal({ musicId, musicTitle, trigger, onSuccess }: AddToListModalProps) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [expanded, setExpanded] = useState(false)
    const [newListName, setNewListName] = useState('')

    const { data: listsData, isLoading } = useLists({ page: 1, limit: 1000 }, undefined)
    const addMutation = useAddMusicToList()
    const createMutation = useCreateList()

    const sortedLists = useMemo(() => {
        const items = listsData?.data || []
        return [...items].sort((a, b) =>
            new Date(b.created_date || '').getTime() - new Date(a.created_date || '').getTime()
        )
    }, [listsData])

    const filteredLists = useMemo(() => {
        if (!searchTerm.trim()) return sortedLists
        return sortedLists.filter(list =>
            list.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [sortedLists, searchTerm])

    const displayedLists = expanded ? filteredLists : filteredLists.slice(0, 5)

    const handleAddToList = async (listId: number, listName: string) => {
        try {
            const response = await addMutation.mutateAsync({ listId, musicId })

            if (!response.added || response.added === 0) {
                toast({
                    title: "Aviso",
                    description: "A música já existe nesta lista ou não pôde ser adicionada.",
                    variant: "destructive"
                })
                return
            }

            toast({
                title: "Música adicionada!",
                description: `"${musicTitle}" foi adicionada à lista "${listName}".`
            })
            setOpen(false)
            onSuccess?.()
        } catch {
            toast({
                title: "Erro",
                description: "Não foi possível adicionar a música à lista.",
                variant: "destructive"
            })
        }
    }

    const handleCreateAndAdd = async () => {
        const name = newListName.trim()
        if (!name) return

        try {
            const result = await createMutation.mutateAsync({ name })
            setNewListName('')

            const response = await addMutation.mutateAsync({ listId: result.list_id, musicId })

            if (response.added && response.added > 0) {
                toast({
                    title: "Lista criada e música adicionada!",
                    description: `"${musicTitle}" foi adicionada à nova lista "${name}".`
                })
            } else {
                toast({
                    title: "Lista criada!",
                    description: `A lista "${name}" foi criada, mas a música não pôde ser adicionada.`,
                    variant: "destructive"
                })
            }

            setOpen(false)
            onSuccess?.()
        } catch {
            toast({
                title: "Erro",
                description: "Não foi possível criar a lista.",
                variant: "destructive"
            })
        }
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Data não informada'
        try {
            return new Date(dateString).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        } catch {
            return 'Data inválida'
        }
    }

    const isAdding = addMutation.isPending
    const isCreating = createMutation.isPending

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <SimpleTooltip label="Adicionar à lista">
                        <Button variant="ghost" size="icon">
                            <ListPlus className="h-4 w-4" />
                        </Button>
                    </SimpleTooltip>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListPlus className="h-5 w-5" />
                        Adicionar à Lista
                    </DialogTitle>
                    <DialogDescription>
                        Selecione uma lista para adicionar &quot;<span className="font-medium">{musicTitle}</span>&quot;
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {/* Create new list */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nome da nova lista..."
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleCreateAndAdd()
                                }
                            }}
                            disabled={isCreating}
                        />
                        <Button
                            size="sm"
                            onClick={handleCreateAndAdd}
                            disabled={!newListName.trim() || isCreating}
                            className="gap-1 shrink-0"
                        >
                            {isCreating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Plus className="h-3 w-3" />
                            )}
                            Criar
                        </Button>
                    </div>

                    <Separator />

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Lists */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Card key={i} className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-2 flex-1">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-24" />
                                            </div>
                                            <Skeleton className="h-8 w-20" />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : filteredLists.length === 0 ? (
                            <EmptyState
                                title={searchTerm ? 'Nenhuma lista encontrada' : 'Nenhuma lista criada ainda'}
                                description="Crie uma nova lista usando o campo acima"
                                className="py-8"
                            />
                        ) : (
                            <div className="space-y-2">
                                {displayedLists.map((list) => (
                                    <Card key={list.id} className="p-3 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-medium truncate">{list.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{formatDate(list.created_date || '')}</span>
                                                    {list.file_count !== undefined && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{list.file_count} música{list.file_count !== 1 ? 's' : ''}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleAddToList(list.id, list.name)}
                                                disabled={isAdding}
                                                className="gap-2"
                                            >
                                                {addMutation.isPending && addMutation.variables?.listId === list.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Plus className="h-3 w-3" />
                                                )}
                                                Adicionar
                                            </Button>
                                        </div>
                                    </Card>
                                ))}

                                {filteredLists.length > 5 && (
                                    <>
                                        <Separator className="my-2" />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpanded(!expanded)}
                                            className="w-full gap-2"
                                        >
                                            {expanded ? (
                                                <>
                                                    <ChevronUp className="h-4 w-4" />
                                                    Mostrar menos
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="h-4 w-4" />
                                                    Mostrar mais ({filteredLists.length - 5} restantes)
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
