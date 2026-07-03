"use client"

import { LoginSchema, type LoginInput } from "@restack/shared"
import { useAuthMutation } from "@/shared/hooks/use-auth-mutation"
import { authApi } from "../services/auth.api"

export function useLogin() {
  const { submit, error, isPending } = useAuthMutation<LoginInput>(LoginSchema, authApi.login)
  return { login: submit, error, isPending }
}
