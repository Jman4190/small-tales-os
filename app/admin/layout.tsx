import { AdminHeader } from '@/components/admin/AdminHeader';
import { Toaster } from '@/components/ui/toaster';
import { requireAdminUser } from '@/lib/admin-auth';
import { notFound, redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    if (admin.status === 401) redirect('/login?message=Authentication%20required');
    notFound();
  }

  return (
    <div className="bg-white min-h-screen">
      <AdminHeader />
      <main>{children}</main>
      <Toaster />
    </div>
  );
}
