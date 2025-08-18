import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const searchParams = url.searchParams

        const backendUrl = `${BACKEND_URL}/api/merge_lists?${searchParams.toString()}`
        console.log('🔄 [PROXY] Proxying request to:', backendUrl)

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        console.log('📡 [PROXY] Response status:', response.status, response.statusText)

        if (!response.ok) {
            console.error('❌ [PROXY] Backend error:', response.status, response.statusText)
            const errorText = await response.text()
            console.error('❌ [PROXY] Error details:', errorText)
            return NextResponse.json({ error: 'Backend error', status: response.status, details: errorText }, { status: response.status })
        }

        const data = await response.json()
        console.log('✅ [PROXY] Backend response received:', Array.isArray(data) ? `Array with ${data.length} items` : typeof data)

        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/merge_lists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('❌ Proxy error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
