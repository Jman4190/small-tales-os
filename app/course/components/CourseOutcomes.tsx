import {
  Code,
  Briefcase,
  Cpu,
  User,
} from 'lucide-react';

const outcomes = [
  {
    icon: Code,
    title: 'Technical Skills',
    description:
      'Full-stack development, AI integration, payment processing, deployment',
  },
  {
    icon: Briefcase,
    title: 'Business Skills',
    description:
      'Product development, marketing, legal setup, operations',
  },
  {
    icon: Cpu,
    title: 'AI Integration',
    description:
      'Practical use of modern AI APIs and tools in production',
  },
  {
    icon: User,
    title: 'Solo Founder Mindset',
    description:
      'How to build and operate a business independently',
  },
];

export function CourseOutcomes() {
  return (
    <section className="py-16 md:py-24 bg-[#FAFAFA]">
      <div className="container px-4 mx-auto max-w-4xl">
        {/* What you'll learn */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4 font-[family-name:var(--font-poppins)]">
            What You&apos;ll Walk Away With
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            By the end of this course, you&apos;ll have built and deployed a complete
            AI-powered SaaS business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {outcomes.map((outcome, i) => {
            const Icon = outcome.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border p-6 flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#5075FE]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#5075FE]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F0F0F] mb-1">
                    {outcome.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {outcome.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Course philosophy */}
        <div className="bg-white rounded-2xl border p-8">
          <h3 className="text-xl font-bold text-[#0F0F0F] mb-4 font-[family-name:var(--font-poppins)]">
            Build-in-Public Approach
          </h3>
          <p className="text-muted-foreground mb-4">
            This course follows a build-in-public philosophy. I&apos;ll rebuild
            everything from scratch as I teach, with detailed blog posts, video
            walkthroughs, and real examples from the actual Storybook Starter codebase.
          </p>
          <p className="text-muted-foreground">
            Each section builds naturally on the previous one — progressive
            complexity so you&apos;re never overwhelmed.
          </p>
        </div>
      </div>
    </section>
  );
}
