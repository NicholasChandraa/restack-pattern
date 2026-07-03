"use client"

import { RegisterSchema, type RegisterInput } from "@restack/shared"
import { useAuthMutation } from "@/shared/hooks/use-auth-mutation"
import { authApi } from "../services/auth.api"

export function useRegister() {
  const { submit, error, isPending } = useAuthMutation<RegisterInput>(RegisterSchema, authApi.register)
  return { register: submit, error, isPending }
}
