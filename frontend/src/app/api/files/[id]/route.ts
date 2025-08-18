import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const fileId = params.id

        const response = await fetch(`${BACKEND_URL}/api/files/${fileId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        if (!response.ok) {
            console.error('❌ [PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const fileId = params.id
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/files/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            console.error('❌ [PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const fileId = params.id

        console.log('🗑️ [PROXY] Deleting file:', fileId)

        const response = await fetch(`${BACKEND_URL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        console.log('📡 [PROXY] Delete response status:', response.status, response.statusText)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ [PROXY] Backend error details:', errorText)
            return NextResponse.json({
                error: 'Backend error',
                status: response.status,
                details: errorText
            }, { status: response.status })
        }

        const data = await response.json()
        console.log('✅ [PROXY] File deleted successfully')
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Delete error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}