'use client'

import { useWorkspace } from '@/contexts/workspace-context'
import { useAuth } from '@core/contexts/auth-context'
import { Button } from '@core/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@core/components/ui/dropdown-menu'
import { ChevronsUpDown, Check, Settings, Layers } from 'lucide-react'
import Link from 'next/link'

export function WorkspaceSwitcher() {
    const { workspaces, activeWorkspace, isLoading, switchWorkspace } = useWorkspace()
    const { hasPermission } = useAuth()
    const isAdmin = hasPermission('admin:access')

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4 animate-pulse" />
                <span>Carregando...</span>
            </div>
        )
    }

    if (!activeWorkspace) return null

    if (workspaces.length <= 1) {
        return (
            <div className="flex items-center gap-2 px-3 py-2">
                <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: activeWorkspace.color || '#3b82f6' }}
                />
                <span className="text-sm font-medium truncate">{activeWorkspace.name}</span>
            </div>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-between gap-2 px-3 py-2 h-auto font-normal"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: activeWorkspace.color || '#3b82f6' }}
                        />
                        <span className="text-sm font-medium truncate">{activeWorkspace.name}</span>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {workspaces.map((ws) => (
                    <DropdownMenuItem
                        key={ws.id}
                        onClick={() => switchWorkspace(ws.id)}
                        className="flex items-center gap-2"
                    >
                        <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: ws.color || '#3b82f6' }}
                        />
                        <span className="flex-1 truncate">{ws.name}</span>
                        {ws.id === activeWorkspace.id && (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
                {isAdmin && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings/workspaces" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Gerenciar
                            </Link>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
