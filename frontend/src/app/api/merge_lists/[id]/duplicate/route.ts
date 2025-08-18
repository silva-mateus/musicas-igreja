import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'http://127.0.0.1:5000'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const listId = params.id
        const body = await request.json()

        console.log('📋 [PROXY] Duplicating list:', listId, 'with name:', body.name)

        const response = await fetch(`${BACKEND_URL}/api/merge_lists/${listId}/duplicate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        console.log('📡 [PROXY] Duplicate response status:', response.status, response.statusText)

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
        console.log('✅ [PROXY] List duplicated successfully, new ID:', data.new_list_id)
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Duplicate error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
