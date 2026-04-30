'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Menu, Music, PanelLeft, Plus, Share2 } from 'lucide-react'
import { Button } from '@core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/components/ui/dropdown-menu'
import { useWorkspace } from '@/contexts/workspace-context'
import { cn } from '@/lib/utils'

interface AppTopBarProps {
  mode: 'read' | 'edit'
  onModeChange: (mode: 'read' | 'edit') => void
  onMenuClick?: () => void
  railCollapsed?: boolean
  onRailCollapseToggle?: () => void
  hasSelectedContent?: boolean
  isMobile?: boolean
}

export function AppTopBar({ mode, onModeChange, onMenuClick, railCollapsed, onRailCollapseToggle, hasSelectedContent, isMobile }: AppTopBarProps) {
  const { workspaces, activeWorkspace, isLoading, switchWorkspace } = useWorkspace()

  const workspaceInitials = useMemo(() => {
    if (!activeWorkspace?.name) return 'WS'
    return activeWorkspace.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0].toUpperCase())
      .join('')
  }, [activeWorkspace?.name])

  return (
    <header className="h-[52px] shrink-0 flex items-center gap-3 px-3 border-b border-border bg-card pt-safe">
      {/* Mobile hamburger - sempre visível no mobile */}
      {onMenuClick && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-11 w-11 md:h-8 md:w-8 flex md:hidden shrink-0" 
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">
            {isMobile && hasSelectedContent ? 'Voltar à lista' : 'Abrir menu'}
          </span>
        </Button>
      )}
      {/* Desktop collapse toggle */}
      {onRailCollapseToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden md:flex shrink-0"
          onClick={onRailCollapseToggle}
        >
          <PanelLeft className={cn('h-4 w-4 transition-transform duration-200', railCollapsed && 'rotate-180')} />
          <span className="sr-only">{railCollapsed ? 'Expandir painel' : 'Recolher painel'}</span>
        </Button>
      )}
      <Link href="/music" className="flex items-center gap-2 shrink-0">
        <div className="h-6 w-6 rounded-full bg-foreground flex items-center justify-center shrink-0">
          <Music className="h-3 w-3 text-background" />
        </div>
        <span
          className="text-[1.1rem] italic leading-none"
          style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
        >
          Músicas
        </span>
      </Link>

      <div className="w-px h-4 bg-border shrink-0" />

      {activeWorkspace && !isLoading && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 px-2.5 border border-border/70 bg-card/80 hover:bg-muted/60"
            >
              <span className="h-5 w-5 rounded-md bg-foreground text-background text-[10px] font-semibold flex items-center justify-center">
                {workspaceInitials}
              </span>
              <span className="text-sm font-medium truncate max-w-[160px]">{activeWorkspace.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-2">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold px-2 pb-2">
              Áreas de trabalho
            </DropdownMenuLabel>
            {workspaces.map((ws) => {
              const initials = ws.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part: string) => part[0].toUpperCase())
                .join('')
              const meta = `${ws.music_count ?? 0} músicas · ${ws.list_count ?? 0} listas`

              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 focus:bg-muted/70',
                    ws.id === activeWorkspace.id && 'bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'h-6 w-6 rounded-md text-[10px] font-semibold flex items-center justify-center',
                      ws.id === activeWorkspace.id
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground border border-border/60'
                    )}
                  >
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{ws.name}</span>
                    <span className="text-[11px] text-muted-foreground block">{meta}</span>
                  </span>
                  {ws.id === activeWorkspace.id && <Check className="h-4 w-4 text-muted-foreground" />}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem className="flex items-center gap-3 rounded-lg px-2.5 py-2">
              <span className="h-6 w-6 rounded-md border border-dashed border-border/80 text-muted-foreground flex items-center justify-center text-xs">
                <Plus className="h-3 w-3" />
              </span>
              <span className="text-sm font-medium">Nova área de trabalho</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1" />

      <div className="flex items-center bg-muted rounded-full p-1">
        <button
          onClick={() => onModeChange('read')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            mode === 'read'
              ? 'bg-card text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Ler
        </button>
        <button
          onClick={() => onModeChange('edit')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            mode === 'edit'
              ? 'bg-card text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Editar
        </button>
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8">
        <Share2 className="h-4 w-4" />
        <span className="sr-only">Compartilhar</span>
      </Button>

      <Button className="h-8 gap-2 text-sm">
        <Plus className="h-4 w-4" />
        Nova
      </Button>
    </header>
  )
}
