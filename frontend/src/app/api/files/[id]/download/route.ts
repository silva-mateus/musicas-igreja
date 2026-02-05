import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: fileId } = await params

        const response = await fetch(`${BACKEND_URL}/api/files/${fileId}/download`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cookie': request.headers.get('cookie') || '',
            },
        })

        if (!response.ok) {
            console.error('[PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        // Return the blob directly for PDF download
        const blob = await response.blob()
        const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="music-${fileId}.pdf"`

        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': contentDisposition,
            },
        })
    } catch (error: any) {
        console.error('[PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
