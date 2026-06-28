import { z } from "zod"

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
