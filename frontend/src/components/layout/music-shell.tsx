'use client'

import { AppTopBar } from './app-topbar'

interface MusicShellProps {
  /** Rendered rail (only shown on desktop) */
  rail: React.ReactNode
  children: React.ReactNode
}

/**
 * Primary layout for the music experience.
 * Top: slim AppTopBar.
 * Body: 240px library rail (desktop only) + main content.
 */
export function MusicShell({ rail, children }: MusicShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AppTopBar />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Rail — desktop only */}
        <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border overflow-hidden">
          {rail}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
