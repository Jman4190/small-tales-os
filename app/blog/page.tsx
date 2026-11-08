import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getAllPosts } from './lib/posts';
import { ArrowRight, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog | Storybook Starter',
  description:
    'Learn how we built Storybook Starter — tutorials, behind-the-scenes, and lessons from building a solo AI business.',
  alternates: {
    canonical: '/blog',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <Header />
      <main className="w-full overflow-x-hidden">
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="container px-4 mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-[#0F0F0F] mb-4 font-[family-name:var(--font-poppins)]">
                Blog
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Behind-the-scenes of building an AI business — tutorials,
                lessons learned, and technical deep dives.
              </p>
            </div>

            {posts.length === 0 ? (
              <div className="text-center py-16 bg-[#FAFAFA] rounded-2xl border">
                <p className="text-muted-foreground text-lg mb-2">
                  New posts coming soon!
                </p>
                <p className="text-sm text-muted-foreground">
                  In the meantime, check out our{' '}
                  <Link
                    href="/course"
                    className="text-[#5075FE] hover:underline"
                  >
                    course
                  </Link>{' '}
                  to learn how we built Storybook Starter.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="block group"
                  >
                    <article className="bg-white rounded-2xl border p-6 md:p-8 transition-shadow hover:shadow-md">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={post.date}>
                          {new Date(post.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </time>
                        {post.tags && post.tags.length > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-gray-100 text-xs px-2 py-0.5 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </>
                        )}
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-[#0F0F0F] mb-2 group-hover:text-[#5075FE] transition-colors font-[family-name:var(--font-poppins)]">
                        {post.title}
                      </h2>

                      <p className="text-muted-foreground mb-4">
                        {post.description}
                      </p>

                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#5075FE]">
                        Read more
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
