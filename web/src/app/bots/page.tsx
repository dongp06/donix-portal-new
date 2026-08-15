'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotItem, BotCategorySlug } from '@shared/types';
import { BotCard } from '../../components/bot/BotCard';
import { RentalModal } from '../../components/modals/RentalModal';
import { DepositModal } from '../../components/modals/DepositModal';
import { Search, ArrowUpDown } from 'lucide-react';

export default function BotsCatalogPage() {
  const { bots } = useRole();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [licenseFilter, setLicenseFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('popular');
  const [selectedBotForRent, setSelectedBotForRent] = useState<BotItem | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const categories = [
    { id: 'all', name: 'Tất cả danh mục' },
    { id: 'messenger', name: 'Facebook Messenger' },
    { id: 'telegram', name: 'Telegram Bot' },
    { id: 'discord', name: 'Discord Bot' },
    { id: 'zalo', name: 'Zalo OA & Personal' },
    { id: 'instagram', name: 'Instagram Direct (DM)' },
  ];

  const filteredBots = bots
    .filter((b) => {
      const matchCat = selectedCategory === 'all' || b.categorySlug === selectedCategory;
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchLicense = licenseFilter === 'all' || b.licenseType === licenseFilter;
      const matchSearch =
        !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.description.toLowerCase().includes(search.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchStatus && matchLicense && matchSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'popular') return b.totalRentals - a.totalRentals;
      if (sortOption === 'rating') return b.rating - a.rating;
      if (sortOption === 'price_asc') return a.pricing.daily - b.pricing.daily;
      if (sortOption === 'price_desc') return b.pricing.daily - a.pricing.daily;
      return 0;
    });

  const selectClass =
    'h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="eyebrow">Chợ bot tự động hóa</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Danh sách bot cho thuê ({filteredBots.length})
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Lựa chọn bot phù hợp cho công việc, game hoặc đầu tư. Thuê linh hoạt theo giờ, ngày, tháng.
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-8 space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, từ khóa..."
                aria-label="Tìm kiếm bot"
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={selectClass} aria-label="Lọc theo danh mục">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass} aria-label="Lọc theo trạng thái">
              <option value="all">Tất cả trạng thái</option>
              <option value="online">Đang trực tuyến</option>
              <option value="maintenance">Đang bảo trì</option>
              <option value="offline">Ngoại tuyến</option>
            </select>

            <select value={licenseFilter} onChange={(e) => setLicenseFilter(e.target.value)} className={selectClass} aria-label="Lọc theo kiểu license">
              <option value="all">Tất cả kiểu license</option>
              <option value="key">Mã License Key</option>
              <option value="web_portal">Web Cloud Portal</option>
              <option value="api_access">REST API Access</option>
            </select>

            <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className={selectClass} aria-label="Sắp xếp">
              <option value="popular">Nổi bật (nhiều lượt thuê)</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {filteredBots.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onRentClick={(b) => setSelectedBotForRent(b)} />
            ))}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-16 text-center">
            <ArrowUpDown className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Không tìm thấy bot thỏa mãn bộ lọc hiện tại.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setStatusFilter('all');
                setLicenseFilter('all');
              }}
              className="text-xs font-semibold text-brand underline"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      <RentalModal
        bot={selectedBotForRent}
        isOpen={!!selectedBotForRent}
        onClose={() => setSelectedBotForRent(null)}
        onOpenDeposit={() => setIsDepositOpen(true)}
      />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  );
}
