const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Request failed")
  return data as T
}
