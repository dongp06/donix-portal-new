'use client';

import Link from 'next/link';
import { ArrowRight, Download, FileCode2, Layers3 } from 'lucide-react';
import type { PostResource } from '@shared/types';
import { ResourceFiles } from './ResourceFiles';
import { MediaImage } from '@/components/media/MediaImage';

export type ResourceListItem = PostResource & {
  postSlug: string;
  postTitle: string;
  postExcerpt: string;
  postCoverImage?: string | null;
  authorName: string;
  authorAvatar: string;
  publishedAt?: string | null;
};

function totalDownloads(resource: PostResource): number {
  return resource.currentVersion.files.reduce((sum, file) => sum + file.downloadCount, 0);
}

export function ResourceHub({ resources }: { resources: ResourceListItem[] }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="eyebrow">Official Resource Hub</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Tài nguyên cho bot &amp; automation</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Source code, template và tài liệu được phát hành trực tiếp bởi thuebot.org. Chỉ tải những gì bạn hiểu và kiểm tra trước khi chạy.</p>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/5 px-3 py-2 text-xs font-semibold text-brand"><FileCode2 className="h-4 w-4" aria-hidden /> Owner-published</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"><Layers3 className="h-4 w-4" aria-hidden /> {resources.length} resource</span>
        </div>
        {resources.length ? <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div> : <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Chưa có tài nguyên nào được phát hành.</div>}
      </div>
    </main>
  );
}

function ResourceCard({ resource }: { resource: ResourceListItem }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-brand/40">
      <div className="flex h-32 items-center justify-center bg-muted/60 text-brand">{resource.postCoverImage ? <MediaImage src={resource.postCoverImage} fallbackSrc="/logo.svg" alt="" className="h-full w-full object-cover" /> : <FileCode2 className="h-10 w-10" aria-hidden />}</div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="font-semibold text-brand">thuebot.org ✓</span><span>v{resource.currentVersion.version}</span></div>
        <h2 className="mt-3 line-clamp-2 text-lg font-bold transition-colors group-hover:text-brand">{resource.title}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{resource.description || resource.postExcerpt}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-2.5 py-1">{resource.currentVersion.files.length} files</span><span className="rounded-full bg-muted px-2.5 py-1">{resource.license}</span><span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" aria-hidden />{totalDownloads(resource).toLocaleString('vi-VN')}</span></div>
        <Link href={`/resources/${encodeURIComponent(resource.id)}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Xem tài nguyên <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </div>
    </article>
  );
}

export function ResourceDetail({ resource }: { resource: ResourceListItem }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Link href="/resources" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Tất cả tài nguyên</Link>
        <article className="mt-7">
          <div className="rounded-3xl border border-brand/25 bg-brand/[0.035] p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand"><FileCode2 className="h-4 w-4" aria-hidden /> Official Resource · thuebot.org</div>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-5xl">{resource.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{resource.description || resource.postExcerpt}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-3 py-1.5">v{resource.currentVersion.version}</span><span className="rounded-full bg-muted px-3 py-1.5">{resource.license}</span><span className="rounded-full bg-muted px-3 py-1.5">{resource.currentVersion.files.length} files</span></div>
          </div>
          <ResourceFiles resource={resource} />
        </article>
      </div>
    </main>
  );
}
