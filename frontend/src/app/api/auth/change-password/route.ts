import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify(body),
        })

        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json()

            // Forward the session cookie from backend if present
            const setCookie = response.headers.get('set-cookie')
            const res = NextResponse.json(data, { status: response.status })

            if (setCookie) {
                res.headers.set('set-cookie', setCookie)
            }

            return res
        } else {
            const errorText = await response.text()
            console.error('Backend change-password response was not JSON:', errorText)
            return NextResponse.json(
                { success: false, error: 'Erro inesperado do servidor.' },
                { status: response.status === 200 ? 500 : response.status }
            )
        }
    } catch (error: any) {
        console.error('Change password error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno ao processar troca de senha.' },
            { status: 500 }
        )
    }
}
