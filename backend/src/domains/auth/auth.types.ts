import type { JWTPayload } from "jose"

export interface AuthTokenPayload extends JWTPayload {
  sub: string
  email: string
  // Add fields here when the user model supports them, e.g. role, permissions.
}
