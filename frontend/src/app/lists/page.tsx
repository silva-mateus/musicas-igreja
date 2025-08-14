import { api } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

async function fetchLists() {
    return api<Array<{ id: number; name: string; updated_date: string; file_count: number }>>('/api/merge_lists')
}

export default async function ListsPage() {
    const lists = await fetchLists()
    return (
        <div className="container py-6 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Listas</h2>
                <Link href="/lists/new" className="text-sm underline">Nova lista</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.map((l) => (
                    <Card key={l.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between">
                                <span>{l.name}</span>
                                <span className="text-sm text-muted-foreground">{l.file_count} músicas</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/lists/${l.id}`} className="underline text-sm">Abrir</Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}


