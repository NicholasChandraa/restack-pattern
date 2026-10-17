/**
 * Zero-dependency RFC 9562 compliant UUIDv7 generator.
 *
 * UUIDv7 combines a 48-bit UNIX timestamp (milliseconds) with 74 bits of
 * cryptographically secure randomness. Unlike UUIDv4, UUIDv7 is strictly
 * time-ordered, making it ideal for primary keys in B-Tree database indexes
 * while avoiding URL enumeration vulnerabilities of auto-incrementing serial IDs.
 *
 * Compatible with Node.js, browsers, and Edge runtimes via globalThis.crypto.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const now = Date.now()

  // 48-bit timestamp (milliseconds since epoch) in big-endian
  bytes[0] = (now / 0x1_00_00_00_00_00) & 0xff
  bytes[1] = (now / 0x1_00_00_00_00) & 0xff
  bytes[2] = (now / 0x1_00_00_00) & 0xff
  bytes[3] = (now / 0x1_00_00) & 0xff
  bytes[4] = (now / 0x1_00) & 0xff
  bytes[5] = now & 0xff

  // Version 7: set 4 bits (0111) in byte 6
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70

  // Variant 1 (RFC 9562): set 2 bits (10) in byte 8
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Validates whether a given string is a valid UUIDv7 format.
 */
export function isUuidv7(uuid: string): boolean {
  const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidv7Regex.test(uuid)
}
