'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Settings,
    RotateCcw,
    Database,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    ArrowLeft
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { setupApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DevToolsPage() {
    const { toast } = useToast()
    const router = useRouter()
    const [isResetting, setIsResetting] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    const [lastAction, setLastAction] = useState<string | null>(null)

    const handleReset = async () => {
        if (!confirm('Tem certeza? Isso irá ocultar temporariamente todos os usuários existentes para testar o setup inicial.')) {
            return
        }

        setIsResetting(true)
        try {
            await setupApi.resetForTesting()
            setLastAction('reset')

            toast({
                title: "Reset executado com sucesso!",
                description: "Sistema configurado para mostrar tela de setup inicial. Seus dados estão salvos em backup.",
            })

            // Aguardar um pouco e redirecionar para home (que vai detectar a necessidade de setup)
            setTimeout(() => {
                router.push('/')
            }, 2000)

        } catch (error: any) {
            toast({
                title: "Erro no reset",
                description: error.response?.data?.error || 'Erro ao executar reset',
                variant: "destructive"
            })
        } finally {
            setIsResetting(false)
        }
    }

    const handleRestore = async () => {
        if (!confirm('Restaurar dados originais? Isso irá voltar o sistema ao estado anterior.')) {
            return
        }

        setIsRestoring(true)
        try {
            await setupApi.restoreOriginalData()
            setLastAction('restore')

            toast({
                title: "Dados restaurados com sucesso!",
                description: "Sistema voltou ao estado original com todos os usuários.",
            })

            // Aguardar um pouco e redirecionar
            setTimeout(() => {
                router.push('/')
            }, 2000)

        } catch (error: any) {
            toast({
                title: "Erro na restauração",
                description: error.response?.data?.error || 'Erro ao restaurar dados',
                variant: "destructive"
            })
        } finally {
            setIsRestoring(false)
        }
    }

    // Verificar se está em desenvolvimento
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                <Card className="max-w-md">
                    <CardHeader className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <CardTitle className="text-red-800">Acesso Negado</CardTitle>
                        <CardDescription>
                            Esta página está disponível apenas em modo de desenvolvimento.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Button variant="outline" asChild>
                            <Link href="/">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Voltar ao Início
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <Settings className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            🔧 Dev Tools - Sistema de Músicas
                        </h1>
                        <p className="text-gray-600">
                            Ferramentas de desenvolvimento para testar funcionalidades
                        </p>
                        <Badge variant="outline" className="mt-2">
                            Desenvolvimento Apenas
                        </Badge>
                    </div>
                </div>

                {/* Warning */}
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-800">
                            <AlertTriangle className="w-5 h-5" />
                            Atenção - Ferramentas de Desenvolvimento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-yellow-700 text-sm">
                            Estas ferramentas são apenas para teste e desenvolvimento.
                            O <strong>reset</strong> move temporariamente os usuários para backup,
                            e o <strong>restore</strong> os traz de volta. Nenhum dado é perdido permanentemente.
                        </p>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Reset para Setup */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-blue-600" />
                                Reset para Setup Inicial
                            </CardTitle>
                            <CardDescription>
                                Simula a primeira execução do sistema para testar a tela de configuração inicial.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-sm text-gray-600">
                                    <strong>O que faz:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Move usuários existentes para tabela de backup</li>
                                        <li>Sistema detecta necessidade de configuração inicial</li>
                                        <li>Redireciona automaticamente para /setup</li>
                                        <li>Permite testar criação do primeiro admin</li>
                                    </ul>
                                </div>
                                <Button
                                    onClick={handleReset}
                                    disabled={isResetting}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {isResetting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Executando Reset...
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Executar Reset
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Restore Dados */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-green-600" />
                                Restaurar Dados Originais
                            </CardTitle>
                            <CardDescription>
                                Volta o sistema ao estado original com todos os usuários e dados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-sm text-gray-600">
                                    <strong>O que faz:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Restaura todos os usuários do backup</li>
                                        <li>Sistema volta ao funcionamento normal</li>
                                        <li>Mantém todos os PDFs e listas existentes</li>
                                        <li>Login funciona normalmente</li>
                                    </ul>
                                </div>
                                <Button
                                    onClick={handleRestore}
                                    disabled={isRestoring}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {isRestoring ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Restaurando...
                                        </>
                                    ) : (
                                        <>
                                            <Database className="w-4 h-4 mr-2" />
                                            Restaurar Dados
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Status */}
                {lastAction && (
                    <Card className="border-green-200 bg-green-50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-green-800">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">
                                    {lastAction === 'reset' ? 'Reset executado com sucesso!' : 'Dados restaurados com sucesso!'}
                                </span>
                            </div>
                            <p className="text-green-700 text-sm mt-2">
                                {lastAction === 'reset'
                                    ? 'Sistema configurado para mostrar setup inicial. Redirecionando...'
                                    : 'Sistema voltou ao estado original. Redirecionando...'
                                }
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Navigation */}
                <div className="text-center">
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar ao Sistema
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}