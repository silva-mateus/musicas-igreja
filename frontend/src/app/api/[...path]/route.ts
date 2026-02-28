import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

async function proxyToBackend(request: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/')
    const url = new URL(request.url)
    const backendUrl = `${BACKEND_URL}/api/${path}${url.search}`

    const headers: HeadersInit = {
        'Cookie': request.headers.get('cookie') || '',
    }

    const contentType = request.headers.get('content-type')
    if (contentType && !contentType.includes('multipart')) {
        headers['Content-Type'] = contentType
        headers['Accept'] = 'application/json'
    }

    let body: BodyInit | null = null
    if (!['GET', 'HEAD'].includes(request.method)) {
        if (contentType?.includes('multipart')) {
            body = await request.formData()
        } else {
            body = request.body
        }
    }

    const fetchInit: RequestInit = {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
    }

    if (body === request.body && body !== null) {
        // @ts-ignore - duplex needed for streaming request body
        fetchInit.duplex = 'half'
    }

    try {
        const response = await fetch(backendUrl, fetchInit)

        const resContentType = response.headers.get('content-type') || ''

        if (resContentType.includes('application/pdf') || resContentType.includes('octet-stream')) {
            return new NextResponse(response.body, {
                status: response.status,
                headers: {
                    'Content-Type': resContentType,
                    'Content-Disposition': response.headers.get('content-disposition') || '',
                },
            })
        }

        const data = await response.text()
        return new NextResponse(data, {
            status: response.status,
            headers: { 'Content-Type': resContentType.includes('json') ? 'application/json' : resContentType || 'application/json' },
        })
    } catch (error: any) {
        console.error(`[PROXY] Error forwarding ${request.method} /api/${path}:`, error.message)
        return NextResponse.json(
            { error: 'Erro de conexão com o backend', details: error.message },
            { status: 502 }
        )
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    return proxyToBackend(req, path)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    return proxyToBackend(req, path)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    return proxyToBackend(req, path)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    return proxyToBackend(req, path)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    return proxyToBackend(req, path)
}
