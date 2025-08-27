import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

// API route for discovering entities
export async function POST(request: NextRequest) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/discover-entities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        if (!response.ok) {
            console.error('❌ [PROXY] Backend error:', response.status, response.statusText)
            return NextResponse.json({ error: 'Backend error' }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        // Tentar primeiro a rota direta de sugestões
        let response = await fetch(`${BACKEND_URL}/api/filters/suggestions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        // Se a rota direta falhar, tentar as rotas separadas do dashboard
        if (!response.ok) {
            console.warn('⚠️ [PROXY] Rota direta falhou, tentando rotas separadas...')

            const [catsResponse, timesResponse] = await Promise.all([
                fetch(`${BACKEND_URL}/api/dashboard/get_categories`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    cache: 'no-store',
                }).catch(() => ({ ok: false, json: () => Promise.resolve([]) })),
                fetch(`${BACKEND_URL}/api/dashboard/get_liturgical_times`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    cache: 'no-store',
                }).catch(() => ({ ok: false, json: () => Promise.resolve([]) }))
            ])

            const categories = catsResponse.ok ? await catsResponse.json() : []
            const liturgical_times = timesResponse.ok ? await timesResponse.json() : []

            // Buscar artistas através da rota de sugestões ou retornar vazio
            let artists = []
            try {
                const suggestionsResponse = await fetch(`${BACKEND_URL}/api/filters/suggestions`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    cache: 'no-store',
                })
                if (suggestionsResponse.ok) {
                    const suggestionsData = await suggestionsResponse.json()
                    artists = suggestionsData.artists || []
                }
            } catch (e) {
                console.warn('⚠️ [PROXY] Não foi possível buscar artistas:', e)
            }

            const data = {
                categories: Array.isArray(categories) ? categories : [],
                liturgical_times: Array.isArray(liturgical_times) ? liturgical_times : [],
                artists: Array.isArray(artists) ? artists : [],
                musical_keys: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']
            }

            return NextResponse.json(data)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({ error: 'Network error', details: error.message }, { status: 500 })
    }
}
