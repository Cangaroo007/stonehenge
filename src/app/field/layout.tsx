import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

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
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Stone Henge Field</h1>
          <span className="text-sm text-zinc-400">{user.name || user.email}</span>
        </div>
      </header>
      <main className="pb-20">{children}</main>
    </div>
  );
}
