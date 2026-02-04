import type { Metadata } from 'next';
import { InstallPrompt } from '@/components/field/InstallPrompt';

export const metadata: Metadata = {
  title: 'Stone Henge Field',
  description: 'Field capture app for Stone Henge',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SH Field',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'theme-color': '#18181b',
  },
};

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {children}
      <InstallPrompt />
    </div>
  );
}
