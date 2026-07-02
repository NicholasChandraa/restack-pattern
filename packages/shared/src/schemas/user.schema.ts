import { z } from "zod"

/** Zod validation schema for updating user profile (partial updates). */
export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
})

/** TypeScript input type inferred from UpdateProfileSchema. */
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
