import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Check — Kiểm tra seller',
  description:
    'Kiểm tra hồ sơ, xác minh, Trust Score và cảnh báo seller trước khi giao dịch trên thuebot.org.',
};

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
