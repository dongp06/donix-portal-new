'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '../../context/RoleContext';
import { CreateBotModal } from '../../components/modals/CreateBotModal';
import { ProfileTab } from '../../components/dashboard/ProfileTab';
import { TrustTab } from '../../components/dashboard/TrustTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Loader2, Plus, Building2, Eye, Pencil, Bot, UserRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getBotPriceDisplay } from '@/lib/bot-pricing';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { MediaImage } from '@/components/media/MediaImage';

function DashboardAuthLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground" aria-busy="true">
      <div className="flex w-full max-w-sm flex-col items-center text-center" role="status" aria-live="polite">
        <ThuebotLogo size="lg" />
        <div className="mt-8 flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
          Đang mở bảng điều khiển…
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Đang kiểm tra phiên đăng nhập của bạn.</p>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const { bots, user, authStatus, onboardingCompleted } = useRole();
  const [isCreateBotOpen, setIsCreateBotOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bots' | 'profile' | 'trust'>('bots');
  const router = useRouter();

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'profile' || requestedTab === 'trust' || requestedTab === 'bots') {
      setActiveTab(requestedTab);
    }
  }, []);

  // Chỉ seller mới được vào trang quản lý đăng bot
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.replace('/login?returnTo=%2Fdashboard');
      return;
    }
    if (!onboardingCompleted) {
      router.replace('/onboarding/account-type?returnTo=%2Fdashboard');
      return;
    }
    if (user.role !== 'seller') router.replace('/become-seller');
  }, [authStatus, onboardingCompleted, router, user.role]);

  if (authStatus === 'loading') return <DashboardAuthLoading />;
  if (authStatus !== 'authenticated' || user.role !== 'seller') return null;

  // Bot của người bán hiện tại
  const myBots = bots.filter((b) => b.seller.id === user.id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Trang quản lý seller</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Quản lý cửa hàng
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Quản lý bot đang bán, cập nhật hồ sơ shop và theo dõi điểm uy tín của bạn.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateBotOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Đăng bot mới
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'bots' | 'profile' | 'trust')} className="w-full">
          <TabsList
            aria-label="Khu vực quản lý"
            className="inline-flex h-auto w-full justify-start gap-1 rounded-xl bg-muted p-1 sm:w-auto"
          >
            <TabsTrigger value="bots" className="gap-1.5">
              <Bot className="h-4 w-4" aria-hidden />
              Bot của tôi
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5">
              <UserRound className="h-4 w-4" aria-hidden />
              Hồ sơ
            </TabsTrigger>
            <TabsTrigger value="trust" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Uy tín
            </TabsTrigger>
          </TabsList>

          {/* Tab: Bot của tôi */}
          <TabsContent value="bots" className="space-y-8 pt-6">
            {/* Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Bot đang đăng', value: `${myBots.length}` },
                {
                  label: 'Đánh giá trung bình',
                  value: myBots.length
                    ? (myBots.reduce((s, b) => s + b.rating, 0) / myBots.length).toFixed(1)
                    : '—',
                },
                {
                  label: 'Tổng lượt đánh giá',
                  value: myBots.reduce((s, b) => s + b.reviewCount, 0).toLocaleString('vi-VN'),
                },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
                  <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
                  <div className="mt-1 font-display text-2xl font-bold tracking-tight">{s.value}</div>
                </div>
              ))}
            </div>

            {/* My listings */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <Building2 className="h-5 w-5 text-brand" aria-hidden />
                Danh sách bot đã đăng
              </h2>

              {myBots.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-4">Tên bot / phần mềm</th>
                        <th className="p-4">Danh mục</th>
                        <th className="p-4">Giá hiển thị</th>
                        <th className="p-4">Trạng thái</th>
                        <th className="p-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {myBots.map((b) => (
                        <tr key={b.id} className="transition-colors hover:bg-muted/40">
                          <td className="p-4 font-semibold">
                            <div className="flex items-center gap-3">
                              <MediaImage src={b.coverImage} alt={b.title} className="h-10 w-10 rounded-lg object-cover" />
                              <span className="line-clamp-1">{b.title}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{b.categoryName}</td>
                          <td className="p-4 font-medium">{getBotPriceDisplay(b.pricing)}</td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                b.status === 'online'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                  : b.status === 'maintenance'
                                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                                    : 'border-border bg-muted text-muted-foreground'
                              }`}
                            >
                              {b.status === 'online'
                                ? 'Đang chạy'
                                : b.status === 'maintenance'
                                  ? 'Bảo trì'
                                  : 'Tạm ẩn'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/bots/${b.slug}`}
                                className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                                aria-label={`Xem ${b.title}`}
                              >
                                <Eye className="h-4 w-4" aria-hidden />
                              </Link>
                              <button
                                type="button"
                                onClick={() => toast.success(`Đã mở chỉnh sửa ${b.title}`)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Sửa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Bạn chưa đăng bot nào. Đăng bot đầu tiên để tiếp cận người mua.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreateBotOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Đăng bot mới
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Hồ sơ */}
          <TabsContent value="profile" className="pt-6">
            <ProfileTab />
          </TabsContent>

          {/* Tab: Uy tín */}
          <TabsContent value="trust" className="pt-6">
            <TrustTab />
          </TabsContent>
        </Tabs>
      </div>

      <CreateBotModal isOpen={isCreateBotOpen} onClose={() => setIsCreateBotOpen(false)} />
    </div>
  );
}
