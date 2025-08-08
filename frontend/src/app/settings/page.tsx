'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useRequireAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Settings, Save, RefreshCw, Download, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
    useRequireAuth()
    const { toast } = useToast()

    // Estados para configurações gerais
    const [generalSettings, setGeneralSettings] = useState({
        organizationName: 'Igreja São José',
        defaultCategory: 'Adoração',
        defaultLiturgicalTime: 'Tempo Comum',
        enableDuplicateDetection: true,
        enableAutoBackup: true,
        maxFileSize: '10', // MB
        allowedFormats: ['pdf']
    })

    // Estados para configurações de exibição
    const [displaySettings, setDisplaySettings] = useState({
        theme: 'dark',
        itemsPerPage: '20',
        enableAnimations: true,
        compactView: false
    })

    // Estados para configurações de segurança
    const [securitySettings, setSecuritySettings] = useState({
        sessionTimeout: '60', // minutos
        requirePasswordChange: false,
        enableTwoFactor: false,
        minPasswordLength: '8'
    })

    const [isLoading, setIsLoading] = useState(false)

    const handleSaveSettings = async () => {
        setIsLoading(true)
        try {
            // Simular salvamento das configurações
            await new Promise(resolve => setTimeout(resolve, 1000))

            toast({
                title: "Configurações salvas",
                description: "Todas as configurações foram salvas com sucesso.",
            })
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: "Erro ao salvar as configurações. Tente novamente.",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleExportSettings = () => {
        const settings = {
            general: generalSettings,
            display: displaySettings,
            security: securitySettings
        }

        const dataStr = JSON.stringify(settings, null, 2)
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

        const exportFileDefaultName = 'musicas-igreja-settings.json'

        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', dataUri)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()

        toast({
            title: "Configurações exportadas",
            description: "Arquivo de configurações foi baixado com sucesso.",
        })
    }

    const handleImportSettings = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const settings = JSON.parse(e.target?.result as string)
                        if (settings.general) setGeneralSettings(settings.general)
                        if (settings.display) setDisplaySettings(settings.display)
                        if (settings.security) setSecuritySettings(settings.security)

                        toast({
                            title: "Configurações importadas",
                            description: "Configurações foram carregadas com sucesso.",
                        })
                    } catch (error) {
                        toast({
                            title: "Erro na importação",
                            description: "Arquivo de configurações inválido.",
                            variant: "destructive"
                        })
                    }
                }
                reader.readAsText(file)
            }
        }
        input.click()
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings className="h-6 w-6" />
                        <h1 className="text-2xl font-bold">Configurações</h1>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleImportSettings}>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar
                        </Button>
                        <Button variant="outline" onClick={handleExportSettings}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                        <Button onClick={handleSaveSettings} disabled={isLoading}>
                            {isLoading ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Salvar
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Configurações Gerais */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Configurações Gerais</CardTitle>
                            <CardDescription>
                                Configurações básicas do sistema
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="organizationName">Nome da Organização</Label>
                                <Input
                                    id="organizationName"
                                    value={generalSettings.organizationName}
                                    onChange={(e) => setGeneralSettings(prev => ({
                                        ...prev,
                                        organizationName: e.target.value
                                    }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="defaultCategory">Categoria Padrão</Label>
                                <Select
                                    value={generalSettings.defaultCategory}
                                    onValueChange={(value) => setGeneralSettings(prev => ({
                                        ...prev,
                                        defaultCategory: value
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Adoração">Adoração</SelectItem>
                                        <SelectItem value="Louvor">Louvor</SelectItem>
                                        <SelectItem value="Comunhão">Comunhão</SelectItem>
                                        <SelectItem value="Entrada">Entrada</SelectItem>
                                        <SelectItem value="Ofertório">Ofertório</SelectItem>
                                        <SelectItem value="Final">Final</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="defaultLiturgicalTime">Tempo Litúrgico Padrão</Label>
                                <Select
                                    value={generalSettings.defaultLiturgicalTime}
                                    onValueChange={(value) => setGeneralSettings(prev => ({
                                        ...prev,
                                        defaultLiturgicalTime: value
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Advento">Advento</SelectItem>
                                        <SelectItem value="Natal">Natal</SelectItem>
                                        <SelectItem value="Quaresma">Quaresma</SelectItem>
                                        <SelectItem value="Páscoa">Páscoa</SelectItem>
                                        <SelectItem value="Tempo Comum">Tempo Comum</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
                                <Input
                                    id="maxFileSize"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={generalSettings.maxFileSize}
                                    onChange={(e) => setGeneralSettings(prev => ({
                                        ...prev,
                                        maxFileSize: e.target.value
                                    }))}
                                />
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="duplicateDetection">Detecção de Duplicatas</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Verificar automaticamente arquivos duplicados
                                    </p>
                                </div>
                                <Switch
                                    id="duplicateDetection"
                                    checked={generalSettings.enableDuplicateDetection}
                                    onCheckedChange={(checked) => setGeneralSettings(prev => ({
                                        ...prev,
                                        enableDuplicateDetection: checked
                                    }))}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="autoBackup">Backup Automático</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Fazer backup automático dos dados
                                    </p>
                                </div>
                                <Switch
                                    id="autoBackup"
                                    checked={generalSettings.enableAutoBackup}
                                    onCheckedChange={(checked) => setGeneralSettings(prev => ({
                                        ...prev,
                                        enableAutoBackup: checked
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configurações de Exibição */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Configurações de Exibição</CardTitle>
                            <CardDescription>
                                Personalize a aparência da interface
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="theme">Tema</Label>
                                <Select
                                    value={displaySettings.theme}
                                    onValueChange={(value) => setDisplaySettings(prev => ({
                                        ...prev,
                                        theme: value
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Claro</SelectItem>
                                        <SelectItem value="dark">Escuro</SelectItem>
                                        <SelectItem value="system">Sistema</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="itemsPerPage">Itens por Página</Label>
                                <Select
                                    value={displaySettings.itemsPerPage}
                                    onValueChange={(value) => setDisplaySettings(prev => ({
                                        ...prev,
                                        itemsPerPage: value
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="animations">Animações</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Ativar animações na interface
                                    </p>
                                </div>
                                <Switch
                                    id="animations"
                                    checked={displaySettings.enableAnimations}
                                    onCheckedChange={(checked) => setDisplaySettings(prev => ({
                                        ...prev,
                                        enableAnimations: checked
                                    }))}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="compactView">Visualização Compacta</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Usar layout mais compacto nas tabelas
                                    </p>
                                </div>
                                <Switch
                                    id="compactView"
                                    checked={displaySettings.compactView}
                                    onCheckedChange={(checked) => setDisplaySettings(prev => ({
                                        ...prev,
                                        compactView: checked
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configurações de Segurança */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Configurações de Segurança</CardTitle>
                            <CardDescription>
                                Gerenciar configurações de segurança e autenticação
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="sessionTimeout">Timeout da Sessão (minutos)</Label>
                                    <Input
                                        id="sessionTimeout"
                                        type="number"
                                        min="5"
                                        max="480"
                                        value={securitySettings.sessionTimeout}
                                        onChange={(e) => setSecuritySettings(prev => ({
                                            ...prev,
                                            sessionTimeout: e.target.value
                                        }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="minPasswordLength">Tamanho Mínimo da Senha</Label>
                                    <Input
                                        id="minPasswordLength"
                                        type="number"
                                        min="4"
                                        max="20"
                                        value={securitySettings.minPasswordLength}
                                        onChange={(e) => setSecuritySettings(prev => ({
                                            ...prev,
                                            minPasswordLength: e.target.value
                                        }))}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="requirePasswordChange">Forçar Mudança de Senha</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Exigir que usuários alterem a senha no primeiro login
                                        </p>
                                    </div>
                                    <Switch
                                        id="requirePasswordChange"
                                        checked={securitySettings.requirePasswordChange}
                                        onCheckedChange={(checked) => setSecuritySettings(prev => ({
                                            ...prev,
                                            requirePasswordChange: checked
                                        }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="twoFactor">Autenticação de Dois Fatores</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Ativar 2FA para todos os usuários administradores
                                        </p>
                                    </div>
                                    <Switch
                                        id="twoFactor"
                                        checked={securitySettings.enableTwoFactor}
                                        onCheckedChange={(checked) => setSecuritySettings(prev => ({
                                            ...prev,
                                            enableTwoFactor: checked
                                        }))}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    )
}