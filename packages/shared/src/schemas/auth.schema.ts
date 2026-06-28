import { z } from "zod"

// Validation
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

// TypeSafety
export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
