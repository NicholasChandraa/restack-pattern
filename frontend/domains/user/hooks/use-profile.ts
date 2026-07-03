"use client"

import { useEffect, useState } from "react"
import type { AuthUser } from "@restack/shared"
import { userApi } from "../services/user.api"

export function useProfile() {
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    userApi
      .me()
      .then((res) => setProfile(res.user))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setIsLoading(false))
  }, [])

  return { profile, isLoading, error }
}
