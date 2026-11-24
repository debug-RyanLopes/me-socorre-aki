export function normalizeSerial(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}
