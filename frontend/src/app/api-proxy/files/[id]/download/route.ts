import { API_BASE } from '@/lib/utils'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const backend = await fetch(`${API_BASE}/api/files/${params.id}/download`, {
        cache: 'no-store',
    })
    const headers = new Headers(backend.headers)
    headers.delete('content-encoding')
    return new Response(backend.body, {
        status: backend.status,
        statusText: backend.statusText,
        headers,
    })
}


