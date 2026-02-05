import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const listId = params.id

        const response = await fetch(`${BACKEND_URL}/api/generate_report/${listId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        if (!response.ok) {
            console.error('[PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ success: false, message: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('[PROXY] Network error:', error)
        return NextResponse.json({ success: false, message: 'Network error', details: error.message }, { status: 500 })
    }
}
