'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAdminAccess } from '@/context/AdminAccessContext';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const POLICIES = [
  ['RBAC admin', 'StaffGuard kiểm tra opaque session và bảng staff_members ở backend.'],
  ['Giá listing', 'Bot dùng monthlyPrice làm giá tham chiếu bắt buộc; bảng giá bổ sung là tùy chọn.'],
  ['Liên hệ seller', 'Kênh liên hệ được đọc từ seller profile, không nhân bản vào từng bot.'],
  ['Audit', 'AdminAuditLog là append-only và mỗi event nối hash với event trước.'],
];

type RegistrationResponse = Awaited<ReturnType<typeof startRegistration>>;

export default function AdminSettingsPage() {
  const { role } = useAdminAccess();
  const [passkeyState, setPasskeyState] = useState('');

  const registerPasskey = async () => {
    setPasskeyState('Đang chờ xác nhận trên thiết bị…');
    try {
      const optionsResponse = await fetchWithTimeout(
        '/api/security/webauthn/registration/options',
        { credentials: 'include' },
      );
      const optionsJson = await optionsResponse.json() as {
        success?: boolean;
        data?: Parameters<typeof startRegistration>[0]['optionsJSON'];
        error?: string;
      };
      if (!optionsResponse.ok || !optionsJson.success || !optionsJson.data) {
        throw new Error(optionsJson.error || 'Không tạo được challenge passkey.');
      }
      const response: RegistrationResponse = await startRegistration({ optionsJSON: optionsJson.data });
      const verifyResponse = await fetchWithTimeout(
        '/api/security/webauthn/registration/verify',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response }),
        },
      );
      const verifyJson = await verifyResponse.json() as { success?: boolean; error?: string };
      if (!verifyResponse.ok || !verifyJson.success) {
        throw new Error(verifyJson.error || 'Không lưu được passkey.');
      }
      setPasskeyState('Passkey đã được đăng ký trên tài khoản này.');
    } catch (error) {
      setPasskeyState(error instanceof Error ? error.message : 'Không đăng ký được passkey.');
    }
  };

  if (role !== 'owner') {
    return (
      <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]">
        <p className="font-bold">Không có quyền truy cập</p>
        <p className="mt-1">Cài đặt hệ thống chỉ dành cho Owner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-[#1677ff]">System</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Cài đặt</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#69707d]">
          Các lớp bảo vệ được áp dụng ở server; client không được tự quyết định quyền hay số liệu.
        </p>
      </div>

      <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#1677ff]" aria-hidden />
          <div>
            <h2 className="font-bold text-[#12151b]">Passkey step-up</h2>
            <p className="mt-1 text-xs text-[#69707d]">Owner cần passkey cho các thao tác staff/trust quan trọng.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void registerPasskey()}
          className="mt-4 rounded-lg bg-[#1677ff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f63d8]"
        >
          Đăng ký passkey trên thiết bị này
        </button>
        {passkeyState ? <p className="mt-3 text-sm text-[#36404d]" role="status">{passkeyState}</p> : null}
      </section>

      <section className="rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex items-center gap-3 border-b border-[#edf0f2] px-5 py-4 sm:px-6">
          <LockKeyhole className="h-5 w-5 text-[#1677ff]" aria-hidden />
          <div>
            <h2 className="font-bold text-[#12151b]">System policies</h2>
            <p className="mt-1 text-xs text-[#69707d]">Read-only để tránh tạo cấu hình giả từ client.</p>
          </div>
        </div>
        <div className="divide-y divide-[#edf0f2]">
          {POLICIES.map(([label, description]) => (
            <div key={label} className="flex flex-wrap gap-3 px-5 py-4 sm:px-6">
              <div className="w-44 shrink-0 text-sm font-bold text-[#12151b]">{label}</div>
              <p className="max-w-2xl text-sm leading-6 text-[#69707d]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-[#d9e5f8] bg-[#f5f8fe] px-4 py-3 text-sm text-[#36404d]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1677ff]" aria-hidden />
        <p>Critical mutations yêu cầu device proof, action permit, replay protection và passkey step-up.</p>
      </div>
    </div>
  );
}
