'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { alertConfigApi, handleApiError } from '@/lib/api'
import type { AlertConfiguration } from '@/types'
import { Settings, Plus, Pencil, Trash2, RefreshCw, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { AlertConfigForm } from '@/components/monitoring/alert-config-form'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function AlertConfigsPage() {
    const { toast } = useToast()
    const router = useRouter()
    const { isAdmin } = useAuth()

    const [configs, setConfigs] = useState<AlertConfiguration[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingConfig, setEditingConfig] = useState<AlertConfiguration | undefined>()
    const [deletingId, setDeletingId] = useState<number | null>(null)

    useEffect(() => {
        if (!isAdmin) {
            router.push('/dashboard')
        } else {
            loadConfigs()
        }
    }, [isAdmin, router])

    const loadConfigs = async () => {
        try {
            setIsLoading(true)
            const response = await alertConfigApi.getAll()
            setConfigs(response.data || [])
        } catch (error) {
            toast({
                title: 'Erro',
                description: handleApiError(error),
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingConfig(undefined)
        setShowForm(true)
    }

    const handleEdit = (config: AlertConfiguration) => {
        setEditingConfig(config)
        setShowForm(true)
    }

    const handleSave = async (formData: any) => {
        try {
            if (editingConfig) {
                await alertConfigApi.update(editingConfig.id, formData)
                toast({
                    title: 'Sucesso',
                    description: 'Configuração atualizada com sucesso',
                })
            } else {
                await alertConfigApi.create(formData)
                toast({
                    title: 'Sucesso',
                    description: 'Configuração criada com sucesso',
                })
            }
            await loadConfigs()
        } catch (error) {
            toast({
                title: 'Erro',
                description: handleApiError(error),
                variant: 'destructive',
            })
            throw error
        }
    }

    const handleToggleEnabled = async (config: AlertConfiguration) => {
        try {
            await alertConfigApi.update(config.id, {
                ...config,
                is_enabled: !config.is_enabled
            })
            toast({
                title: 'Sucesso',
                description: `Alerta ${!config.is_enabled ? 'ativado' : 'desativado'}`,
            })
            await loadConfigs()
        } catch (error) {
            toast({
                title: 'Erro',
                description: handleApiError(error),
                variant: 'destructive',
            })
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await alertConfigApi.delete(id)
            toast({
                title: 'Sucesso',
                description: 'Configuração removida com sucesso',
            })
            await loadConfigs()
        } catch (error) {
            toast({
                title: 'Erro',
                description: handleApiError(error),
                variant: 'destructive',
            })
        } finally {
            setDeletingId(null)
        }
    }

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <AlertCircle className="h-4 w-4 text-destructive" />
            case 'high':
                return <AlertTriangle className="h-4 w-4 text-orange-500" />
            case 'medium':
                return <Info className="h-4 w-4 text-yellow-500" />
            default:
                return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    const getSeverityLabel = (severity: string) => {
        const labels: Record<string, string> = {
            critical: 'Crítico',
            high: 'Alto',
            medium: 'Médio',
            low: 'Baixo',
        }
        return labels[severity] || severity
    }

    const getOperatorLabel = (operator: string) => {
        const labels: Record<string, string> = {
            greater_than: '>',
            greater_than_or_equal: '>=',
            less_than: '<',
            less_than_or_equal: '<=',
            equals: '=',
        }
        return labels[operator] || operator
    }

    if (!isAdmin) {
        return null
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configuração de Alertas</h1>
                        <p className="text-muted-foreground">
                            Configure limites personalizados para alertas automáticos
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadConfigs} variant="outline" disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Alerta
                        </Button>
                    </div>
                </div>

                {/* Info Card */}
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Como funciona
                                </p>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Os alertas são verificados automaticamente a cada 5 minutos pelo sistema. 
                                    Você pode configurar limites de disco, memória, logins falhados e outras métricas. 
                                    Quando um limite é atingido, um alerta é gerado e aparece no sino de notificações.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Configurations Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Configurações Ativas</CardTitle>
                        <CardDescription>
                            {configs.length} configuração(ões) cadastrada(s)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Carregando...
                            </div>
                        ) : configs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhuma configuração encontrada</p>
                                <Button onClick={handleCreate} variant="link" className="mt-2">
                                    Criar primeira configuração
                                </Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ativo</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Condição</TableHead>
                                        <TableHead>Severidade</TableHead>
                                        <TableHead>Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {configs.map((config) => (
                                        <TableRow key={config.id}>
                                            <TableCell>
                                                <Switch
                                                    checked={config.is_enabled}
                                                    onCheckedChange={() => handleToggleEnabled(config)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">{config.name}</div>
                                                    {config.description && (
                                                        <div className="text-sm text-muted-foreground">
                                                            {config.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-mono text-sm">
                                                    {config.metric_type.replace(/_/g, ' ')}{' '}
                                                    {getOperatorLabel(config.comparison_operator)}{' '}
                                                    {config.threshold_value} {config.threshold_unit}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getSeverityIcon(config.severity)}
                                                    <span>{getSeverityLabel(config.severity)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(config)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeletingId(config.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Form Dialog */}
            <AlertConfigForm
                open={showForm}
                onOpenChange={setShowForm}
                config={editingConfig}
                onSave={handleSave}
            />

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deletingId !== null}
                onOpenChange={(open) => !open && setDeletingId(null)}
                title="Confirmar exclusão"
                description="Tem certeza que deseja remover esta configuração de alerta? Esta ação não pode ser desfeita."
                onConfirm={() => { if (deletingId) handleDelete(deletingId) }}
                confirmText="Excluir"
                variant="destructive"
            />
        </MainLayout>
    )
}
