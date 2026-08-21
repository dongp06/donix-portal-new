/**
 * Small browser-only wrapper for local drafts.
 *
 * localStorage can throw (private browsing, disabled storage, quota exceeded),
 * so callers intentionally handle the error instead of showing a false
 * "saved" state.
 */
export function readDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function writeDraft<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Removing a draft is best effort; the write path still reports failures.
  }
}
