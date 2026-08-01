'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotCategorySlug, LicenseType } from '@shared/types';
import { PlusCircle, Upload, X, CheckCircle } from 'lucide-react';

interface CreateBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBotModal({ isOpen, onClose }: CreateBotModalProps) {
  const { addNewBot } = useRole();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [categorySlug, setCategorySlug] = useState<BotCategorySlug>('game');
  const [description, setDescription] = useState('');
  const [hourly, setHourly] = useState<number>(5000);
  const [daily, setDaily] = useState<number>(30000);
  const [monthly, setMonthly] = useState<number>(350000);
  const [licenseType, setLicenseType] = useState<LicenseType>('key');
  const [features, setFeatures] = useState<string>('Auto cày cấp 24/7\nThông báo Telegram\nHỗ trợ đa tài khoản');
  const [coverImage, setCoverImage] = useState<string>('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addNewBot({
      title,
      tagline: tagline || 'Giải pháp tự động hóa thông minh',
      description,
      categorySlug,
      categoryName:
        categorySlug === 'messenger'
          ? 'Bot Facebook Messenger'
          : categorySlug === 'telegram'
          ? 'Bot Telegram'
          : categorySlug === 'discord'
          ? 'Bot Discord'
          : categorySlug === 'zalo'
          ? 'Bot Zalo OA & Zalo cá nhân'
          : 'Bot Instagram Direct (DM)',
      pricing: { hourly, daily, monthly },
      licenseType,
      features: features.split('\n').filter((f) => f.trim().length > 0),
      coverImage
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Đăng Bot Mới Cho Thuê</h2>
            <p className="text-xs text-zinc-400">Kiếm thu nhập thụ động từ sản phẩm tự động hóa của bạn</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Tên Bot / Phần Mềm *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Auto Võ Lâm Truyền Kỳ HNX 2026"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Danh Mục Bot *</label>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value as BotCategorySlug)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
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
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Khẩu hiệu ngắn (Tagline)</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="VD: Treo máy 24/7, tự né PK và làm nhiệm vụ dã tẩu"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Mô tả chi tiết tính năng & hướng dẫn</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Viết mô tả cách dùng, yêu cầu cấu hình..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Pricing settings */}
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 space-y-3">
            <span className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">Cấu hình giá cho thuê (VNĐ)</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Giá Giờ (VNĐ)</label>
                <input
                  type="number"
                  value={hourly}
                  onChange={(e) => setHourly(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Giá Ngày (VNĐ)</label>
                <input
                  type="number"
                  value={daily}
                  onChange={(e) => setDaily(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Giá Tháng (VNĐ)</label>
                <input
                  type="number"
                  value={monthly}
                  onChange={(e) => setMonthly(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Hình thức cấp phép (License)</label>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value as LicenseType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="key">Mã License Key (Nhập vào phần mềm)</option>
                <option value="web_portal">Trang Web Portal (Đăng nhập Cloud)</option>
                <option value="api_access">REST API Token (Cho Developer)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Link Ảnh Bìa Demo</label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Các tính năng nổi bật (Mỗi dòng 1 ý)</label>
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm hover:text-white"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95"
            >
              Đăng Bot Ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
