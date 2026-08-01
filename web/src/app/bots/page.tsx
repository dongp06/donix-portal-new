'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotItem, BotCategorySlug } from '@shared/types';
import { BotCard } from '../../components/bot/BotCard';
import { RentalModal } from '../../components/modals/RentalModal';
import { DepositModal } from '../../components/modals/DepositModal';
import { Search, Filter, Sparkles, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

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
    { id: 'instagram', name: 'Instagram Direct (DM)' }
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Title */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Chợ Bot Tự Động Hóa
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Danh Sách Bot Cho Thuê ({filteredBots.length})
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Lựa chọn bot tự động phù hợp cho công việc, game hoặc đầu tư tài chính. Thuê linh hoạt theo giờ, ngày, tháng.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bot theo tên, từ khóa..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* License Filter */}
            <select
              value={licenseFilter}
              onChange={(e) => setLicenseFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Tất cả kiểu License</option>
              <option value="key">Mã License Key</option>
              <option value="web_portal">Web Cloud Portal</option>
              <option value="api_access">REST API Access</option>
            </select>

            {/* Sort Option */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="popular">Nổi bật (Lượt thuê nhiều nhất)</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
            </select>
          </div>
        </div>

        {/* Bot Grid */}
        {filteredBots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onRentClick={(b) => setSelectedBotForRent(b)} />
            ))}
          </div>
        ) : (
          <div className="p-16 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
            <p className="text-zinc-400 text-sm">Không tìm thấy bot thỏa mãn bộ lọc hiện tại.</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setStatusFilter('all');
                setLicenseFilter('all');
              }}
              className="text-xs font-semibold text-cyan-400 underline"
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
