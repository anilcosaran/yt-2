import { permanentRedirect } from 'next/navigation'

// Scene is now Spark; keep old links and bookmarks working.
export default function Page() {
  permanentRedirect('/spark')
}
