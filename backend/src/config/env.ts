const required = (key: string): string => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3001),
}
