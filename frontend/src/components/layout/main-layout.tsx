'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@core/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@core/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@core/components/ui/dropdown-menu'
import { Music, BarChart3, Upload, List, Settings, Menu, Search, FileMusic, FolderOpen, LogOut, LogIn, Users, User, ChevronDown, ChevronRight, Shield, Bell, AlertCircle, AlertTriangle, Info, Settings2, Layers, Filter } from 'lucide-react'
import { Separator } from '@core/components/ui/separator'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'
import { useAuth } from '@core/contexts/auth-context'
import { LoginModal } from '@/components/auth/login-modal'
import { ProfileModal } from '@/components/auth/profile-modal'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { useServerEvents } from '@core/hooks/use-server-events'
import type { SystemEvent } from '@/types'

interface NavigationItem {
    title: string
    href: string
    icon: React.ElementType
    requiresAuth?: boolean
    requiresUpload?: boolean
    requiresEdit?: boolean
    requiresAdmin?: boolean
    group?: 'workspace' | 'admin'
    children?: NavigationItem[]
}

const navigation: NavigationItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: BarChart3, requiresAuth: true },
    { title: 'Músicas', href: '/music', icon: Music },
    { title: 'Listas', href: '/lists', icon: List },
    { title: 'Upload', href: '/upload', icon: Upload, requiresUpload: true },
    { 
        title: 'Configurações', 
        href: '/settings', 
        icon: Settings, 
        requiresEdit: true,
        children: [
            { title: 'Gerenciar Entidades', href: '/settings/manage', icon: FolderOpen, requiresEdit: true, group: 'workspace' },
            { title: 'Workspaces', href: '/settings/workspaces', icon: Filter, requiresAdmin: true, group: 'workspace' },
            { title: 'Monitoramento', href: '/settings/monitoring', icon: Bell, requiresAdmin: true, group: 'admin' },
            { title: 'Config. de Alertas', href: '/settings/alert-configs', icon: Settings, requiresAdmin: true, group: 'admin' },
            { title: 'Usuários', href: '/settings/users', icon: Users, requiresAdmin: true, group: 'admin' },
            { title: 'Roles', href: '/settings/roles', icon: Shield, requiresAdmin: true, group: 'admin' },
            { title: 'Sistema', href: '/settings/system', icon: Settings, requiresAdmin: true, group: 'admin' },
        ]
    },
]

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [loginModalOpen, setLoginModalOpen] = useState(false)
    const [profileModalOpen, setProfileModalOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const { user, isAuthenticated, hasPermission, logout, api } = useAuth()

    useEffect(() => { setMounted(true) }, [])

    // Defer auth checks until client-side mount to avoid hydration mismatch
    const isAdmin = mounted && hasPermission('admin:access')
    const canEdit = mounted && (hasPermission('music:edit_metadata') || hasPermission('lists:manage'))
    const canUpload = mounted && hasPermission('music:upload')
    
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [alertCount, setAlertCount] = useState(0)
    const [recentAlerts, setRecentAlerts] = useState<SystemEvent[]>([])

    const canAccessItem = (item: NavigationItem) => {
        if (item.requiresAdmin) return isAdmin
        if (item.requiresUpload) return canUpload
        if (item.requiresEdit) return canEdit
        if (item.requiresAuth) return isAuthenticated
        return true
    }

    const filteredNavigation = navigation.filter((item) => {
        if (!canAccessItem(item)) return false
        // Filter out children that user can't access
        if (item.children) {
            const accessibleChildren = item.children.filter(child => canAccessItem(child))
            return accessibleChildren.length > 0
        }
        return true
    }).map(item => {
        if (item.children) {
            return {
                ...item,
                children: item.children.filter(child => canAccessItem(child))
            }
        }
        return item
    })

    const handleLogout = async () => {
        await logout()
        window.location.reload() // Reload to reset permissions
    }

    const openLoginModal = () => {
        setSidebarOpen(false)
        setLoginModalOpen(true)
    }

    const getUserDisplayName = (u: { fullName?: string; full_name?: string; username: string } | null) =>
        u ? (u.fullName ?? (u as { full_name?: string }).full_name ?? u.username) : ''

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            editor: 'Editor',
            uploader: 'Uploader',
            viewer: 'Visualizador'
        }
        return labels[role.toLowerCase()] || role
    }

    const sseUrl = '/api/events/stream'

    useServerEvents(sseUrl, {
        'alert-count': (data: { count: number }) => {
            setAlertCount(data.count || 0)
            if (data.count === 0) setRecentAlerts([])
        },
        'recent-alerts': (data: { alerts: SystemEvent[] }) => {
            setRecentAlerts((data.alerts || []).slice(0, 5))
        }
    }, { enabled: isAdmin })

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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Agora'
        if (minutes < 60) return `${minutes}m atrás`
        if (hours < 24) return `${hours}h atrás`
        return `${days}d atrás`
    }

    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center border-b border-border px-4 sm:px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <FileMusic className="h-6 w-6 text-primary" />
                    <span className="text-lg">Cifras Networkmat</span>
                </Link>
            </div>
            <div className="border-b border-border px-2 py-2">
                <WorkspaceSwitcher />
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegação principal">
                {filteredNavigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    
                    // Handle items with children (submenus)
                    if (item.children && item.children.length > 0) {
                        const hasActiveChild = item.children.some(child => 
                            pathname === child.href || pathname.startsWith(child.href + '/')
                        )
                        
                        return (
                            <Collapsible
                                key={item.href}
                                open={settingsOpen || hasActiveChild}
                                onOpenChange={setSettingsOpen}
                            >
                                <CollapsibleTrigger asChild>
                                    <button
                                        className={cn(
                                            'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                            hasActiveChild
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        )}
                                    >
                                        <span className="flex items-center gap-3">
                                            <item.icon className="h-4 w-4" />
                                            {item.title}
                                        </span>
                                        {(settingsOpen || hasActiveChild) ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                                    {(() => {
                                        const workspaceItems = item.children!.filter(c => c.group === 'workspace' && canAccessItem(c))
                                        const adminItems = item.children!.filter(c => c.group === 'admin' && canAccessItem(c))
                                        const ungroupedItems = item.children!.filter(c => !c.group && canAccessItem(c))
                                        
                                        const renderNavChild = (child: NavigationItem) => {
                                            const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/')
                                            return (
                                                <SimpleTooltip key={child.href} label={child.title} side="right">
                                                    <Link
                                                        href={child.href}
                                                        className={cn(
                                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                                            isChildActive
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                                        )}
                                                        onClick={() => setSidebarOpen(false)}
                                                    >
                                                        <child.icon className="h-4 w-4" />
                                                        {child.title}
                                                    </Link>
                                                </SimpleTooltip>
                                            )
                                        }

                                        return (
                                            <>
                                                {workspaceItems.length > 0 && (
                                                    <>
                                                        <p className="text-xs font-medium text-muted-foreground px-3 py-1.5 mt-1">Workspace</p>
                                                        {workspaceItems.map(renderNavChild)}
                                                    </>
                                                )}
                                                {workspaceItems.length > 0 && adminItems.length > 0 && (
                                                    <Separator className="my-1.5" />
                                                )}
                                                {adminItems.length > 0 && (
                                                    <>
                                                        <p className="text-xs font-medium text-muted-foreground px-3 py-1.5">Administração</p>
                                                        {adminItems.map(renderNavChild)}
                                                    </>
                                                )}
                                                {ungroupedItems.map(renderNavChild)}
                                            </>
                                        )
                                    })()}
                                </CollapsibleContent>
                            </Collapsible>
                        )
                    }
                    
                    // Regular navigation item without children
                    return (
                        <SimpleTooltip key={item.href} label={item.title} side="right">
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        </SimpleTooltip>
                    )
                })}
            </nav>
            <div className="border-t border-border p-4 space-y-3">
                {mounted && isAuthenticated && user ? (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{getUserDisplayName(user)}</p>
                                    <Badge variant="outline" className="text-xs">
                                        {getRoleLabel(user.role ?? '')}
                                    </Badge>
                                </div>
                            </div>
                            <DropdownMenu>
                                <SimpleTooltip label="Menu do usuário" side="right">
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <Settings2 className="h-4 w-4" />
                                            <span className="sr-only">Configurações do usuário</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </SimpleTooltip>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setProfileModalOpen(true)}>
                                        <User className="h-4 w-4 mr-2" />
                                        Ver Perfil
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Sair
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </>
                ) : (
                    <SimpleTooltip label="Fazer login no sistema" side="right">
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full gap-2" 
                            onClick={openLoginModal}
                        >
                            <LogIn className="h-4 w-4" />
                            Entrar
                        </Button>
                    </SimpleTooltip>
                )}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>v3.0</span>
                    <span>•</span>
                    <SimpleTooltip label="Ver repositório no GitHub">
                        <a 
                            href="https://github.com/silva-mateus-org/musicas-igreja" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-foreground transition-colors"
                        >
                            GitHub
                        </a>
                    </SimpleTooltip>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-background">
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                <SidebarContent />
            </div>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-72">
                    <SidebarContent />
                </SheetContent>
            
            <div className="lg:pl-72">
                <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                        <SimpleTooltip label="Abrir menu">
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Abrir menu</span>
                                </Button>
                            </SheetTrigger>
                        </SimpleTooltip>
                        <div className="flex-1" />
                        <SimpleTooltip label="Buscar músicas na biblioteca">
                            <Button variant="outline" size="sm" asChild className="gap-2">
                                <Link href="/music">
                                    <Search className="h-4 w-4" />
                                    <span className="hidden sm:inline">Buscar músicas</span>
                                    <span className="sm:hidden">Buscar</span>
                                </Link>
                            </Button>
                        </SimpleTooltip>
                        
                        {/* Notification Bell (Admin only) */}
                        {isAdmin && (
                            <DropdownMenu>
                                <SimpleTooltip label="Notificações">
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="relative">
                                            <Bell className="h-5 w-5" />
                                            {alertCount > 0 && (
                                                <Badge 
                                                    variant="destructive" 
                                                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                                                >
                                                    {alertCount > 9 ? '9+' : alertCount}
                                                </Badge>
                                            )}
                                            <span className="sr-only">Notificações</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </SimpleTooltip>
                                <DropdownMenuContent align="end" className="w-80">
                                    <DropdownMenuLabel className="flex items-center justify-between">
                                        <span>Alertas do Sistema</span>
                                        {alertCount > 0 && (
                                            <Badge variant="secondary">{alertCount}</Badge>
                                        )}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {recentAlerts.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            Nenhum alerta novo
                                        </div>
                                    ) : (
                                        <>
                                            {recentAlerts.map((alert) => (
                                                <DropdownMenuItem
                                                    key={alert.id}
                                                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                                                    onClick={() => router.push('/settings/monitoring')}
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        {getSeverityIcon(alert.severity)}
                                                        <span className="font-medium text-sm flex-1">
                                                            {alert.event_type.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDate(alert.created_date)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {alert.message}
                                                    </p>
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild>
                                                <Link href="/settings/monitoring" className="w-full text-center justify-center">
                                                    Ver todos os alertas
                                                </Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        
                        {mounted && !isAuthenticated && (
                            <SimpleTooltip label="Fazer login">
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="gap-2 hidden sm:flex"
                                    onClick={() => setLoginModalOpen(true)}
                                >
                                    <LogIn className="h-4 w-4" />
                                    Entrar
                                </Button>
                            </SimpleTooltip>
                        )}
                    </div>
                </header>
                <main className="p-4 sm:p-6">{children}</main>
            </div>
            </Sheet>
            
            <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
            <ProfileModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />
        </div>
    )
}
