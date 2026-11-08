import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getPostBySlug, getAllPosts } from '../lib/posts';
import { ArrowLeft, Calendar } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: `${post.title} | Storybook Starter Blog`,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="w-full overflow-x-hidden">
        <article className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="container px-4 mx-auto max-w-3xl">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#5075FE] transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to blog
            </Link>

            {/* Header */}
            <header className="mb-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
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

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F0F0F] font-[family-name:var(--font-poppins)]">
                {post.title}
              </h1>

              {post.description && (
                <p className="text-lg text-muted-foreground mt-4">
                  {post.description}
                </p>
              )}
            </header>

            {/* Content */}
            <div
              className="prose prose-lg max-w-none prose-headings:font-[family-name:var(--font-poppins)] prose-headings:text-[#0F0F0F] prose-a:text-[#5075FE] prose-a:no-underline hover:prose-a:underline prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-[#1a1a2e] prose-pre:text-gray-100 prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            {/* CTA */}
            <div className="mt-16 p-8 bg-[#F0F4FF] rounded-2xl text-center">
              <h3 className="text-xl font-bold text-[#0F0F0F] mb-2 font-[family-name:var(--font-poppins)]">
                Want to learn how we built all of this?
              </h3>
              <p className="text-muted-foreground mb-4">
                Sign up for our course and learn to build your own AI business.
              </p>
              <Link
                href="/course"
                className="inline-flex h-12 px-8 items-center justify-center rounded-full bg-[#5075FE] text-white font-medium hover:bg-[#5075FE]/90 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
