import { redirect } from 'next/navigation'

export default function ChordEditorPage({ params }: { params: { id: string } }) {
  redirect(`/music?m=${params.id}`)
}
