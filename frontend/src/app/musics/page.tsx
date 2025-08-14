import { api } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Input } from '@/components/ui/input'

async function fetchMusics(searchParams: Record<string, string | string[] | undefined>) {
    const q = typeof searchParams.q === 'string' ? searchParams.q : ''
    const category = typeof searchParams.category === 'string' ? searchParams.category : ''
    const liturgical_time = typeof searchParams.liturgical_time === 'string' ? searchParams.liturgical_time : ''
    const page = typeof searchParams.page === 'string' ? searchParams.page : '1'
    const per_page = typeof searchParams.per_page === 'string' ? searchParams.per_page : '25'
    const qs = new URLSearchParams({ q, category, liturgical_time, page, per_page })
    return api<{ files: any[]; pagination: any }>(`/api/files?${qs.toString()}`)
}

export default async function MusicsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
    const data = await fetchMusics(searchParams)
    return (
        <div className="container py-6 space-y-4">
            <div className="flex items-center gap-2">
                <form className="flex-1">
                    <Input name="q" placeholder="Buscar por nome, artista, descrição..." defaultValue={typeof searchParams.q === 'string' ? searchParams.q : ''} />
                </form>
                <Link href="/upload" className="text-sm underline">Novo upload</Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.files.map((f) => (
                    <Card key={f.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start gap-2">
                                <span>{f.song_name || f.filename.replace('.pdf', '')}</span>
                                {f.musical_key && <Badge variant="secondary">{f.musical_key}</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {f.categories?.map((c: string) => (
                                    <Badge key={c} variant="outline">{c}</Badge>
                                ))}
                            </div>
                            <div className="flex justify-between">
                                <span>{f.artist || 'Não informado'}</span>
                                <div className="flex gap-3">
                                    <Link href={`/api-proxy/files/${f.id}/stream`} className="underline">Ver</Link>
                                    <Link href={`/api-proxy/files/${f.id}/download`} className="underline">Baixar</Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}


