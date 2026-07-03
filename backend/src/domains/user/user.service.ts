import type { AuthUser, UpdateProfileInput } from "@restack/shared"
import { userRepo } from "./user.repo.js"

export class UserNotFoundError extends Error {}

const toPublicUser = (user: { id: string; name: string; email: string }): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
})

export const userService = {
  getProfile: async (id: string): Promise<AuthUser> => {
    const user = await userRepo.findById(id)
    if (!user) throw new UserNotFoundError("User not found")
    return toPublicUser(user)
  },

  updateProfile: async (id: string, data: UpdateProfileInput): Promise<AuthUser> => {
    // An empty body validates against UpdateProfileSchema (all fields optional) but would
    // reach db.update(...).set({}), which Drizzle/postgres reject — short-circuit to a no-op.
    if (Object.keys(data).length === 0) return userService.getProfile(id)

    const user = await userRepo.updateProfile(id, data)
    if (!user) throw new UserNotFoundError("User not found")
    return toPublicUser(user)
  },
}
