import { redirect } from 'next/navigation'

// yt-2: "Assets" became the Library. Old links keep working.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value)
  }
  const query = params.toString()
  redirect(query ? `/library?${query}` : '/library')
}
