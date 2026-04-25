'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Music,
  Plus,
  Upload,
  Music2,
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  LogIn,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react'
import { Button } from '@core/components/ui/button'
import { Badge } from '@core/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/components/ui/dropdown-menu'
import { useAuth } from '@core/contexts/auth-context'
import { LoginModal } from '@/components/auth/login-modal'
import { ProfileModal } from '@/components/auth/profile-modal'
import { useWorkspace } from '@/contexts/workspace-context'
import { useServerEvents } from '@core/hooks/use-server-events'
import type { SystemEvent } from '@/types'
import { cn } from '@/lib/utils'

export function AppTopBar() {
  const [mounted, setMounted] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const [recentAlerts, setRecentAlerts] = useState<SystemEvent[]>([])
  const router = useRouter()
  const { user, isAuthenticated, hasPermission, logout } = useAuth()
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace()

  useEffect(() => { setMounted(true) }, [])

  const isAdmin = mounted && hasPermission('admin:access')
  const canUpload = mounted && hasPermission('music:upload')

  useServerEvents('/api/events/stream', {
    'alert-count': (data: { count: number }) => {
      setAlertCount(data.count || 0)
      if (data.count === 0) setRecentAlerts([])
    },
    'recent-alerts': (data: { alerts: SystemEvent[] }) => {
      setRecentAlerts((data.alerts || []).slice(0, 5))
    },
  }, { enabled: isAdmin })

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  const displayName = (u: typeof user) =>
    u ? ((u as any).fullName ?? (u as any).full_name ?? u.username) : ''

  const severityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertCircle className="h-3.5 w-3.5 text-destructive" />
    if (severity === 'high') return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
    return <Info className="h-3.5 w-3.5 text-blue-500" />
  }

  const relativeDate = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return 'Agora'
    if (m < 60) return `${m}m atrás`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  return (
    <>
      <header className="h-[52px] shrink-0 flex items-center gap-2 px-4 border-b border-border bg-card z-50">
        {/* Brand */}
        <Link href="/music" className="flex items-center gap-2 shrink-0 mr-1">
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

        {/* Workspace switcher */}
        {mounted && activeWorkspace && (
          workspaces.length <= 1 ? (
            <div className="flex items-center gap-1.5 px-1">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeWorkspace.color || '#6b6b5f' }}
              />
              <span className="text-sm font-medium text-foreground/80 truncate max-w-[120px]">
                {activeWorkspace.name}
              </span>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2 font-normal">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeWorkspace.color || '#6b6b5f' }}
                  />
                  <span className="text-sm truncate max-w-[120px]">{activeWorkspace.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Área de trabalho
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={cn('flex items-center gap-2', ws.id === activeWorkspace.id && 'font-medium')}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ws.color || '#6b6b5f' }}
                    />
                    <span className="flex-1 truncate">{ws.name}</span>
                    {ws.id === activeWorkspace.id && (
                      <span className="text-xs text-muted-foreground">ativo</span>
                    )}
                  </DropdownMenuItem>
                ))}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings/workspaces">Gerenciar workspaces</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}

        <div className="flex-1" />

        {/* + Nova */}
        {canUpload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-sm">
                <Plus className="h-3.5 w-3.5" />
                Nova
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/music/new-chord" className="flex items-center gap-2">
                  <Music2 className="h-4 w-4" />
                  Digitar Cifra
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Admin alerts */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {alertCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {alertCount > 9 ? '9+' : alertCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Alertas do Sistema</span>
                {alertCount > 0 && <Badge variant="secondary">{alertCount}</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentAlerts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Nenhum alerta novo</div>
              ) : (
                <>
                  {recentAlerts.map((alert) => (
                    <DropdownMenuItem
                      key={alert.id}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                      onClick={() => router.push('/settings/monitoring')}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {severityIcon(alert.severity)}
                        <span className="font-medium text-sm flex-1">
                          {alert.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">{relativeDate(alert.created_date)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings/monitoring" className="w-full text-center justify-center text-sm">
                      Ver todos os alertas
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User menu */}
        {mounted && isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                  {displayName(user).charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm max-w-[100px] truncate">{displayName(user)}</span>
                <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{displayName(user)}</div>
                <div className="text-xs text-muted-foreground">{user.username}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileModalOpen(true)}>
                <User className="h-4 w-4 mr-2" />
                Ver Perfil
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    Configurações
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : mounted && !isAuthenticated ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            onClick={() => setLoginModalOpen(true)}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Entrar</span>
          </Button>
        ) : null}
      </header>

      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
      <ProfileModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />
    </>
  )
}
