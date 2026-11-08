import { login } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

export default async function LoginPage({ 
  searchParams // Keep simple here
}: {
  // Declare searchParams as a Promise matching generated PageProps
  searchParams: Promise<{ message: string }>;
}) {
  // Await the promise to get the actual searchParams object
  const actualSearchParams = await searchParams;

  return (
    <section className="bg-gray-50">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <div className="mb-8">
          <Link href="/" className="flex justify-center">
            <Image
              className="h-12 w-auto"
              src="/release-placeholder.svg"
              alt="Storybook Starter logo"
              width={180}
              height={48}
              priority
            />
          </Link>
        </div>
        <div className="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl text-center">
              Admin Sign In
            </h1>
            <form className="space-y-4 md:space-y-6">
              <div>
                <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900">Your email</label>
                <input 
                  type="email" 
                  name="email" 
                  id="email" 
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5" 
                  placeholder="name@example.com" 
                  required 
                />
              </div>
              <div>
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900">Password</label>
                <input 
                  type="password" 
                  name="password" 
                  id="password" 
                  placeholder="••••••••" 
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5" 
                  required 
                />
              </div>

              <Button type="submit" formAction={login} className="w-full">Sign in</Button>
              
              {actualSearchParams?.message && (
                <p className="text-sm font-light text-red-500 mt-4 text-center">
                  {actualSearchParams.message}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}