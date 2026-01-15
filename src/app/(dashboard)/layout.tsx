import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={user} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
