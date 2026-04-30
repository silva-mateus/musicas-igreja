'use client'

import { useEffect } from 'react'
import { AppTopBar } from './app-topbar'
import { ResponsiveDrawer } from '@/components/ui/responsive-drawer'
import { useBreakpoint } from '@/hooks/use-breakpoint'

interface MusicShellProps {
  rail: React.ReactNode
  children: React.ReactNode
  mode: 'read' | 'edit'
  onModeChange: (mode: 'read' | 'edit') => void
  railOpen: boolean
  onRailOpenChange: (open: boolean) => void
  railCollapsed: boolean
  onRailCollapse: (v: boolean) => void
  /**
   * Se há conteúdo selecionado (música ou lista)
   * No mobile, isso controla navegação stacked
   */
  hasSelectedContent?: boolean
}

export function MusicShell({
  rail,
  children,
  mode,
  onModeChange,
  railOpen,
  onRailOpenChange,
  railCollapsed,
  onRailCollapse,
  hasSelectedContent = false,
}: MusicShellProps) {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AppTopBar
        mode={mode}
        onModeChange={onModeChange}
        onMenuClick={() => onRailOpenChange(true)}
        railCollapsed={railCollapsed}
        onRailCollapseToggle={() => onRailCollapse(!railCollapsed)}
        hasSelectedContent={hasSelectedContent}
        isMobile={isMobile}
      />

      {/* Mobile drawer */}
      <ResponsiveDrawer
        open={railOpen}
        onOpenChange={onRailOpenChange}
        side="left"
      >
        {rail}
      </ResponsiveDrawer>

      <div className="flex flex-1 min-h-0">
        {/* Desktop rail - hidden on mobile when content is selected */}
        <aside
          className={`shrink-0 flex-col border-r border-border overflow-hidden transition-[width] duration-200 ${
            isMobile && hasSelectedContent 
              ? 'hidden' // Completamente oculto no mobile com conteúdo
              : railCollapsed 
                ? 'hidden md:flex w-0' 
                : 'hidden md:flex w-[280px]'
          }`}
        >
          {rail}
        </aside>
        <main className="flex-1 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
