// Tipos base para o sistema de músicas da igreja

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'user';
    created_at: string;
    last_login?: string;
    is_active: boolean;
}

export interface Music {
    id: number;
    original_name: string;
    filename: string;
    song_name?: string;
    artist?: string;
    category?: string;
    liturgical_time?: string;
    musical_key?: string;
    youtube_link?: string;
    file_size: number;
    upload_date: string;
    pages?: number;
    description?: string;
    file_hash: string;
    uploaded_by: number;
    // Campos expandidos para relacionamentos
    categories?: string[];
    liturgical_times?: string[];
}

export interface Category {
    id: number;
    name: string;
    created_at: string;
}

export interface LiturgicalTime {
    id: number;
    name: string;
    created_at: string;
}

export interface MusicList {
    id: number;
    name: string;
    observations?: string;
    created_by: number;
    created_at: string;
    updated_at: string;
    music_count?: number;
    musics?: Music[];
}

export interface MusicListItem {
    id: number;
    list_id: number;
    pdf_file_id: number;
    order_index: number;
    added_at: string;
    music?: Music;
}

// Tipos para filtros e busca
export interface MusicFilters {
    search?: string;
    categories?: string[];
    liturgical_times?: string[];
    musical_keys?: string[];
    has_youtube?: boolean;
    uploaded_by?: number;
}

export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Tipos para upload
export interface UploadProgress {
    filename: string;
    progress: number;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
    error?: string;
}

export interface UploadMetadata {
    song_name?: string;
    artist?: string;
    categories?: string[];
    liturgical_times?: string[];
    musical_key?: string;
    youtube_link?: string;
    description?: string;
}

// Tipos para dashboard e estatísticas
export interface DashboardStats {
    total_musics: number;
    total_lists: number;
    total_categories: number;
    total_liturgical_times: number;
    total_users: number;
    avg_musics_per_list: number;
    total_file_size_mb: number;
    total_pages: number;
    musics_with_youtube: number;
    largest_list?: {
        name: string;
        count: number;
    };
    most_popular_category?: {
        name: string;
        count: number;
    };
}

export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string[];
        borderColor?: string;
        borderWidth?: number;
    }[];
}

export interface TopMusic {
    id: number;
    name: string;
    artist: string;
    category: string;
    youtube_link?: string;
    usage_count: number;
}

export interface TopArtist {
    artist: string;
    music_count: number;
}

// Tipos para formulários
export interface LoginForm {
    username: string;
    password: string;
}

export interface RegisterForm {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface MusicEditForm {
    song_name: string;
    artist: string;
    categories: string[];
    liturgical_times: string[];
    musical_key: string;
    youtube_link: string;
    description: string;
}

export interface ListEditForm {
    name: string;
    observations: string;
}

// Tipos para API responses
export interface ApiResponse<T = any> {
    success?: boolean;
    message?: string;
    data?: T;
    error?: string;
    code?: string;
}

export interface AuthResponse {
    message: string;
    user: User;
}

// Tipos para eventos e ações
export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
}

export interface ModalState {
    isOpen: boolean;
    type?: 'confirm' | 'info' | 'edit' | 'upload';
    title?: string;
    message?: string;
    data?: any;
    onConfirm?: () => void;
    onCancel?: () => void;
}

// Tipos para drag and drop
export interface DragItem {
    id: number;
    index: number;
    type: string;
}

export interface DropResult {
    draggedId: number;
    droppedOnId: number;
    newIndex: number;
}

// Tipos para PDF viewer
export interface PdfViewerState {
    currentPage: number;
    totalPages: number;
    scale: number;
    isLoading: boolean;
    error?: string;
}

// Constantes úteis
export const MUSICAL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
] as const;

export type MusicalKey = typeof MUSICAL_KEYS[number];

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = typeof USER_ROLES[number];

export const TOAST_TYPES = ['success', 'error', 'warning', 'info'] as const;
export type ToastType = typeof TOAST_TYPES[number];