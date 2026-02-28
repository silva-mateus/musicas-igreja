'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { workspacesApi, setActiveWorkspaceId, type Workspace } from '@/lib/api'

interface WorkspaceContextValue {
    workspaces: Workspace[]
    activeWorkspace: Workspace | null
    isLoading: boolean
    switchWorkspace: (id: number) => void
    refetchWorkspaces: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY = 'cifras_nmat_active_workspace'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()
    const [activeId, setActiveId] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = parseInt(stored, 10)
                if (!isNaN(parsed)) {
                    setActiveWorkspaceId(parsed)
                    return parsed
                }
            }
        }
        setActiveWorkspaceId(1)
        return 1
    })

    const { data: workspaces = [], isLoading, refetch } = useQuery({
        queryKey: ['workspaces'],
        queryFn: () => workspacesApi.getAll(),
        staleTime: 5 * 60 * 1000,
    })

    const activeWorkspace = workspaces.find(w => w.id === activeId) ?? workspaces[0] ?? null

    useEffect(() => {
        if (activeWorkspace && activeWorkspace.id !== activeId) {
            setActiveId(activeWorkspace.id)
            setActiveWorkspaceId(activeWorkspace.id)
            localStorage.setItem(STORAGE_KEY, String(activeWorkspace.id))
        }
    }, [activeWorkspace, activeId])

    const switchWorkspace = useCallback((id: number) => {
        setActiveId(id)
        setActiveWorkspaceId(id)
        localStorage.setItem(STORAGE_KEY, String(id))
        queryClient.invalidateQueries({
            predicate: (query) => {
                const key = query.queryKey[0]
                return key !== 'workspaces'
            },
        })
    }, [queryClient])

    const refetchWorkspaces = useCallback(() => {
        refetch()
    }, [refetch])

    return (
        <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, isLoading, switchWorkspace, refetchWorkspaces }}>
            {children}
        </WorkspaceContext.Provider>
    )
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext)
    if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider')
    return ctx
}
