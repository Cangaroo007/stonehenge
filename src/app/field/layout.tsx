import { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
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

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Stone Henge Field</h1>
          <span className="text-sm text-zinc-400">{user.name || user.email}</span>
        </div>
      </header>
      <div className="flex-1 pb-20 overflow-auto">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
