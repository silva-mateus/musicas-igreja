import { api } from '@/lib/utils'

async function fetchTop() {
    const top = await api<Record<string, any>>('/api/dashboard/top_musics')
    const topArtists = await api<Array<{ artist: string; music_count: number }>>('/api/dashboard/top_artists')
    return { top, topArtists }
}

export default async function DashboardPage() {
    const { top, topArtists } = await fetchTop()
    return (
        <div className="container py-6 space-y-6">
            <section>
                <h2 className="text-xl font-semibold mb-2">Top músicas (uso em listas)</h2>
                <div className="space-y-1 text-sm">
                    {Array.isArray(top) && top.map((m: any) => (
                        <div key={m.id} className="flex justify-between">
                            <span>{m.name} <span className="text-muted-foreground">— {m.artist}</span></span>
                            <span className="text-muted-foreground">{m.usage_count}x</span>
                        </div>
                    ))}
                </div>
            </section>
            <section>
                <h2 className="text-xl font-semibold mb-2">Top artistas</h2>
                <div className="space-y-1 text-sm">
                    {topArtists.map((a) => (
                        <div key={a.artist} className="flex justify-between">
                            <span>{a.artist}</span>
                            <span className="text-muted-foreground">{a.music_count}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}


