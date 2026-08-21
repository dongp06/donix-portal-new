'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Clipboard, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ImageLightbox, type LightboxImage } from '@/components/media/ImageLightbox';
import { MediaImage } from '@/components/media/MediaImage';
import { resolveMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export type MarkdownRendererProps = {
  value: string;
  className?: string;
  emptyLabel?: string;
};

function resolveAssetUrl(url: string | undefined): string {
  return resolveMediaUrl(url);
}

/**
 * rehype-sanitize runs before ReactMarkdown hands props to custom components.
 * `attachment://` is intentionally not an allowed browser protocol, so it
 * would otherwise be stripped before the img renderer gets a chance to
 * resolve it. Normalize references while they are still Markdown text.
 */
function normalizeAttachmentReferences(value: string): string {
  return value.replace(
    /(\]\(\s*)attachment:\/\/([a-zA-Z0-9_-]+)(?=\s*(?:"[^"]*"|'[^']*')?\s*\))/g,
    (_match, prefix: string, id: string) => `${prefix}/api/media/${encodeURIComponent(id)}`,
  );
}

function safeMarkdownUrl(url: string | undefined): string {
  const resolved = resolveAssetUrl(url);
  if (!resolved) return '#';
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(resolved)) return resolved;
  return '#';
}

function normalizeCallouts(value: string): string {
  return value.replace(
    /(^|\n):::\s*(info|warning|success|danger)\s*\n([\s\S]*?)\n:::/gi,
    (_match, prefix: string, type: string, body: string) => {
      const labels: Record<string, string> = {
        info: 'Thông tin',
        warning: 'Lưu ý',
        success: 'Đã kiểm tra',
        danger: 'Cảnh báo',
      };
      const quotedBody = body
        .split(/\r?\n/)
        .map((line: string) => `> ${line}`)
        .join('\n');
      return `${prefix}> **${labels[type.toLowerCase()] ?? 'Thông tin'}**\n${quotedBody}`;
    },
  );
}

function textContent(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (value && typeof value === 'object' && 'props' in value) {
    return textContent((value as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function slugifyHeading(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function extractImages(value: string): LightboxImage[] {
  const images: LightboxImage[] = [];
  const pattern = /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of value.matchAll(pattern)) {
    const src = resolveAssetUrl(match[2]);
    if (!src || images.some((image) => image.src === src)) continue;
    images.push({ src, alt: match[1] || 'Hình ảnh trong bài viết' });
  }
  return images;
}

function MarkdownImage({
  src,
  alt,
  title,
}: {
  src: string;
  alt: string;
  title?: string;
}) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      title={title}
      loading="lazy"
      className="mx-auto max-h-[34rem] min-h-32 w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
    />
  );
}

export function MarkdownRenderer({ value, className, emptyLabel = 'Chưa có nội dung.' }: MarkdownRendererProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [wrapCode, setWrapCode] = useState(false);
  const images = useMemo(() => extractImages(value), [value]);
  const markdown = useMemo(
    () => normalizeCallouts(normalizeAttachmentReferences(value)),
    [value],
  );

  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied((current) => (current === code ? null : current)), 1600);
    } catch {
      setCopied(null);
      toast.error('Không thể sao chép mã nguồn.');
    }
  }, []);

  const components = useMemo<Components>(() => ({
    h1: ({ children }) => <h1 id={slugifyHeading(textContent(children))} className="mt-8 scroll-mt-24 text-2xl font-bold tracking-tight text-foreground first:mt-0 sm:text-3xl">{children}</h1>,
    h2: ({ children }) => <h2 id={slugifyHeading(textContent(children))} className="mt-8 scroll-mt-24 text-xl font-bold tracking-tight text-foreground first:mt-0 sm:text-2xl">{children}</h2>,
    h3: ({ children }) => <h3 id={slugifyHeading(textContent(children))} className="mt-6 scroll-mt-24 text-lg font-bold text-foreground">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-5 text-base font-bold text-foreground">{children}</h4>,
    p: ({ children }) => <p className="my-3 leading-7 text-foreground/85">{children}</p>,
    ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 text-foreground/85 marker:text-brand">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 text-foreground/85 marker:font-semibold marker:text-brand">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
    blockquote: ({ children }) => {
      const label = textContent(children).toLowerCase();
      const tone = label.includes('cảnh báo')
        ? 'border-red-500/30 bg-red-500/[0.07] text-red-900 dark:text-red-100'
        : label.includes('lưu ý')
          ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100'
          : label.includes('đã kiểm tra')
            ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-950 dark:text-emerald-100'
            : 'border-sky-500/30 bg-sky-500/[0.08] text-sky-950 dark:text-sky-100';
      return <blockquote className={cn('my-5 rounded-xl border px-4 py-2 [&>p:first-child]:font-semibold', tone)}>{children}</blockquote>;
    },
    a: ({ href, children, ...props }) => {
      const resolved = safeMarkdownUrl(href);
      const external = /^https?:\/\//i.test(resolved);
      return <a {...props} href={resolved} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className="font-medium text-brand underline decoration-brand/35 underline-offset-4 transition-colors hover:decoration-brand">{children}{external ? <ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden /> : null}</a>;
    },
    img: ({ src, alt, title }) => {
      const resolved = resolveAssetUrl(typeof src === 'string' ? src : undefined);
      const index = images.findIndex((image) => image.src === resolved);
      return (
        <figure className="my-5 overflow-hidden rounded-xl border border-border bg-muted/30">
          <button type="button" className="group block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset" onClick={() => index >= 0 && setLightboxIndex(index)} aria-label={`Mở ảnh ${alt || 'trong bài viết'}`}>
            <MarkdownImage src={resolved} alt={alt || 'Hình ảnh trong bài viết'} title={title} />
          </button>
          {title ? <figcaption className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">{title}</figcaption> : null}
        </figure>
      );
    },
    table: ({ children }) => <div className="my-5 overflow-x-auto rounded-xl border border-border"><table className="min-w-full text-left text-sm">{children}</table></div>,
    thead: ({ children }) => <thead className="bg-muted/60 text-xs font-semibold text-foreground">{children}</thead>,
    th: ({ children }) => <th className="whitespace-nowrap px-4 py-3">{children}</th>,
    td: ({ children }) => <td className="border-t border-border px-4 py-3 align-top text-foreground/80">{children}</td>,
    hr: () => <hr className="my-7 border-0 border-t border-border" />,
    input: ({ type, checked, disabled }) => type === 'checkbox' ? <input type="checkbox" checked={checked} disabled={disabled} readOnly className="mr-2 inline-block h-4 w-4 align-[-0.15em] accent-[hsl(var(--brand))]" /> : null,
    code: ({ className, children }) => {
      const code = String(children).replace(/\n$/, '');
      const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
      const inline = !className && !code.includes('\n');
      if (inline) return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-brand">{children}</code>;
      return (
        <div className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-[11px] text-slate-300">
            <span className="font-mono">{language || 'code'}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setWrapCode((current) => !current)} className="rounded px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">{wrapCode ? 'Không xuống dòng' : 'Xuống dòng'}</button>
              <button type="button" onClick={() => void copyCode(code)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">{copied === code ? <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden /> : <Clipboard className="h-3.5 w-3.5" aria-hidden />}{copied === code ? 'Đã copy' : 'Copy'}</button>
            </div>
          </div>
          <SyntaxHighlighter language={language || 'text'} style={oneDark} PreTag="div" wrapLongLines={wrapCode} customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.78rem', lineHeight: 1.7, overflowX: wrapCode ? 'hidden' : 'auto' }}>{code}</SyntaxHighlighter>
        </div>
      );
    },
  }), [copied, copyCode, images, wrapCode]);

  if (!value.trim()) return <p className={cn('text-sm text-muted-foreground', className)}>{emptyLabel}</p>;

  return (
    <>
      <div className={cn('markdown-content min-w-0 break-words text-[15px] sm:text-base', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components} urlTransform={safeMarkdownUrl}>
          {markdown}
        </ReactMarkdown>
      </div>
      {lightboxIndex !== null && images.length ? <ImageLightbox images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} /> : null}
    </>
  );
}
