import type { Metadata } from 'next';
import './global.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'CSV Extractor — AI-Powered CRM Import',
  description: 'Upload, map, and import CSV data with AI field mapping',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
