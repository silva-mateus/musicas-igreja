'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Music, BarChart3, Upload, List, Settings, Menu, Search, FileMusic, FolderOpen, LogOut, LogIn, Users, User, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { LoginModal } from '@/components/auth/login-modal'

interface NavigationItem {
    title: string
    href: string
    icon: React.ElementType
    requiresAuth?: boolean // Requires any login
    requiresUpload?: boolean // Requires uploader role
    requiresEdit?: boolean // Requires editor role
    requiresAdmin?: boolean // Requires admin role
    children?: NavigationItem[] // Sub-items
}

const navigation: NavigationItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { title: 'Músicas', href: '/music', icon: Music },
    { title: 'Listas', href: '/lists', icon: List },
    { title: 'Upload', href: '/upload', icon: Upload, requiresUpload: true },
    { 
        title: 'Configurações', 
        href: '/settings', 
        icon: Settings, 
        requiresEdit: true,
        children: [
            { title: 'Gerenciar Entidades', href: '/settings/manage', icon: FolderOpen, requiresEdit: true },
            { title: 'Usuários', href: '/settings/users', icon: Users, requiresAdmin: true },
            { title: 'Roles', href: '/settings/roles', icon: Shield, requiresAdmin: true },
            { title: 'Sistema', href: '/settings/system', icon: Settings, requiresAdmin: true },
        ]
    },
]

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [loginModalOpen, setLoginModalOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const { user, isAuthenticated, isAdmin, canEdit, canUpload, logout } = useAuth()
    
    const [settingsOpen, setSettingsOpen] = useState(false)

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

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            editor: 'Editor',
            uploader: 'Uploader',
            viewer: 'Visualizador'
        }
        return labels[role.toLowerCase()] || role
    }

    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center border-b border-border px-4 sm:px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <FileMusic className="h-6 w-6 text-primary" />
                    <span className="text-lg">Músicas Igreja</span>
                </Link>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
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
                                    {item.children.map((child) => {
                                        const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/')
                                        return (
                                            <Link
                                                key={child.href}
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
                                        )
                                    })}
                                </CollapsibleContent>
                            </Collapsible>
                        )
                    }
                    
                    // Regular navigation item without children
                    return (
                        <Link
                            key={item.href}
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
                    )
                })}
            </nav>
            <div className="border-t border-border p-4 space-y-3">
                {isAuthenticated && user ? (
                    <>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user.username}</p>
                                <Badge variant="outline" className="text-xs">
                                    {getRoleLabel(user.role)}
                                </Badge>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start gap-2 text-muted-foreground" 
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            Sair
                        </Button>
                    </>
                ) : (
                    <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full gap-2" 
                        onClick={openLoginModal}
                    >
                        <LogIn className="h-4 w-4" />
                        Entrar
                    </Button>
                )}
                <p className="text-xs text-muted-foreground text-center">v2.0</p>
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
            </Sheet>
            <div className="lg:pl-72">
                <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle sidebar</span>
                                </Button>
                            </SheetTrigger>
                        </Sheet>
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" asChild className="gap-2">
                            <Link href="/music">
                                <Search className="h-4 w-4" />
                                <span className="hidden sm:inline">Buscar músicas</span>
                                <span className="sm:hidden">Buscar</span>
                            </Link>
                        </Button>
                        {!isAuthenticated && (
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="gap-2 hidden sm:flex"
                                onClick={() => setLoginModalOpen(true)}
                            >
                                <LogIn className="h-4 w-4" />
                                Entrar
                            </Button>
                        )}
                    </div>
                </header>
                <main className="p-4 sm:p-6">{children}</main>
            </div>
            
            <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
        </div>
    )
}
