'use client';

import React, { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { BotCategorySlug, BotContactInfo, BotStatus } from '@shared/types';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe2,
  GripVertical,
  ImagePlus,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from '../../context/RoleContext';
import { formatMonthlyPrice } from '../../lib/bot-pricing';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { attachmentReference } from '@/lib/media';
import { removeDraft, writeDraft } from '@/lib/draft-storage';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MediaImage } from '@/components/media/MediaImage';
import { ImageLightbox } from '@/components/media/ImageLightbox';

interface CreateBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;
type ContactKey = keyof BotContactInfo;

const DRAFT_KEY = 'thuebot:create-bot-draft:v4';

const CATEGORY_OPTIONS: { value: BotCategorySlug; label: string }[] = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'messenger', label: 'Facebook Messenger' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'ai', label: 'AI' },
  { value: 'automation', label: 'Automation' },
  { value: 'other', label: 'Khác' },
];

const AUDIENCE_OPTIONS = ['Cá nhân', 'Shop online', 'Agency', 'Community', 'Developer', 'Doanh nghiệp'];

const CONTACT_OPTIONS: { key: ContactKey; label: string; placeholder: string; icon: LucideIcon }[] = [
  { key: 'telegram', label: 'Telegram', placeholder: '@username', icon: Send },
  { key: 'zalo', label: 'Zalo', placeholder: 'Số điện thoại hoặc ID Zalo', icon: MessageCircle },
  { key: 'phone', label: 'Số điện thoại', placeholder: '0987 654 321', icon: Phone },
  { key: 'website', label: 'Website', placeholder: 'https://example.com', icon: Globe2 },
  { key: 'messenger', label: 'Messenger', placeholder: 'Link hoặc username', icon: MessageCircle },
  { key: 'facebook', label: 'Facebook', placeholder: 'Link hoặc username', icon: Globe2 },
];

const STATUS_OPTIONS: { value: BotStatus; label: string; description: string }[] = [
  { value: 'online', label: 'Đang hoạt động', description: 'Sẵn sàng nhận khách' },
  { value: 'maintenance', label: 'Đang bảo trì', description: 'Tạm thời vẫn hiển thị listing' },
  { value: 'offline', label: 'Tạm ngừng', description: 'Chưa nhận liên hệ mới' },
];

function categoryLabel(category: BotCategorySlug): string {
  return CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? 'Bot tự động hóa';
}

function parseTags(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function formatPriceInput(value: string): string {
  if (!value) return '';
  const number = Number(value);
  return Number.isSafeInteger(number) ? number.toLocaleString('vi-VN') : value;
}

export function CreateBotModal({ isOpen, onClose }: CreateBotModalProps) {
  const { addNewBot, user } = useRole();
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState<BotCategorySlug>('telegram');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [featureDraft, setFeatureDraft] = useState('');
  const [monthlyPriceInput, setMonthlyPriceInput] = useState('');
  const [pricingDescription, setPricingDescription] = useState('');
  const [pricingImages, setPricingImages] = useState<string[]>([]);
  const [sellerContact, setSellerContact] = useState<BotContactInfo>({});
  const [profileContactLoading, setProfileContactLoading] = useState(false);
  const [profileContactError, setProfileContactError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [audience, setAudience] = useState<string[]>([]);
  const [status, setStatus] = useState<BotStatus>('online');
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<{ images: string[]; index: number; altPrefix: string } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pricingImagesInputRef = useRef<HTMLInputElement>(null);

  const selectedCategoryName = useMemo(() => categoryLabel(categorySlug), [categorySlug]);
  const profileContactEntries = useMemo(
    () => CONTACT_OPTIONS.flatMap((item) => {
      const value = sellerContact[item.key]?.trim();
      return value ? [{ ...item, value }] : [];
    }),
    [sellerContact],
  );
  const hasSellerContact = profileContactEntries.length > 0;
  const monthlyPrice = Number(monthlyPriceInput || 0);

  const resetForm = () => {
    setStep(1);
    setTitle('');
    setCategorySlug('telegram');
    setTagline('');
    setDescription('');
    setTagsText('');
    setLogoUrl('');
    setGallery([]);
    setFeatures([]);
    setFeatureDraft('');
    setMonthlyPriceInput('');
    setPricingDescription('');
    setPricingImages([]);
    setSellerContact({});
    setProfileContactError(null);
    setSubmitError(null);
    setAudience([]);
    setStatus('online');
    setUploading(null);
    setSubmitting(false);
    setDragIndex(null);
    setImagePreview(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Record<string, unknown>>;
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.categorySlug === 'string') setCategorySlug(draft.categorySlug as BotCategorySlug);
      if (typeof draft.tagline === 'string') setTagline(draft.tagline);
      if (typeof draft.description === 'string') setDescription(draft.description);
      if (typeof draft.tagsText === 'string') setTagsText(draft.tagsText);
      if (typeof draft.logoUrl === 'string') setLogoUrl(draft.logoUrl);
      if (Array.isArray(draft.gallery)) setGallery(draft.gallery.filter((item): item is string => typeof item === 'string'));
      if (Array.isArray(draft.features)) setFeatures(draft.features.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.monthlyPriceInput === 'string') setMonthlyPriceInput(normalizeDigits(draft.monthlyPriceInput));
      if (typeof draft.pricingDescription === 'string') setPricingDescription(draft.pricingDescription);
      if (Array.isArray(draft.pricingImages)) setPricingImages(draft.pricingImages.filter((item): item is string => typeof item === 'string').slice(0, 5));
      if (Array.isArray(draft.audience)) setAudience(draft.audience.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.status === 'string') setStatus(draft.status as BotStatus);
    } catch {
      removeDraft(DRAFT_KEY);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setSellerContact(user.contact ?? {});
    setProfileContactError(null);
    setProfileContactLoading(true);

    void fetchWithTimeout('/api/sellers/me/profile', { credentials: 'include', cache: 'no-store' }, 15_000)
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || json?.message || 'Không thể tải thông tin liên hệ của hồ sơ seller.');
        }
        if (!cancelled) {
          setSellerContact((json.data?.contact ?? {}) as BotContactInfo);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileContactError(error instanceof Error ? error.message : 'Không thể tải thông tin liên hệ của hồ sơ seller.');
        }
      })
      .finally(() => {
        if (!cancelled) setProfileContactLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user.id, user.contact]);

  if (!isOpen) return null;

  const inputClass = 'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/25';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-foreground';
  const helpClass = 'mt-1.5 text-xs leading-relaxed text-muted-foreground';

  const saveDraft = () => {
    try {
      writeDraft(DRAFT_KEY, {
        title,
        categorySlug,
        tagline,
        description,
        tagsText,
        logoUrl,
        gallery,
        features,
        monthlyPriceInput,
        pricingDescription,
        pricingImages,
        audience,
        status,
      });
      toast.success('Đã lưu bản nháp trên thiết bị này');
    } catch {
      toast.error('Không thể lưu bản nháp trên thiết bị. Nội dung hiện tại vẫn được giữ lại.');
    }
  };

  const uploadFile = async (file: File, purpose: string): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Chỉ chấp nhận file hình ảnh.');
    const maxBytes = purpose === 'pricing' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) throw new Error(`Ảnh ${purpose === 'pricing' ? 'bảng giá' : ''} phải nhỏ hơn ${purpose === 'pricing' ? '5' : '10'}MB.`);
    setUploading(purpose);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('usage', purpose === 'logo' ? 'bot_logo' : purpose === 'gallery' ? 'bot_demo' : 'pricing_image');
      const res = await fetchWithTimeout('/api/uploads/images', { method: 'POST', body, credentials: 'include' });
      const json = await res.json().catch(() => null) as { success?: boolean; error?: string; data?: { attachmentId?: string } } | null;
      if (!res.ok || !json?.success || !json.data?.attachmentId) throw new Error(json?.error || 'Upload thất bại');
      const reference = attachmentReference(json.data.attachmentId);
      if (!reference) throw new Error('Attachment ID không hợp lệ.');
      return reference;
    } finally {
      setUploading(null);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setLogoUrl(await uploadFile(file, 'logo'));
      toast.success('Đã tải ảnh đại diện bot');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload ảnh thất bại');
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    const remaining = Math.max(0, 8 - gallery.length);
    if (!files.length) return toast.error('Chọn ít nhất một file ảnh.');
    if (remaining === 0) return toast.error('Ảnh demo tối đa 8 ảnh.');
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, remaining)) urls.push(await uploadFile(file, 'gallery'));
      setGallery((current) => [...current, ...urls]);
      toast.success(`Đã tải ${urls.length} ảnh demo`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload ảnh demo thất bại');
    }
  };

  const handlePricingImagesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    const remaining = Math.max(0, 5 - pricingImages.length);
    if (!files.length) return toast.error('Chọn ít nhất một file ảnh.');
    if (remaining === 0) return toast.error('Ảnh bảng giá tối đa 5 ảnh.');
    const tooLarge = files.slice(0, remaining).find((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) return toast.error('Mỗi ảnh bảng giá phải nhỏ hơn 5MB.');
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, remaining)) urls.push(await uploadFile(file, 'pricing'));
      setPricingImages((current) => [...current, ...urls]);
      toast.success(`Đã tải ${urls.length} ảnh bảng giá`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload bảng giá thất bại');
    }
  };

  const addFeature = () => {
    const value = featureDraft.trim();
    if (!value) return;
    if (features.some((feature) => feature.toLowerCase() === value.toLowerCase())) return setFeatureDraft('');
    if (features.length >= 12) return toast.error('Tối đa 12 tính năng nổi bật.');
    setFeatures((current) => [...current, value]);
    setFeatureDraft('');
  };

  const handleFeatureKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addFeature();
    }
  };

  const getPricingPayload = () => ({
    monthlyPrice,
    pricingDescription: pricingDescription.trim(),
    pricingImages,
  });

  const validateStep = (target: Step): boolean => {
    const fail = (message: string): false => {
      if (target === 3) setSubmitError(message);
      toast.error(message);
      return false;
    };

    if (target === 1) {
      if (title.trim().length < 3) return fail('Tên bot cần ít nhất 3 ký tự.');
      if (!tagline.trim()) return fail('Hãy thêm mô tả ngắn cho listing.');
      if (tagline.trim().length > 160) return fail('Mô tả ngắn tối đa 160 ký tự.');
      if (!logoUrl) return fail('Ảnh đại diện bot / logo bot là bắt buộc.');
    }
    if (target === 2) {
      if (gallery.length < 2) return fail('Tải ít nhất 2 ảnh demo bot.');
      if (features.length < 3) return fail('Thêm ít nhất 3 tính năng nổi bật.');
    }
    if (target === 3) {
      if (profileContactLoading) return fail('Đang kiểm tra thông tin liên hệ trong hồ sơ seller.');
      if (!hasSellerContact) return fail('Bạn cần thêm ít nhất một phương thức liên hệ vào hồ sơ seller trước khi đăng bot.');
      if (!Number.isInteger(monthlyPrice) || monthlyPrice <= 0) return fail('Nhập giá thuê cơ bản theo tháng hợp lệ.');
      if (monthlyPrice > 2_147_483_647) return fail('Giá thuê cơ bản vượt quá giới hạn cho phép.');
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => (current < 3 ? (current + 1) as Step : current));
  };

  const goBack = () => setStep((current) => (current > 1 ? (current - 1) as Step : current));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    if (!validateStep(3) || submitting) return;
    setSubmitting(true);
    try {
      await addNewBot(
        {
          title: title.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          categorySlug,
          categoryName: selectedCategoryName,
          coverImage: logoUrl,
          gallery,
          features,
          tags: parseTags(tagsText),
          targetAudience: audience,
          status,
          pricing: getPricingPayload(),
        },
      );
      removeDraft(DRAFT_KEY);
      toast.success('Đã đăng bot lên chợ thành công');
      resetForm();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng bot thất bại';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const moveGalleryItem = (from: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    setGallery((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleGalleryDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== targetIndex) moveGalleryItem(dragIndex, targetIndex);
    setDragIndex(null);
  };

  const renderStepOne = () => (
    <section className="space-y-6" aria-labelledby="create-step-one">
      <div>
        <p className="eyebrow">Bước 1 / 3</p>
        <h3 id="create-step-one" className="mt-2 font-display text-2xl font-bold">Thông tin cơ bản</h3>
        <p className="mt-1 text-sm text-muted-foreground">Bắt đầu bằng những thông tin người mua cần thấy ngay trên listing.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="bot-title" className={labelClass}>Tên bot *</label>
          <input id="bot-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="VD: Telegram Auto Post Pro" className={inputClass} />
          <p className={helpClass}>Tên ngắn, dễ nhớ và mô tả đúng sản phẩm.</p>
        </div>
        <div>
          <label htmlFor="bot-category" className={labelClass}>Danh mục *</label>
          <select id="bot-category" value={categorySlug} onChange={(event) => setCategorySlug(event.target.value as BotCategorySlug)} className={inputClass}>
            {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bot-tags" className={labelClass}>Tags</label>
          <input id="bot-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="auto-post, marketing, telegram" className={inputClass} />
          <p className={helpClass}>Phân cách bằng dấu phẩy, tối đa 12 tag.</p>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="bot-tagline" className={labelClass}>Mô tả ngắn *</label>
          <textarea id="bot-tagline" required rows={3} maxLength={160} value={tagline} onChange={(event) => setTagline(event.target.value)} placeholder="Tự động đăng bài Telegram theo lịch, hỗ trợ nhiều group và theo dõi trạng thái gửi." className={`${inputClass} resize-y`} />
          <p className={helpClass}>{tagline.length}/160 ký tự · Dùng trên card và kết quả tìm kiếm.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className={labelClass}>Ảnh đại diện bot / logo bot *</label>
            <p className={helpClass}>Ảnh vuông tối thiểu 512×512, dùng làm ảnh chính trên card và trang chi tiết.</p>
          </div>
          <ImagePlus className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Tải ảnh đại diện bot hoặc logo bot" onChange={(event) => void handleLogoUpload(event)} />
        <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploading === 'logo'} className="mt-4 flex min-h-28 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-60">
          {logoUrl ? <MediaImage src={logoUrl} alt="Logo bot đã chọn" className="h-24 w-24 rounded-xl object-cover" /> : <><ImagePlus className="h-6 w-6" aria-hidden /> Chọn ảnh đại diện</>}
          {uploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        </button>
      </div>
    </section>
  );

  const renderStepTwo = () => (
    <section className="space-y-6" aria-labelledby="create-step-two">
      <div>
        <p className="eyebrow">Bước 2 / 3</p>
        <h3 id="create-step-two" className="mt-2 font-display text-2xl font-bold">Media & tính năng</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cho người mua thấy bot hoạt động như thế nào trước khi họ liên hệ.</p>
      </div>
      <div className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className={labelClass}>Ảnh demo bot *</label>
            <p className={helpClass}>Tải ít nhất 2 ảnh, tối đa 8 ảnh. Ảnh đầu tiên sẽ là cover trong gallery chi tiết.</p>
          </div>
          <Upload className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" aria-label="Tải ảnh demo bot" onChange={(event) => void handleGalleryUpload(event)} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((image, index) => <div key={`${image}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleGalleryDrop(event, index)} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <button type="button" onClick={() => setImagePreview({ images: gallery, index, altPrefix: 'Ảnh demo bot' })} className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"><MediaImage src={image} alt={`Ảnh demo ${index + 1}`} className="h-full w-full object-cover" /></button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1.5 text-[11px] text-white"><span className="inline-flex items-center gap-1"><GripVertical className="h-3 w-3" aria-hidden />Ảnh {index + 1}</span><span>{index === 0 ? 'Cover' : 'Demo'}</span></div>
            <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" onClick={() => moveGalleryItem(index, index - 1)} disabled={index === 0} className="rounded-md bg-black/70 p-1 text-white disabled:opacity-30" aria-label="Đưa ảnh lên"><ChevronUp className="h-3.5 w-3.5" aria-hidden /></button>
              <button type="button" onClick={() => moveGalleryItem(index, index + 1)} disabled={index === gallery.length - 1} className="rounded-md bg-black/70 p-1 text-white disabled:opacity-30" aria-label="Đưa ảnh xuống"><ChevronDown className="h-3.5 w-3.5" aria-hidden /></button>
              <button type="button" onClick={() => setGallery((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md bg-black/70 p-1 text-white hover:bg-red-500" aria-label="Xóa ảnh"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          </div>)}
          {gallery.length < 8 ? <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"><Plus className="h-5 w-5" aria-hidden />Thêm ảnh</button> : null}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div><label htmlFor="bot-feature-draft" className={labelClass}>Tính năng nổi bật * <span className="font-normal text-muted-foreground">({features.length}/12)</span></label><p className={helpClass}>Thêm từng tính năng thành chip. Bắt buộc ít nhất 3 ý.</p></div>
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <div className="mt-4 flex gap-2"><input id="bot-feature-draft" value={featureDraft} onChange={(event) => setFeatureDraft(event.target.value)} onKeyDown={handleFeatureKeyDown} placeholder="VD: Auto post theo lịch" className={`${inputClass} flex-1`} /><button type="button" onClick={addFeature} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110"><Plus className="h-4 w-4" aria-hidden /> Thêm</button></div>
        <div className="mt-4 flex flex-wrap gap-2">{features.map((feature) => <span key={feature} className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-foreground">{feature}<button type="button" onClick={() => setFeatures((current) => current.filter((item) => item !== feature))} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-destructive" aria-label={`Xóa tính năng ${feature}`}><X className="h-3 w-3" aria-hidden /></button></span>)}</div>
      </div>
      <div>
        <label htmlFor="bot-description" className={labelClass}>Mô tả chi tiết & hướng dẫn sử dụng</label>
        <MarkdownEditor id="bot-description" value={description} onChange={setDescription} preset="bot-description" maxLength={20_000} minHeightClassName="min-h-[18rem]" />
        <p className={helpClass}>Có thể dùng Markdown đơn giản. Nội dung này sẽ hiển thị trong phần Tổng quan.</p>
      </div>
    </section>
  );

  const renderPricingEditorV2 = () => (
    <div className="space-y-5 rounded-2xl border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-bold">Giá & bảng giá</p><p className={helpClass}>Dùng Markdown + GFM để mô tả nhiều gói, add-on hoặc cách tính giá riêng. Preview dùng đúng renderer production.</p></div>
        <Sparkles className="h-5 w-5 text-brand" aria-hidden />
      </div>
      <div className="rounded-xl border border-brand/25 bg-brand/[0.04] p-4">
        <label htmlFor="monthly-price" className={labelClass}>Giá thuê cơ bản *</label>
        <div className="flex items-center gap-2">
          <input id="monthly-price" inputMode="numeric" value={formatPriceInput(monthlyPriceInput)} onChange={(event) => setMonthlyPriceInput(normalizeDigits(event.target.value))} placeholder="300.000" className={`${inputClass} text-lg font-semibold`} aria-describedby="monthly-price-help" />
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">VNĐ / tháng</span>
        </div>
        <p id="monthly-price-help" className={helpClass}>Đây là mức giá tham chiếu hiển thị trên card bot, kết quả tìm kiếm và compare.</p>
      </div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold">Bảng giá chi tiết <span className="font-normal text-muted-foreground">· Không bắt buộc</span></p><p className={helpClass}>Có thể thêm ảnh bảng giá song song với nội dung Markdown.</p></div><span className="text-xs text-muted-foreground">{pricingDescription.length}/20.000 ký tự · {pricingImages.length}/5 ảnh</span></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <MarkdownEditor id="pricing-description" value={pricingDescription} onChange={setPricingDescription} preset="pricing" maxLength={20_000} minHeightClassName="min-h-[20rem]" />
          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="flex items-start gap-3"><Upload className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><div><p className="text-sm font-semibold">Ảnh bảng giá</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">PNG, JPG hoặc WEBP · tối đa 5 ảnh · 5MB/ảnh.</p></div></div>
            <input ref={pricingImagesInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" aria-label="Tải ảnh bảng giá bổ sung" onChange={(event) => void handlePricingImagesUpload(event)} />
            <button type="button" onClick={() => pricingImagesInputRef.current?.click()} disabled={uploading === 'pricing' || pricingImages.length >= 5} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-brand/50 hover:text-brand disabled:opacity-50">{uploading === 'pricing' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} Thêm ảnh bảng giá</button>
            {pricingImages.length ? <div className="mt-3 grid grid-cols-2 gap-2">{pricingImages.map((image, index) => <div key={`${image}-${index}`} className="group relative aspect-video overflow-hidden rounded-lg border border-border"><button type="button" onClick={() => setImagePreview({ images: pricingImages, index, altPrefix: 'Bảng giá' })} className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"><MediaImage src={image} alt={`Bảng giá ${index + 1}`} className="h-full w-full object-cover" /></button><button type="button" onClick={() => setPricingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-red-500" aria-label={`Xóa ảnh bảng giá ${index + 1}`}><X className="h-3.5 w-3.5" aria-hidden /></button></div>)}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSellerContactSummary = () => (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Liên hệ người bán</p>
          <p className={helpClass}>Bot này sẽ sử dụng các phương thức liên hệ đã thiết lập trong hồ sơ nhà cung cấp.</p>
        </div>
        <MessageCircle className="h-5 w-5 text-brand" aria-hidden />
      </div>
      {profileContactLoading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Đang tải liên hệ từ hồ sơ seller…
        </p>
      ) : hasSellerContact ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {profileContactEntries.map(({ key, label, icon: Icon, value }) => (
              <span key={key} title={value} className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-foreground">
                <Icon className="h-3.5 w-3.5 text-brand" aria-hidden /> {label}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Thông tin này được lấy từ Seller Profile, không cần nhập lại cho từng bot.</p>
            <a href="/dashboard?tab=profile" className="text-xs font-semibold text-brand underline underline-offset-4 hover:brightness-90">Chỉnh sửa hồ sơ →</a>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <p className="font-semibold">Bạn chưa có phương thức liên hệ.</p>
          <p className="mt-1 text-xs leading-relaxed">Thêm ít nhất một kênh vào hồ sơ nhà cung cấp trước khi đăng bot.</p>
          <a href="/dashboard?tab=profile" className="mt-3 inline-flex font-semibold underline underline-offset-4">Thiết lập liên hệ →</a>
          {profileContactError ? <p className="mt-2 text-xs text-amber-800">{profileContactError}</p> : null}
        </div>
      )}
    </div>
  );

  const renderStepThree = () => (
    <section className="space-y-6" aria-labelledby="create-step-three">
      <div><p className="eyebrow">Bước 3 / 3</p><h3 id="create-step-three" className="mt-2 font-display text-2xl font-bold">Hoàn tất</h3><p className="mt-1 text-sm text-muted-foreground">Đặt mức giá tháng chuẩn, thêm bảng giá nếu cần và kiểm tra preview trước khi đăng.</p></div>
      {renderPricingEditorV2()}
      {renderSellerContactSummary()}
      {submitError ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert" aria-live="polite">{submitError}</div> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div><p className="mb-2 text-sm font-bold">Trạng thái bot</p><div className="space-y-2">{STATUS_OPTIONS.map((item) => <label key={item.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${status === item.value ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/40'}`}><input type="radio" name="bot-status" value={item.value} checked={status === item.value} onChange={() => setStatus(item.value)} className="mt-1 accent-[hsl(var(--brand))]" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span></span></label>)}</div></div>
        <div><p className="mb-2 text-sm font-bold">Phù hợp với</p><div className="flex flex-wrap gap-2">{AUDIENCE_OPTIONS.map((item) => { const selected = audience.includes(item); return <button key={item} type="button" onClick={() => setAudience((current) => selected ? current.filter((entry) => entry !== item) : [...current, item])} className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${selected ? 'border-brand bg-brand text-brand-foreground' : 'border-border text-muted-foreground hover:border-brand/45 hover:text-foreground'}`}>{item}</button>; })}</div><p className={helpClass}>Giúp người mua nhận ra bot có phù hợp với nhu cầu của họ không.</p></div>
      </div>
      <div className="rounded-2xl border border-[#1677FF]/25 bg-[#1677FF]/[0.04] p-5"><div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1677FF]"><Eye className="h-4 w-4" aria-hidden /> Preview listing</div><div className="flex gap-4"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">{logoUrl ? <button type="button" onClick={() => setImagePreview({ images: [logoUrl], index: 0, altPrefix: 'Logo bot' })} className="h-full w-full cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"><MediaImage src={logoUrl} alt="Preview logo" className="h-full w-full object-cover" /></button> : <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />}</div><div className="min-w-0"><p className="text-xs font-semibold text-brand">{selectedCategoryName}</p><h4 className="mt-1 truncate font-display text-lg font-bold">{title || 'Tên bot của bạn'}</h4><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tagline || 'Mô tả ngắn của bot sẽ hiển thị ở đây.'}</p><p className="mt-3 font-display text-base font-bold">{monthlyPrice > 0 ? `Từ ${formatMonthlyPrice(monthlyPrice)}` : 'Giá thuê từ / tháng'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{features.slice(0, 3).map((feature) => <span key={feature} className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{feature}</span>)}</div><p className="mt-4 text-xs text-muted-foreground">Seller: <strong className="text-foreground">{user.name}</strong> · Giao dịch diễn ra trực tiếp giữa hai bên.</p></div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="create-bot-title">
      <div className="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl">
        <header className="shrink-0 border-b border-border bg-card px-5 py-4 sm:px-7"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="rounded-xl bg-brand/10 p-2 text-brand"><Sparkles className="h-5 w-5" aria-hidden /></span><div><h2 id="create-bot-title" className="font-display text-xl font-bold">Đăng bot mới</h2><p className="mt-0.5 text-xs text-muted-foreground">Tạo listing để người mua xem, đánh giá và liên hệ trực tiếp.</p></div></div></div><div className="flex items-center gap-2"><button type="button" onClick={saveDraft} className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-brand/40 hover:text-foreground sm:inline-flex"><Check className="h-3.5 w-3.5" aria-hidden /> Lưu nháp</button><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đóng"><X className="h-5 w-5" aria-hidden /></button></div></div><div className="mt-5 grid grid-cols-3 gap-2" aria-label="Tiến trình đăng bot">{([1, 2, 3] as Step[]).map((item) => <div key={item} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${step === item ? 'bg-brand/10 text-brand' : step > item ? 'text-foreground' : 'text-muted-foreground'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${step > item ? 'bg-emerald-500 text-white' : step === item ? 'bg-brand text-brand-foreground' : 'bg-muted'}`}>{step > item ? <Check className="h-3.5 w-3.5" aria-hidden /> : item}</span><span className="hidden sm:inline">{item === 1 ? 'Cơ bản' : item === 2 ? 'Nội dung' : 'Hoàn tất'}</span></div>)}</div></header>
        <form id="create-bot-form" onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">{step === 1 ? renderStepOne() : null}{step === 2 ? renderStepTwo() : null}{step === 3 ? renderStepThree() : null}</form>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:px-7"><div className="text-xs text-muted-foreground">Bước {step}/3 <span className="hidden sm:inline">· Các trường * là bắt buộc</span></div><div className="flex items-center gap-2"><button type="button" onClick={saveDraft} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:border-brand/40 hover:text-foreground sm:hidden"><Check className="h-4 w-4" aria-hidden /> Lưu</button>{step > 1 ? <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại</button> : <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Hủy</button>}{step < 3 ? <button type="button" onClick={goNext} disabled={uploading !== null} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110 disabled:opacity-60">Tiếp tục <ArrowRight className="h-4 w-4" aria-hidden /></button> : <button form="create-bot-form" type="submit" disabled={uploading !== null || submitting || profileContactLoading} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110 disabled:opacity-60">{submitting || profileContactLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} {submitting ? 'Đang đăng...' : profileContactLoading ? 'Đang kiểm tra hồ sơ...' : 'Đăng bot ngay'}</button>}</div></footer>
      </div>
      {imagePreview ? <ImageLightbox images={imagePreview.images.map((src, index) => ({ src, alt: `${imagePreview.altPrefix} ${index + 1}` }))} initialIndex={imagePreview.index} onClose={() => setImagePreview(null)} /> : null}
    </div>
  );
}
