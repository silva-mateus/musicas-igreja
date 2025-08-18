import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const listId = params.id
        const body = await request.json()

        console.log('🔄 [PROXY] Reordering list:', listId, 'with order:', body.item_order)

        const response = await fetch(`${BACKEND_URL}/api/merge_lists/${listId}/reorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        console.log('📡 [PROXY] Reorder response status:', response.status, response.statusText)

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
        console.log('✅ [PROXY] List reordered successfully')
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Reorder error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
