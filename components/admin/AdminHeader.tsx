'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client'; // Use client-side Supabase
import { Button } from '@/components/ui/button';

export function AdminHeader() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login'); // Redirect to login page after logout
    router.refresh(); // Optional: Force refresh to clear state
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex-1"></div>
        <Link href="/admin" className="flex items-center flex-1 justify-center">
          <Image 
            src="/release-placeholder.svg" 
            alt="Storybook Starter Admin"
            width={120}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <div className="flex-1 flex justify-end">
          <button 
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
} 