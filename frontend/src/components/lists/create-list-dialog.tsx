'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { listsApi, handleApiError } from '@/lib/api'
import type { MusicList } from '@/types'
import { Plus, Music, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CreateListDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onListCreated: (list: MusicList) => void
}

interface FormData {
    name: string
    observations: string
}

export function CreateListDialog({ open, onOpenChange, onListCreated }: CreateListDialogProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [formData, setFormData] = useState<FormData>({
        name: '',
        observations: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState<Partial<FormData>>({})

    const validateForm = (): boolean => {
        const newErrors: Partial<FormData> = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Nome da lista é obrigatório'
        } else if (formData.name.length < 3) {
            newErrors.name = 'Nome deve ter pelo menos 3 caracteres'
        } else if (formData.name.length > 100) {
            newErrors.name = 'Nome deve ter no máximo 100 caracteres'
        }

        if (formData.observations.length > 500) {
            newErrors.observations = 'Observações devem ter no máximo 500 caracteres'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) return

        setIsLoading(true)
        try {
            const response = await listsApi.createList(
                formData.name.trim(),
                formData.observations.trim() || undefined
            )

            handleClose()

            toast({
                title: "Lista criada com sucesso!",
                description: `A lista "${formData.name}" foi criada. Redirecionando para edição...`,
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
        setFormData({ name: '', observations: '' })
        setErrors({})
        onOpenChange(false)
    }

    const handleChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Nome da Lista <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="Ex: Missa Dominical, Festa Junina, Casamento..."
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className={errors.name ? 'border-destructive' : ''}
                            maxLength={100}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {formData.name.length}/100 caracteres
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="observations">
                            Observações <span className="text-muted-foreground">(opcional)</span>
                        </Label>
                        <Textarea
                            id="observations"
                            placeholder="Descreva o propósito desta lista, ocasião de uso, ou outras informações relevantes..."
                            value={formData.observations}
                            onChange={(e) => handleChange('observations', e.target.value)}
                            className={errors.observations ? 'border-destructive' : ''}
                            rows={3}
                            maxLength={500}
                        />
                        {errors.observations && (
                            <p className="text-sm text-destructive">{errors.observations}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {formData.observations.length}/500 caracteres
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
                        onClick={handleSubmit}
                        disabled={isLoading || !formData.name.trim()}
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