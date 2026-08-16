'use client';

import React, { useRef, useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotCategorySlug } from '@shared/types';
import { Plus, X, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBotModal({ isOpen, onClose }: CreateBotModalProps) {
  const { addNewBot } = useRole();
  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState<BotCategorySlug>('messenger');
  const [description, setDescription] = useState('');
  const [priceUnit, setPriceUnit] = useState<'hourly' | 'daily' | 'monthly'>('daily');
  const [price, setPrice] = useState<number>(30000);
  // Liên hệ
  const [zalo, setZalo] = useState('');
  const [telegram, setTelegram] = useState('');
  const [phone, setPhone] = useState('');
  const [messenger, setMessenger] = useState('');
  const [facebook, setFacebook] = useState('');
  // Ảnh
  const [thumbnail, setThumbnail] = useState<string>('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [uploading, setUploading] = useState<{ type: 'thumb' | 'gallery'; idx?: number } | null>(null);
  const [features, setFeatures] = useState<string>(
    'Auto cày cấp 24/7\nThông báo Telegram\nHỗ trợ đa tài khoản',
  );

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  async function uploadFile(
    file: File,
    type: 'thumb' | 'gallery',
    idx?: number,
  ): Promise<string> {
    setUploading({ type, idx });
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body,
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.fileId) {
        throw new Error(json.error || 'Upload thất bại');
      }
      return `/api/files/${json.data.fileId}`;
    } finally {
      setUploading(null);
    }
  }

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Thumbnail phải là ảnh');
      return;
    }
    try {
      const url = await uploadFile(file, 'thumb');
      setThumbnail(url);
      toast.success('Đã tải thumbnail');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload thumbnail thất bại');
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      toast.error('Chỉ chấp nhận file ảnh');
      return;
    }
    try {
      for (const file of images) {
        const url = await uploadFile(file, 'gallery');
        setGallery((prev) => [...prev, url]);
      }
      toast.success(`Đã tải ${images.length} ảnh`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload ảnh thất bại');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!zalo.trim() && !telegram.trim() && !phone.trim() && !messenger.trim() && !facebook.trim()) {
      toast.error('Vui lòng nhập ít nhất 1 phương thức liên hệ');
      return;
    }

    try {
      await addNewBot(
        {
          title,
          description,
          categorySlug,
          categoryName: catName,
          pricing: {
            hourly: priceUnit === 'hourly' ? price : 0,
            daily: priceUnit === 'daily' ? price : 0,
            monthly: priceUnit === 'monthly' ? price : 0,
          },
          coverImage: thumbnail,
          gallery,
          features: features.split('\n').filter((f) => f.trim().length > 0),
        },
        { zalo, telegram, phone, messenger, facebook },
      );

      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setPriceUnit('daily');
      setPrice(30000);
      setZalo('');
      setTelegram('');
      setPhone('');
      setMessenger('');
      setFacebook('');
      setThumbnail('');
      setGallery([]);
      setFeatures('Auto cày cấp 24/7\nThông báo Telegram\nHỗ trợ đa tài khoản');
    } catch (err) {
      // Đăng không thành công (vd: 403 do không phải người bán) — giữ modal, hiện lỗi
      toast.error(err instanceof Error ? err.message : 'Đăng bot thất bại');
    }
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';
  const labelClass = 'mb-1 block text-xs font-semibold text-muted-foreground';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Đăng bot mới"
    >
      <div className="relative my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
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
            <h2 className="font-display text-xl font-bold">Đăng bot mới</h2>
            <p className="text-xs text-muted-foreground">
              Đăng bán sản phẩm tự động hóa của bạn, người mua liên hệ trực tiếp
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
              Giá tham khảo (VNĐ)
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="price-unit" className="mb-1 block text-[11px] text-muted-foreground">
                  Đơn vị giá
                </label>
                <select
                  id="price-unit"
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as 'hourly' | 'daily' | 'monthly')}
                  className={inputClass}
                >
                  <option value="hourly">Theo giờ</option>
                  <option value="daily">Theo ngày</option>
                  <option value="monthly">Theo tháng</option>
                </select>
              </div>
              <div>
                <label htmlFor="price" className="mb-1 block text-[11px] text-muted-foreground">
                  Giá
                </label>
                <input
                  id="price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {priceUnit === 'hourly'
                ? 'Giá mỗi giờ'
                : priceUnit === 'daily'
                  ? 'Giá mỗi ngày'
                  : 'Giá mỗi tháng'}{' '}
              — giá chỉ mang tính tham khảo, người mua liên hệ trực tiếp để chốt.
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <span className="block text-xs font-bold uppercase tracking-wide text-brand">
              Phương thức liên hệ
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="contact-zalo" className="mb-1 block text-[11px] text-muted-foreground">
                  Zalo
                </label>
                <input
                  id="contact-zalo"
                  type="text"
                  value={zalo}
                  onChange={(e) => setZalo(e.target.value)}
                  placeholder="SĐT hoặc ID Zalo"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-telegram" className="mb-1 block text-[11px] text-muted-foreground">
                  Telegram
                </label>
                <input
                  id="contact-telegram"
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@username"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="mb-1 block text-[11px] text-muted-foreground">
                  Số điện thoại
                </label>
                <input
                  id="contact-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0987 654 321"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-messenger" className="mb-1 block text-[11px] text-muted-foreground">
                  Messenger
                </label>
                <input
                  id="contact-messenger"
                  type="text"
                  value={messenger}
                  onChange={(e) => setMessenger(e.target.value)}
                  placeholder="Link hoặc ID Messenger"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-facebook" className="mb-1 block text-[11px] text-muted-foreground">
                  Facebook
                </label>
                <input
                  id="contact-facebook"
                  type="text"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Link hoặc ID Facebook"
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nhập ít nhất 1 kênh — người thuê sẽ liên hệ qua kênh bạn cung cấp.
            </p>
          </div>

          {/* Images */}
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <span className="block text-xs font-bold uppercase tracking-wide text-brand">
              Hình ảnh
            </span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Thumbnail */}
              <div>
                <label className={labelClass}>Thumbnail (ảnh bìa)</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleThumbUpload(e)}
                  />
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={uploading?.type === 'thumb'}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  >
                    {uploading?.type === 'thumb' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="h-4 w-4" aria-hidden />
                    )}
                    Tải ảnh lên
                  </button>
                </div>
                {thumbnail && (
                  <div className="relative mt-2 w-fit">
                    <img
                      src={thumbnail}
                      alt="Thumbnail"
                      className="h-20 w-32 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setThumbnail('')}
                      className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow hover:text-red-500"
                      aria-label="Xóa thumbnail"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Gallery */}
              <div>
                <label className={labelClass}>Thư viện ảnh demo (nhiều ảnh)</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleGalleryUpload(e)}
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploading?.type === 'gallery'}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  >
                    {uploading?.type === 'gallery' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="h-4 w-4" aria-hidden />
                    )}
                    Tải ảnh lên
                  </button>
                </div>
                {gallery.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gallery.map((img, i) => (
                      <div key={`${img}-${i}`} className="relative">
                        <img
                          src={img}
                          alt={`Ảnh demo ${i + 1}`}
                          className="h-14 w-20 rounded-lg border border-border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setGallery((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow hover:text-red-500"
                          aria-label="Xóa ảnh"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              disabled={uploading !== null}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Đang tải ảnh…' : 'Đăng bot ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
