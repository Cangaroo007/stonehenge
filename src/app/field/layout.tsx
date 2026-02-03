import { Metadata, Viewport } from 'next';
import { BottomNav } from '@/components/field/BottomNav';

export const metadata: Metadata = {
  title: 'Stone Henge Field',
  description: 'Field capture app for Stone Henge',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <div className="flex-1 pb-20 overflow-auto">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
