'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/utils'

export default function UploadPage() {
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    async function onSubmit(formData: FormData) {
        setBusy(true)
        setMessage(null)
        try {
            const res = await fetch(`${API_BASE}/api/files`, {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro no upload')
            setMessage(`Upload OK: #${data.file_id} - ${data.filename}`)
        } catch (e: any) {
            setMessage(e.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="container py-6 space-y-4">
            <h2 className="text-xl font-semibold">Upload</h2>
            <form
                action={onSubmit}
                className="grid gap-3 max-w-xl"
            >
                <Input type="file" name="file" accept="application/pdf" required />
                <Input name="song_name" placeholder="Nome da música" />
                <Input name="artist" placeholder="Artista" />
                <Input name="musical_key" placeholder="Tom (ex: G, C#m)" />
                <Input name="youtube_link" placeholder="YouTube URL" />
                <Input name="description" placeholder="Descrição" />
                <Button type="submit" disabled={busy}>
                    {busy ? 'Enviando...' : 'Enviar'}
                </Button>
            </form>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
    )
}


