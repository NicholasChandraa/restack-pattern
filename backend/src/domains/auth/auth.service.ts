import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import type { LoginInput, RegisterInput } from "@restack/shared"
import { env } from "../../config/env.js"
import { authRepo } from "./auth.repo.js"

const secret = new TextEncoder().encode(env.JWT_SECRET)

export const authService = {
  register: async (data: RegisterInput) => {
    const existing = await authRepo.findByEmail(data.email)
    if (existing) throw new Error("Email already in use")

    const password = await bcrypt.hash(data.password, 10)
    const user = await authRepo.create({ ...data, password })
    return { id: user.id, name: user.name, email: user.email }
  },

  login: async (data: LoginInput) => {
    const user = await authRepo.findByEmail(data.email)
    if (!user) throw new Error("Invalid credentials")

    const valid = await bcrypt.compare(data.password, user.password)
    if (!valid) throw new Error("Invalid credentials")

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    return { token, user: { id: user.id, name: user.name, email: user.email } }
  },

  verifyToken: async (token: string) => {
    const { payload } = await jwtVerify(token, secret)
    return payload
  },
}
