import { z } from "zod"

/** Zod validation schema for login form and request payload. */
export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

/** Zod validation schema for registering a new account. */
export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
})

/** TypeScript input type inferred from LoginSchema. */
export type LoginInput = z.infer<typeof LoginSchema>

/** TypeScript input type inferred from RegisterSchema. */
export type RegisterInput = z.infer<typeof RegisterSchema>
