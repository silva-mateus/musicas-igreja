import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const searchParams = url.searchParams

        const backendUrl = `${BACKEND_URL}/api/files?${searchParams.toString()}`

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
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

export async function POST(request: NextRequest) {
    try {
        // Processing file upload

        // Get form data from request
        const formData = await request.formData()

        // Form data received

        // Forward the form data to backend
        const response = await fetch(`${BACKEND_URL}/api/files`, {
            method: 'POST',
            body: formData, // Send form data directly, don't stringify
            // Don't set Content-Type header, let browser set it with boundary
        })

        // Backend response received

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[PROXY] Backend error details:', errorText)
            return NextResponse.json({
                error: 'Backend error',
                status: response.status,
                details: errorText
            }, { status: response.status })
        }

        const data = await response.json()
        // Upload successful

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('[PROXY] Upload error:', error)
        return NextResponse.json({
            error: 'Network error',
            details: error.message
        }, { status: 500 })
    }
}
