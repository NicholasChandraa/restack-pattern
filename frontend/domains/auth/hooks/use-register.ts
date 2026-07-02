"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RegisterSchema, type RegisterInput } from "@restack/shared"
import { authApi } from "../services/auth.api"

export function useRegister() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const register = async (data: RegisterInput) => {
    const parsed = RegisterSchema.safeParse(data)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setIsPending(true)
    setError(null)
    try {
      await authApi.register(parsed.data)
      router.push("/dashboard")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsPending(false)
    }
  }

  return { register, error, isPending }
}
