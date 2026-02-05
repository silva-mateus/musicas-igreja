import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const itemId = params.id

        const response = await fetch(`${BACKEND_URL}/api/merge_list_items/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
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
