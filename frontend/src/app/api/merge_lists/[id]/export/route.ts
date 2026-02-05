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
            console.error('[PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ success: false, message: 'Backend error' }, { status: response.status })
        }

        // Get the PDF blob from backend
        const blob = await response.blob()
        
        // Get filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = `lista_${listId}.pdf`
        if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
            if (match && match[1]) {
                filename = match[1].replace(/['"]/g, '')
            }
        }

        // Return the PDF as a response
        return new NextResponse(blob, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error: any) {
        console.error('[PROXY] Network error:', error)
        return NextResponse.json({ success: false, message: 'Network error', details: error.message }, { status: 500 })
    }
}
