'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Cloud,
    CloudOff,
    ExternalLink,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Loader2,
    RotateCcw,
    Settings
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { googleDriveApi, handleApiError } from '@/lib/api'

const DEBUG = false

interface DriveStatus {
    connected: boolean
    user_email?: string
    message: string
}

interface DriveSettings {
    drive_sync_folder_id?: string
    drive_auto_sync_enabled?: string
    drive_sync_interval?: string
}

export function GoogleDriveSettings() {
    const [status, setStatus] = useState<DriveStatus | null>(null)
    const [settings, setSettings] = useState<DriveSettings>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        loadData()

        // Escutar mensagens do popup de autorização
        const handleMessage = (event: MessageEvent) => {
            DEBUG && console.log('🎧 [PARENT] Mensagem recebida:', event.data, 'Origin:', event.origin)

            if (event.data.type === 'DRIVE_AUTH_SUCCESS') {
                DEBUG && console.log('✅ [PARENT] Autorização bem-sucedida!')

                // Resetar estado de conexão
                setIsConnecting(false)

                toast({
                    title: "Google Drive conectado",
                    description: "Autorização realizada com sucesso!",
                })

                // Recarregar dados para atualizar status (com pequeno delay)
                setTimeout(() => {
                    DEBUG && console.log('🔄 [PARENT] Recarregando dados...')
                    loadData()
                }, 800)

            } else if (event.data.type === 'DRIVE_AUTH_ERROR') {
                DEBUG && console.log('❌ [PARENT] Erro na autorização:', event.data.error)

                // Resetar estado de conexão
                setIsConnecting(false)

                toast({
                    title: "Erro na autorização",
                    description: event.data.error || "Não foi possível conectar com o Google Drive.",
                    variant: "destructive",
                })
            }
        }

        window.addEventListener('message', handleMessage)

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [])

    const loadData = async () => {
        try {
            setIsLoading(true)
            DEBUG && console.log('📊 [LOAD] Carregando dados...')

            const [statusData, settingsData] = await Promise.all([
                googleDriveApi.getStatus(),
                googleDriveApi.getSettings()
            ])

            DEBUG && console.log('📊 [LOAD] Status recebido:', statusData)
            DEBUG && console.log('📊 [LOAD] Settings recebidos:', settingsData)

            setStatus({
                connected: Boolean((statusData as any).connected),
                user_email: (statusData as any).user_email,
                message: (statusData as any).message || ((statusData as any).connected ? 'Conectado com sucesso' : 'Não autorizado'),
            })
            setSettings(settingsData.settings || {})

            DEBUG && console.log('📊 [LOAD] Estados atualizados')
        } catch (error) {
            console.error('❌ [LOAD] Erro ao carregar dados:', error)
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleConnect = async () => {
        try {
            setIsConnecting(true)
            DEBUG && console.log('🔗 [CONNECT] Iniciando conexão...')

            const data = await googleDriveApi.getAuthUrl()
            DEBUG && console.log('🌐 [CONNECT] URL de auth recebida:', data)

            if (data.success) {
                DEBUG && console.log('🪟 [CONNECT] Abrindo popup...')
                // Abrir popup para autorização
                const popup = window.open(
                    data.authorization_url,
                    'google_auth_popup',
                    'width=500,height=600,scrollbars=yes,resizable=yes'
                )

                if (popup) {
                    DEBUG && console.log('✅ [CONNECT] Popup aberto com sucesso')

                    // Verificar se popup foi fechado manualmente (com tratamento de CORS)
                    const checkClosed = setInterval(() => {
                        try {
                            if (popup.closed) {
                                DEBUG && console.log('🔄 [CONNECT] Popup foi fechado')
                                clearInterval(checkClosed)
                                setIsConnecting(false)
                            }
                        } catch (error) {
                            // Ignora erro de CORS do popup.closed silenciosamente
                            // (Cross-Origin-Opener-Policy bloqueia acesso ao popup.closed)
                        }
                    }, 2000) // Verificar menos frequentemente
                } else {
                    DEBUG && console.log('❌ [CONNECT] Falha ao abrir popup')
                    throw new Error('Popup foi bloqueado pelo navegador')
                }
            } else {
                throw new Error(data.error || 'Erro ao obter URL de autorização')
            }
        } catch (error) {
            console.error('❌ [CONNECT] Erro ao conectar:', error)
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive",
            })
            setIsConnecting(false)
        }
    }

    const handleSync = async () => {
        try {
            setIsSyncing(true)
            const data = await googleDriveApi.sync()

            if (!data.success) throw new Error(data.error || 'Erro na sincronização')

            // Toast de progresso persistente enquanto durar a sync
            const t = toast({
                title: 'Sincronizando...',
                description: '0 de 0 músicas',
                duration: 1000000,
            })

            // Poll no backend via /debug para ler progresso
            let stopped = false
            const poll = async () => {
                if (stopped) return
                try {
                    const dbg = await googleDriveApi.getDebugInfo()
                    const p = dbg?.sync_progress || {}
                    const total = Number(p.total || 0)
                    const done = Number(p.done || 0)
                    const last = p.last_file || ''
                    const inProgress = Boolean(p.in_progress)

                    t.update({
                        id: t.id,
                        title: inProgress ? 'Sincronizando...' : 'Sincronização concluída',
                        description: `${done} de ${total} músicas${last ? ` • Última: ${last}` : ''}`,
                    })

                    if (!inProgress) {
                        stopped = true
                        t.update({
                            id: t.id,
                            title: 'Sincronização concluída',
                            description: `${done} de ${total} músicas`,
                        })
                        setTimeout(() => t.dismiss(), 3000)
                        return
                    }
                } catch { }
                setTimeout(poll, 1000)
            }
            poll()
        } catch (error) {
            console.error('Erro na sincronização:', error)
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSaveSettings = async () => {
        try {
            setIsSaving(true)
            const data = await googleDriveApi.saveSettings(settings)

            if (data.success) {
                toast({
                    title: "Configurações salvas",
                    description: data.message,
                })
            } else {
                throw new Error(data.error || 'Erro ao salvar configurações')
            }
        } catch (error) {
            console.error('Erro ao salvar:', error)
            toast({
                title: "Erro",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDebug = async () => {
        try {
            const debugInfo = await googleDriveApi.getDebugInfo()
            DEBUG && console.log('🔍 [DEBUG] Info completa:', debugInfo)

            // Também testar diretamente o backend
            DEBUG && console.log('🔍 [DEBUG] Testando direto no backend...')
            if (DEBUG) {
                try {
                    const directResponse = await fetch('http://127.0.0.1:5000/api/google-drive/status', {
                        method: 'GET',
                        // Evitar preflight no modo DEBUG
                        // Não enviar Content-Type para GET simples
                    })
                    console.log('🔍 [DEBUG] Response status:', directResponse.status)
                    const directStatus = await directResponse.json()
                    console.log('🔍 [DEBUG] Status direto do backend:', directStatus)
                } catch (directError) {
                    console.error('🔍 [DEBUG] Erro na chamada direta:', directError)
                }
            }

            toast({
                title: "Debug executado",
                description: "Verifique o console para detalhes completos",
            })
        } catch (error) {
            console.error('Erro no debug:', error)
            toast({
                title: "Erro no debug",
                description: handleApiError(error),
                variant: "destructive",
            })
        }
    }

    const handleClearCache = async () => {
        try {
            DEBUG && console.log('🧹 [CLEAR-CACHE] Limpando cache...')

            const result = await googleDriveApi.clearCache()
            DEBUG && console.log('🧹 [CLEAR-CACHE] Resultado:', result)

            if (result.success) {
                toast({
                    title: "Cache limpo",
                    description: "Cache de credenciais foi limpo com sucesso",
                })

                // Recarregar dados após limpar cache
                setTimeout(() => {
                    loadData()
                }, 500)
            } else {
                throw new Error(result.error || 'Falha ao limpar cache')
            }

        } catch (error) {
            console.error('❌ [CLEAR-CACHE] Erro:', error)
            toast({
                title: "Erro ao limpar cache",
                description: "Falha ao limpar cache de credenciais",
                variant: "destructive"
            })
        }
    }

    const updateSetting = (key: keyof DriveSettings, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        <CardTitle>Google Drive</CardTitle>
                    </div>
                    <CardDescription>
                        Configurações de sincronização com Google Drive
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        <CardTitle>Google Drive</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {status?.connected ? (
                            <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Conectado
                            </Badge>
                        ) : (
                            <Badge variant="destructive">
                                <CloudOff className="h-3 w-3 mr-1" />
                                Desconectado
                            </Badge>
                        )}
                    </div>
                </div>
                <CardDescription>
                    Configurações de sincronização com Google Drive
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Status da Conexão */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Status da Conexão</h4>
                            <p className="text-sm text-muted-foreground">
                                {status?.message}
                            </p>
                            {status?.connected && status?.user_email && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    Conectado como: {status.user_email}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {!status?.connected ? (
                                <Button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="flex items-center gap-2"
                                >
                                    {isConnecting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ExternalLink className="h-4 w-4" />
                                    )}
                                    Conectar
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={loadData}
                                    size="sm"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={handleDebug}
                                size="sm"
                                className="text-xs"
                            >
                                🔍 Debug
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleClearCache}
                                size="sm"
                                className="text-xs"
                            >
                                🧹 Limpar Cache
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Configurações */}
                {status?.connected && (
                    <div className="space-y-4">
                        <h4 className="font-medium">Configurações de Sincronização</h4>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="folder_id">ID da Pasta no Google Drive</Label>
                                <Input
                                    id="folder_id"
                                    value={settings.drive_sync_folder_id || ''}
                                    onChange={(e) => updateSetting('drive_sync_folder_id', e.target.value)}
                                    placeholder="Cole o ID da pasta do Google Drive"
                                    className="mt-1"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Obtenha o ID da pasta na URL do Google Drive após "/folders/"
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="auto_sync">Sincronização Automática</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Sincronizar automaticamente novos arquivos
                                    </p>
                                </div>
                                <Switch
                                    id="auto_sync"
                                    checked={settings.drive_auto_sync_enabled === 'true'}
                                    onCheckedChange={(checked) =>
                                        updateSetting('drive_auto_sync_enabled', checked ? 'true' : 'false')
                                    }
                                />
                            </div>

                            {settings.drive_auto_sync_enabled === 'true' && (
                                <div>
                                    <Label htmlFor="sync_interval">Intervalo de Sincronização (minutos)</Label>
                                    <Input
                                        id="sync_interval"
                                        type="number"
                                        min="5"
                                        max="1440"
                                        value={settings.drive_sync_interval || '30'}
                                        onChange={(e) => updateSetting('drive_sync_interval', e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Settings className="h-4 w-4" />
                                )}
                                Salvar Configurações
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleSync}
                                disabled={isSyncing || !settings.drive_sync_folder_id}
                                className="flex items-center gap-2"
                            >
                                {isSyncing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-4 w-4" />
                                )}
                                Sincronizar Agora
                            </Button>
                        </div>
                    </div>
                )}

                {/* Instruções */}
                {!status?.connected && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                            <div className="space-y-2">
                                <h4 className="font-medium">Como configurar:</h4>
                                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                    <li>Crie um projeto no Google Cloud Console</li>
                                    <li>Ative a API do Google Drive</li>
                                    <li>Crie credenciais OAuth 2.0</li>
                                    <li>Baixe o arquivo credentials.json</li>
                                    <li>Coloque-o na pasta raiz do backend</li>
                                    <li>Clique em "Conectar" para autorizar</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
