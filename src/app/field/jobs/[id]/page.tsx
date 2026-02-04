import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { JobHeader } from '@/components/field/JobHeader';
import { JobTabs } from '@/components/field/JobTabs';

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'photos' } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const job = await prisma.fieldJob.findFirst({
    where: { id, createdBy: user.id },
    include: {
      _count: { select: { photos: true, measurements: true } },
    },
  });

  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col h-full">
      <JobHeader job={job} />
      <JobTabs jobId={id} activeTab={tab} counts={job._count} />
    </div>
  );
}
