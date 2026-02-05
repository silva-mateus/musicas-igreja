import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify(body),
        })

        const setCookieHeader = response.headers.get('set-cookie')
        const data = await response.json()

        const nextResponse = NextResponse.json(data, { status: response.status })

        if (setCookieHeader) {
            nextResponse.headers.set('set-cookie', setCookieHeader)
        }

        return nextResponse
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
