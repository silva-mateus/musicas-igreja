'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { listsApi, handleApiError } from '@/lib/api'
import type { MusicList } from '@/types'
import { Plus, Music, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Zod schema for validation
const createListSchema = z.object({
    name: z.string()
        .min(1, 'Nome da lista é obrigatório')
        .min(3, 'Nome deve ter pelo menos 3 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres'),
    observations: z.string()
        .max(500, 'Observações devem ter no máximo 500 caracteres')
        .optional()
        .or(z.literal('')),
})

type CreateListFormData = z.infer<typeof createListSchema>

interface CreateListDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onListCreated: (list: MusicList) => void
}

export function CreateListDialog({ open, onOpenChange, onListCreated }: CreateListDialogProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<CreateListFormData>({
        resolver: zodResolver(createListSchema),
        defaultValues: {
            name: '',
            observations: '',
        },
    })

    const handleSubmit = async (data: CreateListFormData) => {
        setIsLoading(true)
        try {
            const response = await listsApi.createList(
                data.name.trim(),
                data.observations?.trim() || undefined
            )

            handleClose()

            toast({
                title: "Lista criada com sucesso!",
                description: `A lista "${data.name}" foi criada. Redirecionando para edição...`,
            })

            // Redirecionar para a página de edição da lista criada
            setTimeout(() => {
                router.push(`/lists/${response.list_id}/edit`)
            }, 1000)

        } catch (error) {
            toast({
                title: "Erro ao criar lista",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        form.reset()
        onOpenChange(false)
    }

    const watchName = form.watch('name')
    const watchObservations = form.watch('observations')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Music className="h-5 w-5" />
                        Nova Lista de Música
                    </DialogTitle>
                    <DialogDescription>
                        Crie uma nova lista para organizar suas músicas por tema, evento ou categoria.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Nome da Lista <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="Ex: Missa Dominical, Festa Junina, Casamento..."
                            {...form.register('name')}
                            className={form.formState.errors.name ? 'border-destructive' : ''}
                            maxLength={100}
                        />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {watchName?.length || 0}/100 caracteres
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="observations">
                            Observações <span className="text-muted-foreground">(opcional)</span>
                        </Label>
                        <Textarea
                            id="observations"
                            placeholder="Descreva o propósito desta lista, ocasião de uso, ou outras informações relevantes..."
                            {...form.register('observations')}
                            className={form.formState.errors.observations ? 'border-destructive' : ''}
                            rows={3}
                            maxLength={500}
                        />
                        {form.formState.errors.observations && (
                            <p className="text-sm text-destructive">{form.formState.errors.observations.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {watchObservations?.length || 0}/500 caracteres
                        </p>
                    </div>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        onClick={form.handleSubmit(handleSubmit)}
                        disabled={isLoading || !watchName?.trim()}
                        className="gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Criar Lista
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
