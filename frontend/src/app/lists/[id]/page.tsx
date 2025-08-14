import { api } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

async function fetchList(id: string) {
    return api<{ success: boolean; list: { id: number; name: string; observations: string | null; created_date: string; updated_date: string; items: Array<{ item_id: number; order_position: number; file: { id: number; filename: string; song_name?: string; artist?: string } }> } }>(`/api/merge_lists/${id}`)
}

export default async function ListDetailsPage({ params }: { params: { id: string } }) {
    const data = await fetchList(params.id)
    const list = data.list
    return (
        <div className="container py-6 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{list.name}</h2>
                <div className="flex gap-4 text-sm">
                    <Link href={`/api-proxy/merge_lists/${list.id}/export`} className="underline">Exportar PDF</Link>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Itens</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="space-y-2 list-decimal list-inside">
                        {list.items.map((i) => (
                            <li key={i.item_id} className="flex justify-between">
                                <span>
                                    {i.file.song_name || i.file.filename.replace('.pdf', '')}
                                    <span className="text-muted-foreground"> — {i.file.artist || 'Não informado'}</span>
                                </span>
                                <Link href={`/api-proxy/files/${i.file.id}/stream`} className="underline text-sm">Ver</Link>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>
        </div>
    )
}


