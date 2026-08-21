const ATTACHMENT_ID = /^[a-zA-Z0-9_-]+$/;

/** Resolve persisted media references without exposing storage paths. */
export function resolveMediaUrl(value: string | null | undefined): string {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return '';

  const attachment = /^attachment:\/\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (attachment && ATTACHMENT_ID.test(attachment[1])) {
    return `/api/media/${encodeURIComponent(attachment[1])}`;
  }

  const mediaRoute = /^\/api\/media\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (mediaRoute && ATTACHMENT_ID.test(mediaRoute[1])) {
    return `/api/media/${encodeURIComponent(mediaRoute[1])}`;
  }

  if (/^https?:\/\/[^\s"'<>]+$/i.test(source) || /^\/(?!\/)[^\s"'<>]*$/i.test(source)) {
    return source;
  }
  return '';
}

export function attachmentReference(id: string): string {
  if (!ATTACHMENT_ID.test(id)) return '';
  return `attachment://${id}`;
}
