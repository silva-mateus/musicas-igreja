'use client'

import { ReactNode, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Music,
    Upload,
    Home,
    List,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    User,
    Search,
    Bell
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface MainLayoutProps {
    children: ReactNode
}

const navigation = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        current: false,
    },
    {
        name: 'Músicas',
        href: '/music',
        icon: Music,
        current: false,
    },
    {
        name: 'Upload',
        href: '/upload',
        icon: Upload,
        current: false,
    },
    {
        name: 'Listas',
        href: '/lists',
        icon: List,
        current: false,
    },
    {
        name: 'Relatórios',
        href: '/reports',
        icon: BarChart3,
        current: false,
    },
]

const adminNavigation = [
    {
        name: 'Usuários',
        href: '/admin/users',
        icon: User,
        current: false,
    },
    {
        name: 'Configurações',
        href: '/admin/settings',
        icon: Settings,
        current: false,
    },
]

export function MainLayout({ children }: MainLayoutProps) {
    const { user, logout } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const handleLogout = async () => {
        await logout()
    }

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + '/')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile sidebar */}
            <div className={cn(
                "fixed inset-0 z-50 lg:hidden",
                sidebarOpen ? "block" : "hidden"
            )}>
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
                <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                        <button
                            type="button"
                            className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-6 w-6 text-white" />
                        </button>
                    </div>
                    <SidebarContent
                        navigation={navigation}
                        adminNavigation={adminNavigation}
                        user={user}
                        isActive={isActive}
                        onLogout={handleLogout}
                    />
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <SidebarContent
                    navigation={navigation}
                    adminNavigation={adminNavigation}
                    user={user}
                    isActive={isActive}
                    onLogout={handleLogout}
                />
            </div>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Top navigation */}
                <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    {/* Separator */}
                    <div className="h-6 w-px bg-gray-200 lg:hidden" />

                    <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                        <div className="relative flex flex-1">
                            {/* Breadcrumb ou título da página aqui */}
                        </div>
                        <div className="flex items-center gap-x-4 lg:gap-x-6">
                            {/* Notification button */}
                            <button
                                type="button"
                                className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
                            >
                                <Bell className="h-6 w-6" />
                            </button>

                            {/* Profile dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>
                                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user?.username}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user?.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sair
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main className="py-6">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

interface SidebarContentProps {
    navigation: any[]
    adminNavigation: any[]
    user: any
    isActive: (href: string) => boolean
    onLogout: () => void
}

function SidebarContent({ navigation, adminNavigation, user, isActive, onLogout }: SidebarContentProps) {
    return (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
            <div className="flex h-16 shrink-0 items-center">
                <div className="flex items-center gap-2">
                    <Music className="h-8 w-8 text-primary" />
                    <h1 className="text-xl font-bold">Músicas Igreja</h1>
                </div>
            </div>
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                        <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            isActive(item.href)
                                                ? 'bg-gray-50 text-primary'
                                                : 'text-gray-700 hover:text-primary hover:bg-gray-50',
                                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                isActive(item.href) ? 'text-primary' : 'text-gray-400 group-hover:text-primary',
                                                'h-6 w-6 shrink-0'
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </li>
                    {user?.role === 'admin' && (
                        <li>
                            <div className="text-xs font-semibold leading-6 text-gray-400">Administração</div>
                            <ul role="list" className="-mx-2 mt-2 space-y-1">
                                {adminNavigation.map((item) => (
                                    <li key={item.name}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                isActive(item.href)
                                                    ? 'bg-gray-50 text-primary'
                                                    : 'text-gray-700 hover:text-primary hover:bg-gray-50',
                                                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                            )}
                                        >
                                            <item.icon
                                                className={cn(
                                                    isActive(item.href) ? 'text-primary' : 'text-gray-400 group-hover:text-primary',
                                                    'h-6 w-6 shrink-0'
                                                )}
                                            />
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    )}
                    <li className="mt-auto">
                        <Button
                            variant="ghost"
                            onClick={onLogout}
                            className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair
                        </Button>
                    </li>
                </ul>
            </nav>
        </div>
    )
}