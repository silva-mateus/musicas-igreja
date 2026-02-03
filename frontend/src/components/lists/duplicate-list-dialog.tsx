'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Loader2 } from 'lucide-react'
import { listsApi, handleApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface DuplicateListDialogProps {
    listId: number
    listName: string
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function DuplicateListDialog({ listId, listName, trigger, onSuccess }: DuplicateListDialogProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [newName, setNewName] = useState(`${listName} - Cópia`)
    const [isDuplicating, setIsDuplicating] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim()) return

        setIsDuplicating(true)
        try {
            const response = await listsApi.duplicateList(listId, newName.trim())

            setOpen(false)
            setNewName(`${listName} - Cópia`)

            toast({
                title: "Lista duplicada!",
                description: response.message,
            })

            onSuccess?.()

            setTimeout(() => {
                router.push(`/lists/${response.new_list_id}/edit`)
            }, 1000)

        } catch (error) {
            toast({
                title: "Erro ao duplicar lista",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsDuplicating(false)
        }
    }

    const handleClose = () => {
        setOpen(false)
        setNewName(`${listName} - Cópia`)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" title="Duplicar lista">
                        <Copy className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="h-5 w-5" />
                        Duplicar Lista
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="newName">Nome da nova lista</Label>
                        <Input
                            id="newName"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Digite o nome da nova lista"
                            disabled={isDuplicating}
                            autoFocus
                        />
                    </div>

                    <div className="text-sm text-muted-foreground">
                        A nova lista será criada com todas as músicas da lista "{listName}".
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isDuplicating}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isDuplicating || !newName.trim()}
                            className="gap-2"
                        >
                            {isDuplicating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Duplicando...
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                    Duplicar Lista
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
