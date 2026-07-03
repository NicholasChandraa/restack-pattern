"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "../lib/api-client"

/**
 * Client-side auth gate for pages with no data fetch of their own to piggyback
 * a redirect on (see use-profile.ts for pages that need both). Necessary
 * because there is no server-side proxy.ts guard anymore — see the Next.js 16
 * caveat in CLAUDE.md for why.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    apiClient("/api/user/me")
      .then(() => setChecked(true))
      .catch(() => router.replace("/login"))
  }, [router])

  if (!checked) return null
  return <>{children}</>
}
