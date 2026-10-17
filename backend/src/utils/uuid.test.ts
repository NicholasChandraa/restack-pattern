import { isUuidv7, uuidv7 } from "@restack/shared"
import { describe, expect, it } from "vitest"

describe("uuidv7 generator", () => {
  it("generates a valid UUIDv7 string", () => {
    const id = uuidv7()
    expect(isUuidv7(id)).toBe(true)
  })

  it("conforms to version 7 and RFC 9562 variant format", () => {
    const id = uuidv7()
    const parts = id.split("-")
    expect(parts).toHaveLength(5)
    // 3rd part starts with '7' (version 7)
    expect(parts[2]?.charAt(0)).toBe("7")
    // 4th part starts with 8, 9, a, or b (variant 1)
    expect(["8", "9", "a", "b"]).toContain(parts[3]?.charAt(0).toLowerCase())
  })

  it("produces chronologically ordered identifiers", async () => {
    const ids: string[] = []
    for (let i = 0; i < 20; i++) {
      ids.push(uuidv7())
      // short delay to test monotonic sorting
      await new Promise((r) => setTimeout(r, 2))
    }

    const sorted = [...ids].sort()
    expect(ids).toEqual(sorted)
  })

  it("isUuidv7 rejects invalid UUID formats", () => {
    expect(isUuidv7("not-a-uuid")).toBe(false)
    // UUIDv4 (version nibble is 4, not 7)
    expect(isUuidv7("550e8400-e29b-41d4-a716-446655440000")).toBe(false)
  })
})
