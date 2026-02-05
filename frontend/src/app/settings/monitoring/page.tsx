'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { monitoringApi, handleApiError } from '@/lib/api'
import type { SystemEvent, AuditLog, SystemMetric, SystemHealth } from '@/types'
import { AlertCircle, AlertTriangle, Info, Activity, Database, HardDrive, Users, TrendingUp, RefreshCw, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'

export default function MonitoringPage() {
    const { toast } = useToast()
    const router = useRouter()
    const { isAdmin } = useAuth()

    const [events, setEvents] = useState<SystemEvent[]>([])
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
    const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all')

    // Redirect if not admin
    useEffect(() => {
        if (!isAdmin) {
            router.push('/dashboard')
        }
    }, [isAdmin, router])

    const loadData = async () => {
        try {
            setIsLoading(true)

            // Load events
            const eventsResponse = await monitoringApi.getEvents({ 
                limit: 50,
                severity: selectedSeverity !== 'all' ? selectedSeverity : undefined
            })
            setEvents(eventsResponse.data || [])

            // Load audit logs
            const auditResponse = await monitoringApi.getAuditLogs({ limit: 20 })
            setAuditLogs(auditResponse.data || [])

            // Load system health
            const healthResponse = await monitoringApi.getHealthExtended()
            setSystemHealth(healthResponse.data)

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

    useEffect(() => {
        if (isAdmin) {
            loadData()
        }
    }, [isAdmin, selectedSeverity])

    const getSeverityBadge = (severity: string) => {
        const variants: Record<string, { variant: any; icon: any; label: string }> = {
            critical: { variant: 'destructive', icon: AlertCircle, label: 'Crítico' },
            high: { variant: 'destructive', icon: AlertTriangle, label: 'Alto' },
            medium: { variant: 'default', icon: Info, label: 'Médio' },
            low: { variant: 'secondary', icon: Info, label: 'Baixo' },
        }
        const config = variants[severity] || variants.low
        const Icon = config.icon
        return (
            <Badge variant={config.variant as any} className="gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        )
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const markAsRead = async (eventId: number) => {
        try {
            await monitoringApi.markAlertAsRead(eventId)
            toast({
                title: 'Sucesso',
                description: 'Alerta marcado como lido',
            })
            loadData()
        } catch (error) {
            toast({
                title: 'Erro',
                description: handleApiError(error),
                variant: 'destructive',
            })
        }
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
                        <h1 className="text-3xl font-bold tracking-tight">Monitoramento do Sistema</h1>
                        <p className="text-muted-foreground">
                            Acompanhe eventos, auditoria e saúde do sistema
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <InstructionsModal
                            title={PAGE_INSTRUCTIONS.monitoring.title}
                            description={PAGE_INSTRUCTIONS.monitoring.description}
                            sections={PAGE_INSTRUCTIONS.monitoring.sections}
                        />
                        <Button onClick={loadData} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                    </div>
                </div>

                {/* Metrics Cards */}
                {systemHealth && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Banco de Dados
                                </CardTitle>
                                <Database className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{systemHealth.database?.total_files ?? 0}</div>
                                <p className="text-xs text-muted-foreground">
                                    arquivos • {systemHealth.database?.total_users ?? 0} usuários
                                </p>
                                <div className="mt-2 flex items-center gap-1 text-xs">
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                    <span className="text-green-600 dark:text-green-400">
                                        {(systemHealth.database?.latency_ms ?? 0).toFixed(0)}ms latência
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Armazenamento
                                </CardTitle>
                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {(systemHealth.storage?.total_size_mb ?? 0).toFixed(0)} MB
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {systemHealth.storage?.file_count ?? 0} arquivos
                                </p>
                                {(systemHealth.storage?.orphaned_files ?? 0) > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs">
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                        <span className="text-yellow-600 dark:text-yellow-400">
                                            {systemHealth.storage?.orphaned_files ?? 0} órfãos
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Uptime
                                </CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {systemHealth.system?.uptime_formatted ?? 'N/A'}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    .NET {systemHealth.system?.dotnet_version ?? 'N/A'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Alertas Ativos
                                </CardTitle>
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {events.filter(e => !e.is_read).length}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {events.filter(e => e.severity === 'critical' || e.severity === 'high').length} alta prioridade
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Security Events */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Eventos de Segurança</CardTitle>
                                <CardDescription>Últimos eventos e alertas do sistema</CardDescription>
                            </div>
                            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar severidade" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="critical">Crítico</SelectItem>
                                    <SelectItem value="high">Alto</SelectItem>
                                    <SelectItem value="medium">Médio</SelectItem>
                                    <SelectItem value="low">Baixo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Carregando...
                            </div>
                        ) : events.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum evento encontrado
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Severidade</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Mensagem</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((event) => (
                                        <TableRow key={event.id} className={event.is_read ? 'opacity-50' : ''}>
                                            <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                                            <TableCell className="font-medium">
                                                {event.event_type.replace(/_/g, ' ')}
                                            </TableCell>
                                            <TableCell className="max-w-md truncate">
                                                {event.message}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(event.created_date)}
                                            </TableCell>
                                            <TableCell>
                                                {!event.is_read && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => markAsRead(event.id)}
                                                    >
                                                        Marcar lido
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Audit Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Logs de Auditoria</CardTitle>
                        <CardDescription>Últimas ações dos usuários</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Carregando...
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum log encontrado
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ação</TableHead>
                                        <TableHead>Entidade</TableHead>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>IP</TableHead>
                                        <TableHead>Data</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <Badge variant="outline">{log.action}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.entity_type}
                                                {log.entity_id && ` #${log.entity_id}`}
                                            </TableCell>
                                            <TableCell>{log.username}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {log.ip_address || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(log.created_date)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
