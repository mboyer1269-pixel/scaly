/** Narrow an unknown JSON value to a plain object before treating it as a patch. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function pickJsonFields<T extends object>(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
): Partial<T> {
  const allowed = new Set(allowedFields);
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key))) as Partial<T>;
}
