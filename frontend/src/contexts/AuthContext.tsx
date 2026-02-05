'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '@/lib/api'

interface Permissions {
    can_view_music: boolean
    can_download_music: boolean
    can_edit_music_metadata: boolean
    can_upload_music: boolean
    can_delete_music: boolean
    can_manage_lists: boolean
    can_manage_categories: boolean
    can_manage_users: boolean
    can_manage_roles: boolean
    can_access_admin: boolean
}

interface User {
    id: number
    username: string
    full_name: string
    role: string
    role_id: number
    is_active: boolean
    must_change_password?: boolean
    permissions?: Permissions
}

interface LoginResult {
    success: boolean
    error?: string
    mustChangePassword?: boolean
}

interface AuthContextType {
    user: User | null
    permissions: Permissions | null
    isLoading: boolean
    isAuthenticated: boolean
    isAdmin: boolean
    // Permission shortcuts
    canViewMusic: boolean
    canDownloadMusic: boolean
    canEditMusicMetadata: boolean
    canUploadMusic: boolean
    canDeleteMusic: boolean
    canManageLists: boolean
    canManageCategories: boolean
    canManageUsers: boolean
    canManageRoles: boolean
    canAccessAdmin: boolean
    // Legacy compatibility
    canEdit: boolean
    canUpload: boolean
    canDelete: boolean
    mustChangePassword: boolean
    login: (username: string, password: string) => Promise<LoginResult>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
    updateProfile: (fullName: string) => Promise<{ success: boolean; error?: string }>
    clearMustChangePassword: () => void
}

const defaultPermissions: Permissions = {
    can_view_music: true,
    can_download_music: true,
    can_edit_music_metadata: false,
    can_upload_music: false,
    can_delete_music: false,
    can_manage_lists: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_roles: false,
    can_access_admin: false,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [permissions, setPermissions] = useState<Permissions | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [mustChangePassword, setMustChangePassword] = useState(false)

    const clearSession = () => {
        setUser(null)
        setPermissions(null)
        setMustChangePassword(false)
        localStorage.removeItem('user')
        localStorage.removeItem('permissions')
        localStorage.removeItem('instanceId')
    }

    const refreshUser = async () => {
        try {
            // First check if we have a stored user (to know if we should try to refresh)
            const storedUser = localStorage.getItem('user')
            if (!storedUser) {
                setIsLoading(false)
                return
            }

            // Try to get current user from server to get updated permissions
            try {
                const result = await authApi.getCurrentUser()
                
                // Check if server instance changed (server was restarted)
                const storedInstanceId = localStorage.getItem('instanceId')
                if (result.instance_id && storedInstanceId && result.instance_id !== storedInstanceId) {
                    console.warn('Server instance changed, logging out user')
                    clearSession()
                    setIsLoading(false)
                    return
                }
                
                if (result.success && result.user) {
                    // Update instance ID if present
                    if (result.instance_id) {
                        localStorage.setItem('instanceId', result.instance_id)
                    }
                    
                    // Update with fresh data from server
                    setUser(result.user)
                    setMustChangePassword(result.user.must_change_password || false)
                    localStorage.setItem('user', JSON.stringify(result.user))
                    
                    if (result.user.permissions) {
                        setPermissions(result.user.permissions)
                        localStorage.setItem('permissions', JSON.stringify(result.user.permissions))
                    }
                    return
                }
            } catch (apiError: any) {
                // If we get an auth error, clear session
                if (apiError.message === 'Não autenticado' || apiError.message === 'Acesso negado') {
                    console.warn('Session expired or invalid, clearing session')
                    clearSession()
                    setIsLoading(false)
                    return
                }
                // Other errors: fall back to local storage data
                console.warn('Failed to refresh user from server, using cached data:', apiError)
            }

            // Fallback: use stored data if API fails
            const parsedUser = JSON.parse(storedUser)
            setUser(parsedUser)
            setMustChangePassword(parsedUser.must_change_password || false)
            
            const storedPermissions = localStorage.getItem('permissions')
            if (storedPermissions) {
                setPermissions(JSON.parse(storedPermissions))
            } else if (parsedUser.permissions) {
                setPermissions(parsedUser.permissions)
            }
        } catch (error) {
            console.error('Error refreshing user:', error)
            clearSession()
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        refreshUser()
    }, [])

    const login = async (username: string, password: string): Promise<LoginResult> => {
        try {
            const result = await authApi.login(username, password)
            if (result.success && result.user) {
                setUser(result.user)
                localStorage.setItem('user', JSON.stringify(result.user))
                
                // Store instance ID to detect server restarts
                if (result.instance_id) {
                    localStorage.setItem('instanceId', result.instance_id)
                }
                
                // Store permissions separately for easy access
                if (result.user.permissions) {
                    setPermissions(result.user.permissions)
                    localStorage.setItem('permissions', JSON.stringify(result.user.permissions))
                }
                
                if (result.must_change_password) {
                    setMustChangePassword(true)
                    return { success: true, mustChangePassword: true }
                }
                
                return { success: true }
            }
            return { success: false, error: result.error || 'Credenciais inválidas' }
        } catch (error: any) {
            console.error('Login error:', error)
            return { success: false, error: error.message || 'Erro ao fazer login' }
        }
    }

    const logout = async () => {
        try {
            await authApi.logout()
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            clearSession()
        }
    }

    const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await authApi.changePassword(currentPassword, newPassword)
            if (result.success) {
                setMustChangePassword(false)
                if (user) {
                    const updatedUser = { ...user, must_change_password: false }
                    setUser(updatedUser)
                    localStorage.setItem('user', JSON.stringify(updatedUser))
                }
                return { success: true }
            }
            // Check if session expired
            if (result.error === 'Não autenticado' || result.error === 'Acesso negado') {
                await logout()
                return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' }
            }
            return { success: false, error: result.error || 'Erro ao alterar senha' }
        } catch (error: any) {
            // Check if session expired
            if (error.message === 'Não autenticado' || error.message === 'Acesso negado') {
                await logout()
                return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' }
            }
            return { success: false, error: error.message || 'Erro ao alterar senha' }
        }
    }

    const updateProfile = async (fullName: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await authApi.updateProfile(fullName)
            if (result.success && result.user) {
                const updatedUser = { ...user, ...result.user }
                setUser(updatedUser)
                localStorage.setItem('user', JSON.stringify(updatedUser))
                return { success: true }
            }
            // Check if session expired
            if (result.error === 'Não autenticado' || result.error === 'Acesso negado') {
                await logout()
                return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' }
            }
            return { success: false, error: result.error || 'Erro ao atualizar perfil' }
        } catch (error: any) {
            // Check if session expired
            if (error.message === 'Não autenticado' || error.message === 'Acesso negado') {
                await logout()
                return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' }
            }
            return { success: false, error: error.message || 'Erro ao atualizar perfil' }
        }
    }

    const clearMustChangePassword = () => {
        setMustChangePassword(false)
    }

    // Use permissions from server, fallback to defaults for unauthenticated users
    const p = permissions || defaultPermissions
    const isAuthenticated = !!user
    const isAdmin = user?.role === 'admin'

    return (
        <AuthContext.Provider
            value={{
                user,
                permissions,
                isLoading,
                isAuthenticated,
                isAdmin,
                // Permission shortcuts from server
                canViewMusic: p.can_view_music,
                canDownloadMusic: p.can_download_music,
                canEditMusicMetadata: p.can_edit_music_metadata,
                canUploadMusic: p.can_upload_music,
                canDeleteMusic: p.can_delete_music,
                canManageLists: p.can_manage_lists,
                canManageCategories: p.can_manage_categories,
                canManageUsers: p.can_manage_users,
                canManageRoles: p.can_manage_roles,
                canAccessAdmin: p.can_access_admin,
                // Legacy compatibility (maps to new permissions)
                canEdit: p.can_edit_music_metadata || p.can_manage_lists,
                canUpload: p.can_upload_music,
                canDelete: p.can_delete_music,
                mustChangePassword,
                login,
                logout,
                refreshUser,
                changePassword,
                updateProfile,
                clearMustChangePassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
