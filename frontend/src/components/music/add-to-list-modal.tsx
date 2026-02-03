'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
    ListPlus,
    Search,
    Calendar,
    Music,
    Plus,
    ChevronDown,
    ChevronUp,
    Loader2
} from 'lucide-react'
import { listsApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { MusicList } from '@/types'

interface AddToListModalProps {
    musicId: number
    musicTitle: string
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function AddToListModal({ musicId, musicTitle, trigger, onSuccess }: AddToListModalProps) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [lists, setLists] = useState<MusicList[]>([])
    const [filteredLists, setFilteredLists] = useState<MusicList[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [addingToList, setAddingToList] = useState<number | null>(null)
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        if (open) {
            loadLists()
        }
    }, [open])

    useEffect(() => {
        if (searchTerm.trim()) {
            const filtered = lists.filter(list =>
                list.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            setFilteredLists(filtered)
        } else {
            setFilteredLists(lists)
        }
    }, [lists, searchTerm])

    const loadLists = async () => {
        setIsLoading(true)
        try {
            const response = await listsApi.getLists({ page: 1, limit: 1000 })

            const sortedLists = (response.data || []).sort((a, b) =>
                new Date(b.created_date || '').getTime() - new Date(a.created_date || '').getTime()
            )
            setLists(sortedLists)
            setFilteredLists(sortedLists)
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar as listas.",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddToList = async (listId: number, listName: string) => {
        setAddingToList(listId)
        try {
            await listsApi.addMusicToList(listId, musicId)
            toast({
                title: "Música adicionada!",
                description: `"${musicTitle}" foi adicionada à lista "${listName}".`
            })
            setOpen(false)
            onSuccess?.()
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível adicionar a música à lista.",
                variant: "destructive"
            })
        } finally {
            setAddingToList(null)
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

    const displayedLists = expanded ? filteredLists : filteredLists.slice(0, 5)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" title="Adicionar à lista">
                        <ListPlus className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListPlus className="h-5 w-5" />
                        Adicionar à Lista
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Selecione uma lista para adicionar "<span className="font-medium">{musicTitle}</span>"
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
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
                            <div className="text-center py-8">
                                <Music className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    {searchTerm ? 'Nenhuma lista encontrada' : 'Nenhuma lista criada ainda'}
                                </p>
                            </div>
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
                                                disabled={addingToList !== null}
                                                className="gap-2"
                                            >
                                                {addingToList === list.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Plus className="h-3 w-3" />
                                                )}
                                                Adicionar
                                            </Button>
                                        </div>
                                    </Card>
                                ))}

                                {/* Show More/Less Button */}
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
