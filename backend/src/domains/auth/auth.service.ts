import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import type { LoginInput, RegisterInput } from "@restack/shared"
import { env } from "../../config/env.js"
import { authRepo } from "./auth.repo.js"
import type { AuthTokenPayload } from "./auth.types.js"

const secret = new TextEncoder().encode(env.JWT_SECRET)
const BCRYPT_COST = 12
// Dummy hash so failed logins on unknown emails still pay the bcrypt cost (timing-attack mitigation).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", BCRYPT_COST)
const normalizeEmail = (email: string) => email.trim().toLowerCase()

const buildTokenPayload = (user: { id: string; email: string }): AuthTokenPayload => ({
  sub: user.id,
  email: user.email,
})

export const authService = {
  register: async (data: RegisterInput) => {
    const email = normalizeEmail(data.email)
    const existing = await authRepo.findByEmail(email)
    if (existing) throw new Error("Email already in use")

    const password = await bcrypt.hash(data.password, BCRYPT_COST)
    const user = await authRepo.create({ ...data, email, password })
    return { id: user.id, name: user.name, email: user.email }
  },

  login: async (data: LoginInput) => {
    const user = await authRepo.findByEmail(normalizeEmail(data.email))
    const valid = await bcrypt.compare(data.password, user ? user.password : DUMMY_HASH)
    if (!user || !valid) throw new Error("Invalid credentials")

    const token = await new SignJWT(buildTokenPayload(user))
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    return { token, user: { id: user.id, name: user.name, email: user.email } }
  },

  verifyToken: async (token: string): Promise<AuthTokenPayload> => {
    const { payload } = await jwtVerify(token, secret)
    return payload as AuthTokenPayload
  },
}
