const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  })

  const contentType = res.headers.get("content-type")
  let data: any

  if (contentType && contentType.includes("application/json")) {
    data = await res.json()
  } else {
    data = { error: (await res.text()) || "Request failed" }
  }

  if (!res.ok) throw new Error(data.error ?? "Request failed")
  return data as T
}
