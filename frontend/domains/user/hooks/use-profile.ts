"use client"

import { useEffect, useState } from "react"
import type { AuthUser } from "@restack/shared"
import { userApi } from "../services/user.api"

/**
 * Domain-specific Hook for user profiles.
 * Manages loading, error, and profile states, abstracting backend calls.
 * 
 * Semi-DDD rules:
 * - Domain hooks (`domains/[feature]/hooks/*.ts`) manage the reactive state and orchestrate calls to `services/`.
 * - UI components should import hooks to retrieve state and trigger actions, keeping the components themselves focused purely on layout/rendering.
 */
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
