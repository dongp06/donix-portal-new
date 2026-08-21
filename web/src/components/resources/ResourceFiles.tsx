'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Code2, Download, FileArchive, FileCode2, FileText, History, ImageIcon, LockKeyhole, X } from 'lucide-react';
import type { PostResource, ResourceFile } from '@shared/types';
import { apiPreviewResourceFile, type ResourcePreview } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { MediaImage } from '@/components/media/MediaImage';
import { toast } from 'sonner';
import { useRole } from '@/context/RoleContext';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

function fileIcon(file: ResourceFile) {
  if (file.previewable) return <FileCode2 className="h-5 w-5" aria-hidden />;
  if (file.mimeType.includes('pdf') || file.mimeType.startsWith('text/')) return <FileText className="h-5 w-5" aria-hidden />;
  return <FileArchive className="h-5 w-5" aria-hidden />;
}

function downloadUrl(fileId: string): string {
  return `/api/resources/files/${encodeURIComponent(fileId)}/download`;
}

function imageViewUrl(fileId: string): string {
  return `/api/resources/files/${encodeURIComponent(fileId)}/view`;
}

export function ResourceFiles({ resource, compact = false }: { resource: PostResource; compact?: boolean }) {
  const [preview, setPreview] = useState<ResourcePreview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const pathname = usePathname();
  const { isAuthenticated } = useRole();
  const files = resource.currentVersion.files;
  const loginHref = `/login?returnTo=${encodeURIComponent(pathname || '/resources')}`;
  const needsLogin = resource.requiresLogin && isAuthenticated !== true;

  const downloadFile = async (fileId: string, filename: string) => {
    try {
      const response = await fetchWithTimeout(downloadUrl(fileId), { credentials: 'include', cache: 'no-store' }, 60_000);
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || 'resource-file';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được file tài nguyên.');
    }
  };

  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview]);

  const openPreview = async (file: ResourceFile) => {
    if (!resource.showSource || !file.previewable) return;
    if (needsLogin) {
      window.location.assign(loginHref);
      return;
    }
    setPreviewing(file.id);
    try {
      setPreview(await apiPreviewResourceFile(file.id));
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : 'Không xem được file tài nguyên.');
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <section className={cn('rounded-2xl border border-brand/25 bg-brand/[0.035]', compact ? 'mt-4 p-4' : 'mt-5 p-5 sm:p-6')} aria-labelledby="resource-files-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand"><FileCode2 className="h-4 w-4" aria-hidden /> Official Resource</div>
          <h2 id="resource-files-title" className="mt-2 text-lg font-bold">{resource.title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{resource.description}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground"><p className="font-semibold text-foreground">v{resource.currentVersion.version}</p><p className="mt-1">{resource.license}</p></div>
      </div>

      <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {files.map((file) => (
          <div key={file.id} className="flex flex-wrap items-center gap-3 px-3 py-3.5 sm:px-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{fileIcon(file)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.originalName}</p><p className="mt-1 text-xs text-muted-foreground">{file.mimeType} · {file.sizeLabel} · {file.downloadCount.toLocaleString('vi-VN')} lượt tải</p></div>
            <div className="flex items-center gap-2">
              {file.mimeType.startsWith('image/') && !needsLogin ? <button type="button" onClick={() => setImagePreview({ src: imageViewUrl(file.id), alt: file.originalName })} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MediaImage src={imageViewUrl(file.id)} alt="" className="h-5 w-5 rounded object-cover" /><ImageIcon className="h-3.5 w-3.5" aria-hidden /> Xem ảnh</button> : null}
              {file.mimeType.startsWith('image/') && needsLogin ? <a href={loginHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"><LockKeyhole className="h-3.5 w-3.5" aria-hidden />Đăng nhập để xem</a> : null}
              {resource.showSource && file.previewable ? <button type="button" disabled={previewing === file.id} onClick={() => void openPreview(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"><Code2 className="h-3.5 w-3.5" aria-hidden />{needsLogin ? 'Đăng nhập để xem mã' : previewing === file.id ? 'Đang mở…' : 'Xem mã nguồn'}</button> : null}
              {resource.allowDownload ? needsLogin ? <a href={loginHref} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110"><Download className="h-3.5 w-3.5" aria-hidden />Đăng nhập để tải</a> : <button type="button" onClick={() => void downloadFile(file.id, file.originalName)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110"><Download className="h-3.5 w-3.5" aria-hidden />Tải file</button> : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden />Chỉ xem</span>}
            </div>
          </div>
        ))}
      </div>
      {resource.currentVersion.changelog ? <p className="mt-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Changelog:</strong> {resource.currentVersion.changelog}</p> : null}
      {preview ? <ResourcePreviewModal preview={preview} onClose={() => setPreview(null)} onDownload={() => void downloadFile(preview.fileId, preview.filename)} /> : null}
      {imagePreview ? <ImageLightbox images={[imagePreview]} onClose={() => setImagePreview(null)} /> : null}
      {resource.versions?.length ? <ResourceVersionHistory versions={resource.versions} currentVersionId={resource.currentVersion.id} /> : null}
    </section>
  );
}

function ResourceVersionHistory({ versions, currentVersionId }: { versions: NonNullable<PostResource['versions']>; currentVersionId: string }) {
  return (
    <div className="mt-5 border-t border-brand/15 pt-5" aria-labelledby="resource-version-history-title">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-brand" aria-hidden />
        <h3 id="resource-version-history-title" className="text-sm font-bold">{'L\u1ecbch s\u1eed phi\u00ean b\u1ea3n'}</h3>
      </div>
      <ol className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {versions.map((version) => {
          const downloadCount = version.files.reduce((sum, file) => sum + file.downloadCount, 0);
          const publishedDate = version.publishedAt
            ? new Date(version.publishedAt).toLocaleDateString('vi-VN')
            : '\u0043h\u01b0a ph\u00e1t h\u00e0nh';
          return (
            <li key={version.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 inline-flex min-w-16 items-center justify-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold">v{version.version}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span>{version.id === currentVersionId ? 'Phi\u00ean b\u1ea3n hi\u1ec7n t\u1ea1i' : 'Phi\u00ean b\u1ea3n \u0111\u00e3 ph\u00e1t h\u00e0nh'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{publishedDate}</span>
                </div>
                {version.changelog ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{version.changelog}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{version.files.length} file · {downloadCount.toLocaleString('vi-VN')} {'l\u01b0\u1ee3t t\u1ea3i'}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResourcePreviewModal({ preview, onClose, onDownload }: { preview: ResourcePreview; onClose: () => void; onDownload: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`Xem mã ${preview.filename}`}>
      <button type="button" onClick={onClose} aria-label="Đóng preview" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-5 w-5" aria-hidden /></button>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11141a] text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><h2 className="text-sm font-bold">{preview.filename}</h2><p className="mt-1 text-xs text-white/55">{preview.mimeType} · SHA-256 {preview.sha256}</p></div><button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/10"><Download className="h-3.5 w-3.5" aria-hidden /> Tải file</button></div>
        <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-white/85">{preview.content}</pre>
      </div>
    </div>
  );
}
