'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    Music,
    BarChart3,
    Upload,
    List,
    Users,
    Settings,
    LogOut,
    Menu,
    Search,
    Home,
    FileMusic
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
    title: string
    href: string
    icon: React.ElementType
    admin?: boolean
}

const navigation: NavigationItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: BarChart3
    },
    {
        title: 'Músicas',
        href: '/music',
        icon: Music
    },
    {
        title: 'Upload',
        href: '/upload',
        icon: Upload
    },
    {
        title: 'Listas',
        href: '/lists',
        icon: List
    },
    {
        title: 'Usuários',
        href: '/admin/users',
        icon: Users,
        admin: true
    },
    {
        title: 'Configurações',
        href: '/settings',
        icon: Settings
    }
]

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()
    const { user, logout } = useAuth()
    const isAdmin = user?.role === 'admin'

    const filteredNavigation = navigation.filter(
        item => !item.admin || (item.admin && isAdmin)
    )

    const handleLogout = async () => {
        await logout()
    }

    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-card border-r border-border">
            {/* Logo */}
            <div className="flex h-16 items-center border-b border-border px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <FileMusic className="h-6 w-6 text-primary" />
                    <span className="text-lg">Músicas Igreja</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {filteredNavigation.map((item) => {
                    const isActive = pathname === item.href
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

            {/* User info & Logout */}
            <div className="border-t border-border p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-foreground">
                            {user?.username?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.username}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </Button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                <SidebarContent />
            </div>

            {/* Mobile Sidebar */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-72">
                    <SidebarContent />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <div className="lg:pl-72">
                {/* Top Header */}
                <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex h-16 items-center gap-4 px-6">
                        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle sidebar</span>
                                </Button>
                            </SheetTrigger>
                        </Sheet>

                        <div className="flex-1" />

                        {/* Quick Search */}
                        <Button variant="outline" size="sm" asChild className="gap-2">
                            <Link href="/music">
                                <Search className="h-4 w-4" />
                                <span className="hidden sm:inline">Buscar músicas</span>
                            </Link>
                        </Button>

                        {/* User Avatar */}
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-xs font-medium text-primary-foreground">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-sm font-medium">{user?.username}</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}