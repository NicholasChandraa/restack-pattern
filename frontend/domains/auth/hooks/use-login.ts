"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoginSchema, type LoginInput } from "@restack/shared"
import { authApi } from "../services/auth.api"

export function useLogin() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const login = async (data: LoginInput) => {
    const parsed = LoginSchema.safeParse(data)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setIsPending(true)
    setError(null)
    try {
      await authApi.login(parsed.data)
      router.push("/dashboard")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsPending(false)
    }
  }

  return { login, error, isPending }
}
