import type { JWTPayload } from "jose"

export interface AuthTokenPayload extends JWTPayload {
  sub: string
  email: string
  role: string
}
