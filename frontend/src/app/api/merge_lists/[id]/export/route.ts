import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const listId = params.id

        const response = await fetch(`${BACKEND_URL}/api/merge_lists/${listId}/export`, {
            method: 'GET',
            cache: 'no-store',
        })

        if (!response.ok) {
            console.error('❌ [PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        // Return the blob directly for PDF download
        const blob = await response.blob()
        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="lista-${listId}.pdf"`,
            },
        })
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
