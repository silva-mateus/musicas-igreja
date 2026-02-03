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

    const refreshUser = async () => {
        try {
            const storedUser = localStorage.getItem('user')
            const storedPermissions = localStorage.getItem('permissions')
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser)
                setUser(parsedUser)
                setMustChangePassword(parsedUser.must_change_password || false)
                
                if (storedPermissions) {
                    setPermissions(JSON.parse(storedPermissions))
                } else if (parsedUser.permissions) {
                    setPermissions(parsedUser.permissions)
                }
            }
        } catch (error) {
            console.error('Error refreshing user:', error)
            setUser(null)
            setPermissions(null)
            setMustChangePassword(false)
            localStorage.removeItem('user')
            localStorage.removeItem('permissions')
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
            setUser(null)
            setPermissions(null)
            setMustChangePassword(false)
            localStorage.removeItem('user')
            localStorage.removeItem('permissions')
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
            return { success: false, error: result.error || 'Erro ao alterar senha' }
        } catch (error: any) {
            console.error('Change password error:', error)
            return { success: false, error: error.message || 'Erro ao alterar senha' }
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
