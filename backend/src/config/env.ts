import "dotenv/config"
import { z } from "zod";

const envSchema = z.object({
  // Memastikan DATABASE_URL ada dan berformat URL valid
  DATABASE_URL: z.string().url("DATABASE_URL harus berupa URL yang valid"),
  // Memastikan JWT_SECRET diisi dan minimal 1 karakter
  JWT_SECRET: z.string().min(1, "JWT_SECRET wajib diisi"),
  // Validasi enum dengan nilai default "development"
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Mengubah string dari process.env menjadi Number secara otomatis
  PORT: z.coerce.number().default(3001),
  // Validasi cookie samesite dengan nilai default "Lax"
  COOKIE_SAME_SITE: z.enum(["Lax", "None", "Strict", ""]).default(""),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
})

export const env = envSchema.parse(process.env)