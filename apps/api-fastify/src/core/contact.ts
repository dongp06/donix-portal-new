const CONTACT_KEYS = ['zalo', 'telegram', 'phone', 'messenger', 'facebook', 'website'] as const;

function asRecord(value: string | Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function mergeContacts(...values: Array<string | Record<string, unknown> | null | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const value of values) {
    const parsed = asRecord(value);
    if (!parsed) continue;
    for (const key of CONTACT_KEYS) {
      const item = parsed[key];
      if (typeof item === 'string' && item.trim()) result[key] = item.trim();
    }
  }
  return result;
}
