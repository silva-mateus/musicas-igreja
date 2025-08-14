import { NextRequest } from 'next/server'

const TARGET = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') || 'http://localhost:5000'

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const proxiedPath = url.pathname.replace(/^\/api-proxy/, '') + (url.search || '')
    const backend = await fetch(`${TARGET}${proxiedPath}`, {
        cache: 'no-store',
        headers: {
            // pass through headers if needed
        },
    })
    const headers = new Headers(backend.headers)
    headers.delete('content-encoding')
    return new Response(backend.body, { status: backend.status, statusText: backend.statusText, headers })
}

export async function POST(req: NextRequest) {
    const url = new URL(req.url)
    const proxiedPath = url.pathname.replace(/^\/api-proxy/, '') + (url.search || '')
    const backend = await fetch(`${TARGET}${proxiedPath}`, {
        method: 'POST',
        body: req.body,
        headers: Object.fromEntries(req.headers),
    })
    const headers = new Headers(backend.headers)
    headers.delete('content-encoding')
    return new Response(backend.body, { status: backend.status, statusText: backend.statusText, headers })
}

export async function PUT(req: NextRequest) {
    const url = new URL(req.url)
    const proxiedPath = url.pathname.replace(/^\/api-proxy/, '') + (url.search || '')
    const backend = await fetch(`${TARGET}${proxiedPath}`, {
        method: 'PUT',
        body: req.body,
        headers: Object.fromEntries(req.headers),
    })
    const headers = new Headers(backend.headers)
    headers.delete('content-encoding')
    return new Response(backend.body, { status: backend.status, statusText: backend.statusText, headers })
}

export async function DELETE(req: NextRequest) {
    const url = new URL(req.url)
    const proxiedPath = url.pathname.replace(/^\/api-proxy/, '') + (url.search || '')
    const backend = await fetch(`${TARGET}${proxiedPath}`, {
        method: 'DELETE',
        headers: Object.fromEntries(req.headers),
    })
    const headers = new Headers(backend.headers)
    headers.delete('content-encoding')
    return new Response(backend.body, { status: backend.status, statusText: backend.statusText, headers })
}


