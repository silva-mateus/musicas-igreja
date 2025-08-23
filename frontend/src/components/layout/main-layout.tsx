'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Music, BarChart3, Upload, List, Settings, Menu, Search, FileMusic } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
    title: string
    href: string
    icon: React.ElementType
    admin?: boolean
}

const navigation: NavigationItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { title: 'Músicas', href: '/music', icon: Music },
    { title: 'Upload', href: '/upload', icon: Upload },
    { title: 'Listas', href: '/lists', icon: List },
    { title: 'Configurações', href: '/settings', icon: Settings },
]

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()
    const isAdmin = false
    const filteredNavigation = navigation.filter((item) => !item.admin || (item.admin && isAdmin))

    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center border-b border-border px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <FileMusic className="h-6 w-6 text-primary" />
                    <span className="text-lg">Músicas Igreja</span>
                </Link>
            </div>
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
            <div className="border-t border-border p-4 text-xs text-muted-foreground">v2.0</div>
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
                        <Button variant="outline" size="sm" asChild className="gap-2">
                            <Link href="/music">
                                <Search className="h-4 w-4" />
                                <span className="hidden sm:inline">Buscar músicas</span>
                            </Link>
                        </Button>
                    </div>
                </header>
                <main className="p-6">{children}</main>
            </div>
        </div>
    )
}
