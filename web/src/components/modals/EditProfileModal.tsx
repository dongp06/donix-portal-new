'use client';

import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Send, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  bio: string;
  contact: {
    zalo?: string;
    telegram?: string;
    phone?: string;
    messenger?: string;
    facebook?: string;
  };
  onSave: (bio: string, contact: EditProfileModalProps['contact']) => Promise<void>;
}

/** Modal sửa hồ sơ seller: giới thiệu + 5 kênh liên hệ */
export function EditProfileModal({ isOpen, onClose, bio, contact, onSave }: EditProfileModalProps) {
  const [bioDraft, setBioDraft] = useState(bio);
  const [zalo, setZalo] = useState(contact.zalo ?? '');
  const [telegram, setTelegram] = useState(contact.telegram ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [messenger, setMessenger] = useState(contact.messenger ?? '');
  const [facebook, setFacebook] = useState(contact.facebook ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBioDraft(bio);
      setZalo(contact.zalo ?? '');
      setTelegram(contact.telegram ?? '');
      setPhone(contact.phone ?? '');
      setMessenger(contact.messenger ?? '');
      setFacebook(contact.facebook ?? '');
    }
  }, [isOpen, bio, contact]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave(bioDraft, { zalo, telegram, phone, messenger, facebook });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  const contactFields = [
    { label: 'Zalo', value: zalo, onChange: setZalo, placeholder: 'VD: 0987 654 321', icon: MessageCircle },
    { label: 'Telegram', value: telegram, onChange: setTelegram, placeholder: 'VD: @ten_user', icon: Send },
    { label: 'Điện thoại', value: phone, onChange: setPhone, placeholder: 'VD: 0912 345 678', icon: Phone },
    { label: 'Messenger', value: messenger, onChange: setMessenger, placeholder: 'VD: m.me/ten_page', icon: MessageCircle },
    { label: 'Facebook', value: facebook, onChange: setFacebook, placeholder: 'VD: fb.com/ten.page', icon: MessageCircle },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sửa hồ sơ"
    >
      <div className="relative my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <h2 className="font-display text-xl font-bold tracking-tight">Sửa hồ sơ người bán</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Giới thiệu và liên hệ sẽ hiển thị trên hồ sơ công khai và các bot của bạn.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="profile-bio" className="mb-1 block text-xs text-muted-foreground">
              Giới thiệu bản thân
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="Bạn chuyên làm loại bot nào, kinh nghiệm, cam kết hỗ trợ…"
              className={inputClass}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{bioDraft.length}/500</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kênh liên hệ
            </legend>
            <div className="space-y-3">
              {contactFields.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex items-center gap-3">
                    <label
                      htmlFor={`profile-contact-${f.label}`}
                      className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {f.label}
                    </label>
                    <input
                      id={`profile-contact-${f.label}`}
                      type="text"
                      maxLength={200}
                      value={f.value}
                      onChange={(e) => f.onChange(e.target.value)}
                      placeholder={f.placeholder}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>

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
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
