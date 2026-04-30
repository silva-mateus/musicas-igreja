import { redirect } from 'next/navigation'

export default function MusicDetailsPage({ params }: { params: { id: string } }) {
  redirect(`/music?m=${params.id}`)
}
