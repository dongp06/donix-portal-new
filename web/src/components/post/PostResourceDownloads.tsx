'use client';

import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PostAttachment } from '@shared/types';

export function PostResourceDownloads({ attachments }: { attachments: PostAttachment[] }) {
  if (!attachments?.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground border-l-4 border-brand pl-3">
        Files tải về
      </h2>
      <div className="grid gap-3 sm:grid-cols-1">
        {attachments.map((a) => (
          <Card
            key={a.id}
            className="border-border bg-card/80 overflow-hidden"
          >
            <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {a.filename}
                    <span className="text-muted-foreground font-normal text-sm">
                      {' '}
                      [{a.sizeLabel}]
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Tài nguyên đính kèm bài viết</p>
                </div>
              </div>
              <Button
                asChild
                className="bg-brand text-brand-foreground hover:bg-brand/90 shrink-0 gap-2"
              >
                <a href={`/api/files/${a.fileId}`} download>
                  <Download className="h-4 w-4" />
                  Tải về
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
