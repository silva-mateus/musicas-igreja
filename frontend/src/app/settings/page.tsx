'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Settings,
    Save,
    RefreshCw,
    FileCheck,
    RotateCcw,
    Cloud,
    Shield,
    CheckCircle,
    AlertCircle,
    Loader2,
    Search,
    User,
    Music,
    Hash,
    Database
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { GoogleDriveSettings } from '@/components/settings/google-drive-settings'
import { adminApi, request } from '@/lib/api'

interface MismatchedFile {
    id: number
    current_filename: string
    expected_filename: string
    song_name: string
    artist: string
    musical_key: string
    file_path: string
}

interface VerificationResult {
    total_files: number
    mismatched_count: number
    mismatched_files: MismatchedFile[]
}

interface DiscoveryResult {
    discovered: {
        artists: string[]
        categories: string[]
        liturgical_times: string[]
        musical_keys: string[]
    }
    registered: {
        artists: string[]
        categories: string[]
        liturgical_times: string[]
        musical_keys: string[]
    }
    stats: {
        total_files: number
        files_processed: number
    }
}

interface PermissionsResult {
    data_dir: {
        path: string
        exists: boolean
        writable: boolean
        permissions: any
    }
    organized_dir: {
        path: string
        exists: boolean
        writable: boolean
        permissions: any
    }
    uploads_dir: {
        path: string
        exists: boolean
        writable: boolean
        permissions: any
    }
}

export default function SettingsPage() {
    const { toast } = useToast()

    // PDF Verification
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [isFixing, setIsFixing] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<number[]>([])

    // Entity Discovery
    const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null)
    const [isDiscovering, setIsDiscovering] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [selectedEntities, setSelectedEntities] = useState<{
        artists: string[]
        categories: string[]
        liturgical_times: string[]
    }>({
        artists: [],
        categories: [],
        liturgical_times: []
    })

    // Permissions Check
    const [permissionsResult, setPermissionsResult] = useState<PermissionsResult | null>(null)
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(false)
    const [isFixingPermissions, setIsFixingPermissions] = useState(false)

    const [isLoading, setIsLoading] = useState(false)

    const handleVerifyPdfs = async () => {
        setIsVerifying(true)
        try {
            const response = await fetch('/api/admin/verify-pdfs')
            const data = await response.json()

            if (response.ok) {
                setVerificationResult(data)
                setSelectedFiles([]) // Clear selection
                toast({
                    title: "Verificação concluída",
                    description: `${data.mismatched_count} de ${data.total_files} arquivos precisam ser corrigidos.`,
                })
            } else {
                throw new Error(data.error || 'Erro na verificação')
            }
        } catch (error: any) {
            toast({
                title: "Erro na verificação",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsVerifying(false)
        }
    }

    const handleFixPdfs = async () => {
        if (selectedFiles.length === 0) return

        setIsFixing(true)
        try {
            const response = await fetch('/api/admin/fix-pdf-names', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_ids: selectedFiles })
            })

            const data = await response.json()

            if (response.ok) {
                toast({
                    title: "Correção concluída",
                    description: `${data.fixed_count} arquivos foram corrigidos.`,
                })
                // Refresh verification after fixing
                handleVerifyPdfs()
            } else {
                throw new Error(data.error || 'Erro na correção')
            }
        } catch (error: any) {
            toast({
                title: "Erro na correção",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsFixing(false)
        }
    }

    const handleSelectAll = () => {
        if (!verificationResult) return

        if (selectedFiles.length === verificationResult.mismatched_files.length) {
            setSelectedFiles([])
        } else {
            setSelectedFiles(verificationResult.mismatched_files.map(f => f.id))
        }
    }

    const handleFileSelect = (fileId: number) => {
        setSelectedFiles(prev =>
            prev.includes(fileId)
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        )
    }

    // Entity Discovery Functions
    const handleDiscoverEntities = async () => {
        setIsDiscovering(true)
        try {
            const data = await adminApi.discoverEntities()

            if (data.success) {
                setDiscoveryResult(data.data)
                setSelectedEntities({
                    artists: data.data.discovered.artists,
                    categories: data.data.discovered.categories,
                    liturgical_times: data.data.discovered.liturgical_times
                })
                toast({
                    title: "Descoberta concluída",
                    description: `Encontrados ${data.data.discovered.artists.length} artistas, ${data.data.discovered.categories.length} categorias e ${data.data.discovered.liturgical_times.length} tempos litúrgicos não cadastrados.`,
                })
            } else {
                throw new Error(data.error || 'Erro na descoberta')
            }
        } catch (error: any) {
            toast({
                title: "Erro na descoberta",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsDiscovering(false)
        }
    }

    const handleRegisterEntities = async () => {
        if (Object.values(selectedEntities).every(arr => arr.length === 0)) {
            toast({
                title: "Nenhuma entidade selecionada",
                description: "Selecione pelo menos uma entidade para registrar.",
                variant: "destructive",
            })
            return
        }

        setIsRegistering(true)
        try {
            const data = await adminApi.registerEntities(selectedEntities)

            if (data.success) {
                toast({
                    title: "Registro concluído",
                    description: data.message,
                })
                // Refresh discovery after registering
                handleDiscoverEntities()
            } else {
                throw new Error(data.error || 'Erro no registro')
            }
        } catch (error: any) {
            toast({
                title: "Erro no registro",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsRegistering(false)
        }
    }

    const handleCleanupEntities = async () => {
        try {
            const data = await adminApi.cleanupEntities()

            if (data.success) {
                toast({
                    title: "Limpeza concluída",
                    description: data.message,
                })
                // Refresh discovery after cleanup
                if (discoveryResult) {
                    handleDiscoverEntities()
                }
            } else {
                throw new Error(data.error || 'Erro na limpeza')
            }
        } catch (error: any) {
            toast({
                title: "Erro na limpeza",
                description: error.message,
                variant: "destructive",
            })
        }
    }

    const handleEntitySelect = (type: keyof typeof selectedEntities, entity: string) => {
        setSelectedEntities(prev => ({
            ...prev,
            [type]: prev[type].includes(entity)
                ? prev[type].filter(e => e !== entity)
                : [...prev[type], entity]
        }))
    }

    const handleSelectAllEntities = (type: keyof typeof selectedEntities) => {
        if (!discoveryResult) return

        const allEntities = discoveryResult.discovered[type]
        setSelectedEntities(prev => ({
            ...prev,
            [type]: prev[type].length === allEntities.length ? [] : allEntities
        }))
    }

    // Permissions Functions
    const handleCheckPermissions = async () => {
        setIsCheckingPermissions(true)
        try {
            const data = await request<any>('/admin/check-permissions')
            setPermissionsResult(data)
            toast({
                title: "Verificação concluída",
                description: "Permissões dos diretórios foram verificadas.",
            })
        } catch (error: any) {
            toast({
                title: "Erro na verificação",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsCheckingPermissions(false)
        }
    }

    const handleFixPermissions = async () => {
        setIsFixingPermissions(true)
        try {
            const data = await request<any>('/admin/fix-permissions')
            toast({
                title: "Correção concluída",
                description: "Tentativa de correção de permissões realizada.",
            })
            // Refresh permissions check
            handleCheckPermissions()
        } catch (error: any) {
            toast({
                title: "Erro na correção",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsFixingPermissions(false)
        }
    }



    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Settings className="h-8 w-8 text-primary" />
                            Configurações
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Gerencie as configurações do sistema e ferramentas administrativas
                        </p>
                    </div>
                </div>

                {/* PDF Verification Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCheck className="h-5 w-5" />
                            Verificação de PDFs
                        </CardTitle>
                        <CardDescription>
                            Verifique se os nomes dos arquivos PDF seguem o padrão "Nome da Música - Tom - Artista"
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleVerifyPdfs}
                                            disabled={isVerifying}
                                            className="gap-2"
                                        >
                                            {isVerifying ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileCheck className="h-4 w-4" />
                                            )}
                                            {isVerifying ? 'Verificando...' : 'Verificar PDFs'}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Verificar se todos os PDFs seguem o padrão de nomenclatura</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {verificationResult && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline" className="gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            {verificationResult.total_files - verificationResult.mismatched_count} corretos
                                        </Badge>
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {verificationResult.mismatched_count} precisam correção
                                        </Badge>
                                    </div>
                                    {verificationResult.mismatched_count > 0 && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSelectAll}
                                            >
                                                {selectedFiles.length === verificationResult.mismatched_files.length
                                                    ? 'Desselecionar todos'
                                                    : 'Selecionar todos'}
                                            </Button>
                                            <Button
                                                onClick={handleFixPdfs}
                                                disabled={selectedFiles.length === 0 || isFixing}
                                                className="gap-2"
                                            >
                                                {isFixing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="h-4 w-4" />
                                                )}
                                                Corrigir Selecionados ({selectedFiles.length})
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {verificationResult.mismatched_count > 0 && (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {verificationResult.mismatched_files.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFiles.includes(file.id)}
                                                    onChange={() => handleFileSelect(file.id)}
                                                    className="rounded"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">
                                                        Atual: {file.current_filename}
                                                    </div>
                                                    <div className="text-sm text-green-600 truncate">
                                                        Esperado: {file.expected_filename}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {file.song_name} - {file.musical_key || 'Sem tom'} - {file.artist}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Entity Discovery Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Descoberta de Entidades
                        </CardTitle>
                        <CardDescription>
                            Descubra e cadastre automaticamente artistas, categorias, tempos litúrgicos e tons musicais presentes nos arquivos
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleDiscoverEntities}
                                            disabled={isDiscovering}
                                            className="gap-2"
                                        >
                                            {isDiscovering ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Search className="h-4 w-4" />
                                            )}
                                            {isDiscovering ? 'Descobrindo...' : 'Descobrir Entidades'}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Analisar o banco de dados para encontrar entidades não cadastradas</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleCleanupEntities}
                                            variant="outline"
                                            className="gap-2"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            Limpar Vazios
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Remover entidades vazias ou duplicadas</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {discoveryResult && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline" className="gap-1">
                                            <Music className="h-3 w-3" />
                                            {discoveryResult.stats.total_files} arquivos analisados
                                        </Badge>
                                        <Badge variant="outline" className="gap-1">
                                            <User className="h-3 w-3" />
                                            {discoveryResult.registered.artists.length} artistas cadastrados
                                        </Badge>
                                        <Badge variant="outline" className="gap-1">
                                            <Hash className="h-3 w-3" />
                                            {discoveryResult.registered.categories.length} categorias cadastradas
                                        </Badge>
                                    </div>

                                    {(discoveryResult.discovered.artists.length > 0 ||
                                        discoveryResult.discovered.categories.length > 0 ||
                                        discoveryResult.discovered.liturgical_times.length > 0) && (
                                            <Button
                                                onClick={handleRegisterEntities}
                                                disabled={isRegistering || Object.values(selectedEntities).every(arr => arr.length === 0)}
                                                className="gap-2"
                                            >
                                                {isRegistering ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                                Registrar Selecionados ({Object.values(selectedEntities).reduce((sum, arr) => sum + arr.length, 0)})
                                            </Button>
                                        )}
                                </div>

                                {/* Artists Section */}
                                {discoveryResult.discovered.artists.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                Artistas Descobertos ({discoveryResult.discovered.artists.length})
                                            </Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectAllEntities('artists')}
                                            >
                                                {selectedEntities.artists.length === discoveryResult.discovered.artists.length
                                                    ? 'Desselecionar todos'
                                                    : 'Selecionar todos'}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                            {discoveryResult.discovered.artists.map((artist) => (
                                                <div
                                                    key={artist}
                                                    className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntities.artists.includes(artist)}
                                                        onChange={() => handleEntitySelect('artists', artist)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm truncate">{artist}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Categories Section */}
                                {discoveryResult.discovered.categories.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2">
                                                <Hash className="h-4 w-4" />
                                                Categorias Descobertas ({discoveryResult.discovered.categories.length})
                                            </Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectAllEntities('categories')}
                                            >
                                                {selectedEntities.categories.length === discoveryResult.discovered.categories.length
                                                    ? 'Desselecionar todos'
                                                    : 'Selecionar todos'}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                            {discoveryResult.discovered.categories.map((category) => (
                                                <div
                                                    key={category}
                                                    className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntities.categories.includes(category)}
                                                        onChange={() => handleEntitySelect('categories', category)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm truncate">{category}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Liturgical Times Section */}
                                {discoveryResult.discovered.liturgical_times.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2">
                                                <Music className="h-4 w-4" />
                                                Tempos Litúrgicos Descobertos ({discoveryResult.discovered.liturgical_times.length})
                                            </Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectAllEntities('liturgical_times')}
                                            >
                                                {selectedEntities.liturgical_times.length === discoveryResult.discovered.liturgical_times.length
                                                    ? 'Desselecionar todos'
                                                    : 'Selecionar todos'}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                            {discoveryResult.discovered.liturgical_times.map((time) => (
                                                <div
                                                    key={time}
                                                    className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntities.liturgical_times.includes(time)}
                                                        onChange={() => handleEntitySelect('liturgical_times', time)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm truncate">{time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                {(discoveryResult.discovered.artists.length === 0 &&
                                    discoveryResult.discovered.categories.length === 0 &&
                                    discoveryResult.discovered.liturgical_times.length === 0) && (
                                        <div className="text-center py-4 text-muted-foreground">
                                            <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                                            <p>Todas as entidades já estão cadastradas!</p>
                                        </div>
                                    )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Permissions Diagnostic Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Diagnóstico de Permissões
                        </CardTitle>
                        <CardDescription>
                            Verifique e corrija permissões de escrita nos diretórios do sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleCheckPermissions}
                                            disabled={isCheckingPermissions}
                                            className="gap-2"
                                        >
                                            {isCheckingPermissions ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Shield className="h-4 w-4" />
                                            )}
                                            {isCheckingPermissions ? 'Verificando...' : 'Verificar Permissões'}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Verificar permissões de escrita nos diretórios</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleFixPermissions}
                                            disabled={isFixingPermissions}
                                            variant="outline"
                                            className="gap-2"
                                        >
                                            {isFixingPermissions ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="h-4 w-4" />
                                            )}
                                            {isFixingPermissions ? 'Corrigindo...' : 'Corrigir Permissões'}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Tentar corrigir permissões automaticamente</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {permissionsResult && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {Object.entries(permissionsResult).map(([key, info]) => (
                                        <div key={key} className="space-y-2">
                                            <h4 className="font-medium capitalize">
                                                {key.replace('_dir', '').replace('_', ' ')}
                                            </h4>
                                            <div className="text-sm space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Caminho:</span>
                                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                                        {info.path}
                                                    </code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Existe:</span>
                                                    <Badge variant={info.exists ? "default" : "destructive"}>
                                                        {info.exists ? "Sim" : "Não"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Gravável:</span>
                                                    <Badge variant={info.writable ? "default" : "destructive"}>
                                                        {info.writable ? "Sim" : "Não"}
                                                    </Badge>
                                                </div>
                                                {info.permissions && typeof info.permissions === 'object' && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Permissões: {info.permissions.octal}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Summary */}
                                <div className="flex items-center gap-4 pt-2 border-t">
                                    {Object.values(permissionsResult).every(info => !info.exists) && (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Diretórios não encontrados
                                        </Badge>
                                    )}
                                    {Object.values(permissionsResult).some(info => info.exists && !info.writable) && (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Permissões insuficientes
                                        </Badge>
                                    )}
                                    {Object.values(permissionsResult).every(info => info.exists && info.writable) && (
                                        <Badge variant="default" className="gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            Todas as permissões OK
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Google Drive Sync Section */}
                <GoogleDriveSettings />

                {/* System Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Informações do Sistema
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">Versão:</span> 2.0.0
                            </div>
                            <div>
                                <span className="font-medium">Banco de Dados:</span> SQLite
                            </div>
                            <div>
                                <span className="font-medium">Estrutura:</span> /organized
                            </div>
                            <div>
                                <span className="font-medium">Padrão de nome:</span> Música - Tom - Artista
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}