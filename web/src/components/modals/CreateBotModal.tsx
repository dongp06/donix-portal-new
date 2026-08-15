'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotCategorySlug } from '@shared/types';
import { Plus, X } from 'lucide-react';

interface CreateBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBotModal({ isOpen, onClose }: CreateBotModalProps) {
  const { addNewBot } = useRole();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [categorySlug, setCategorySlug] = useState<BotCategorySlug>('messenger');
  const [description, setDescription] = useState('');
  const [hourly, setHourly] = useState<number>(5000);
  const [daily, setDaily] = useState<number>(30000);
  const [monthly, setMonthly] = useState<number>(350000);
  const [licenseType] = useState<'key'>('key');
  const [contact, setContact] = useState<string>('');
  const [features, setFeatures] = useState<string>(
    'Auto cày cấp 24/7\nThông báo Telegram\nHỗ trợ đa tài khoản',
  );
  const [coverImage, setCoverImage] = useState<string>(
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const catName =
      categorySlug === 'messenger'
        ? 'Bot Facebook Messenger'
        : categorySlug === 'telegram'
          ? 'Bot Telegram'
          : categorySlug === 'discord'
            ? 'Bot Discord'
            : categorySlug === 'zalo'
              ? 'Bot Zalo OA & Zalo cá nhân'
              : 'Bot Instagram Direct (DM)';

    addNewBot(
      {
        title,
        tagline: tagline || 'Giải pháp tự động hóa thông minh',
        description,
        categorySlug,
        categoryName: catName,
        pricing: { hourly, daily, monthly },
        licenseType,
        features: features.split('\n').filter((f) => f.trim().length > 0),
        coverImage,
      },
      contact.trim() || undefined,
    );

    onClose();
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';
  const labelClass = 'mb-1 block text-xs font-semibold text-muted-foreground';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Đăng bot mới cho thuê"
    >
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand/10 p-3 text-brand">
            <Plus className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Đăng bot mới cho thuê</h2>
            <p className="text-xs text-muted-foreground">
              Kiếm thu nhập thụ động từ sản phẩm tự động hóa của bạn
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="bot-title" className={labelClass}>
                Tên bot / phần mềm *
              </label>
              <input
                id="bot-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Auto Võ Lâm Truyền Kỳ HNX 2026"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bot-category" className={labelClass}>
                Danh mục
              </label>
              <select
                id="bot-category"
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value as BotCategorySlug)}
                className={inputClass}
              >
                <option value="messenger">Bot Facebook Messenger</option>
                <option value="telegram">Bot Telegram</option>
                <option value="discord">Bot Discord</option>
                <option value="zalo">Bot Zalo OA & Zalo cá nhân</option>
                <option value="instagram">Bot Instagram Direct (DM)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="bot-tagline" className={labelClass}>
              Khẩu hiệu ngắn (tagline)
            </label>
            <input
              id="bot-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="VD: Treo máy 24/7, tự né PK và làm nhiệm vụ"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="bot-desc" className={labelClass}>
              Mô tả chi tiết tính năng & hướng dẫn
            </label>
            <textarea
              id="bot-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Viết mô tả cách dùng, yêu cầu cấu hình..."
              className={inputClass}
            />
          </div>

          {/* Pricing */}
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <span className="block text-xs font-bold uppercase tracking-wide text-brand">
              Cấu hình giá cho thuê (VNĐ)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="price-hourly" className="mb-1 block text-[11px] text-muted-foreground">
                  Giá giờ
                </label>
                <input
                  id="price-hourly"
                  type="number"
                  value={hourly}
                  onChange={(e) => setHourly(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="price-daily" className="mb-1 block text-[11px] text-muted-foreground">
                  Giá ngày
                </label>
                <input
                  id="price-daily"
                  type="number"
                  value={daily}
                  onChange={(e) => setDaily(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="price-monthly" className="mb-1 block text-[11px] text-muted-foreground">
                  Giá tháng
                </label>
                <input
                  id="price-monthly"
                  type="number"
                  value={monthly}
                  onChange={(e) => setMonthly(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="bot-contact" className={labelClass}>
                Liên hệ (Zalo / Telegram / SĐT)
              </label>
              <input
                id="bot-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="VD: 0987 654 321 hoặc @username"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bot-cover" className={labelClass}>
                Link ảnh bìa demo
              </label>
              <input
                id="bot-cover"
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bot-features" className={labelClass}>
              Các tính năng nổi bật (mỗi dòng 1 ý)
            </label>
            <textarea
              id="bot-features"
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
            >
              Đăng bot ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
