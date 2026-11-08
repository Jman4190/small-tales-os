import { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CourseHero } from './components/CourseHero';
import { CourseModules } from './components/CourseModules';
import { CourseSignupForm } from './components/CourseSignupForm';
import { CourseOutcomes } from './components/CourseOutcomes';

export const metadata: Metadata = {
  title: "How to Build Your Own Personalized Children's Book Business | Storybook Starter Course",
  description:
    'Learn to Build, Operate and Market A Solo AI Business with Cursor, ChatGPT, Stripe and More. A step-by-step course for $9.99.',
  alternates: {
    canonical: '/course',
  },
  openGraph: {
    title: "How to Build Your Own Personalized Children's Book Business",
    description:
      'Learn to Build, Operate and Market A Solo AI Business with Cursor, ChatGPT, Stripe and More.',
    url: 'https://www.example.com/course',
    siteName: 'Storybook Starter',
    type: 'website',
  },
};

export default function CoursePage() {
  return (
    <>
      <Header />
      <main className="w-full overflow-x-hidden">
        <CourseHero />
        <CourseModules />
        <CourseOutcomes />
        <CourseSignupForm />
      </main>
      <Footer />
    </>
  );
}
