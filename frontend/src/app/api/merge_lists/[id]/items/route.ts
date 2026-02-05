import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const listId = params.id
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/merge_lists/${listId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            console.error('[PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('[PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
