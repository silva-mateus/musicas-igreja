import { redirect } from 'next/navigation'

export default function EditMusicPage({ params }: { params: { id: string } }) {
  redirect(`/music?m=${params.id}`)
}
