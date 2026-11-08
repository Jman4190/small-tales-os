'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FileText,
  Database,
  BookOpen,
  Printer,
  CheckCircle,
  CreditCard,
  Star,
  BarChart3,
  Building2,
  Megaphone,
  Bot,
} from 'lucide-react';

const modules = [
  {
    number: 1,
    title: 'PRDs, Prototypes & Project Setup',
    icon: FileText,
    goal: 'Launch a functional landing page on Vercel with proper development workflow',
    lessons: [
      'Write a comprehensive PRD with ChatPRD',
      'Prototype landing page design with v0',
      'Create and configure GitHub Repository',
      'Install development requirements and setup environment variables',
      'Open project in Cursor & make initial edits',
      'Test using local development server',
      'Deploy and host on Vercel',
      'BONUS: Create professional landing page assets in Canva',
    ],
    technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'GitHub', 'Vercel', 'Cursor IDE', 'v0'],
  },
  {
    number: 2,
    title: 'Database & Storage',
    icon: Database,
    goal: 'Set up robust data persistence and file storage infrastructure',
    lessons: [
      'Get started with Supabase (database + storage + auth)',
      'Design and create database tables for books, orders, users',
      'Create storage buckets for images and PDFs',
      'Add Supabase MCP to Cursor for enhanced development',
      'Understanding RLS (Row Level Security) policies',
      'Database migrations and schema management',
    ],
    technologies: ['Supabase (PostgreSQL, Storage)', 'SQL fundamentals', 'Database design'],
  },
  {
    number: 3,
    title: 'Create Book Flow',
    icon: BookOpen,
    goal: 'Build the core AI-powered book creation pipeline',
    lessons: [
      'Experiment with Leonardo AI models and capabilities',
      'Finalize prompts and store in prompts.md for version control',
      'Prototype user flow in v0 (multi-step form)',
      'Handle photo uploads with Supabase Storage',
      'Image verification with Fal: Appearance data extraction',
      'Generating preview images with Leonardo API',
      'Use Inngest to orchestrate long-running tasks',
      'Generate complete book image sets',
      'Error handling and retry logic',
      'Status polling and real-time updates',
    ],
    technologies: ['Leonardo.ai API', 'Fal.ai', 'Inngest', 'React state management'],
  },
  {
    number: 4,
    title: 'PDF & Printing',
    icon: Printer,
    goal: 'Transform generated images into printable books',
    lessons: [
      'Get started with Gelato print-on-demand platform',
      'Design book templates with PDF-API.io',
      'Generate PDFs dynamically from image sets',
      'Upload finished PDFs to Supabase Storage',
      'Handle different book formats and sizing',
      'Quality control and preview generation',
      'Print specifications and requirements',
    ],
    technologies: ['Gelato API', 'PDF-API.io', 'PDF generation'],
  },
  {
    number: 5,
    title: 'Book Approval',
    icon: CheckCircle,
    goal: 'Create review and approval workflow with customer communication',
    lessons: [
      'Set up Cloudflare for transactional emails',
      'Setup Twilio account for SMS notifications',
      'Design approval workflow database tables',
      'Send PDF previews via email & SMS',
      'Build approve & decline process in Cursor',
      'Handle customer feedback and revision requests',
      'Send approved books to Gelato for printing',
      'Automated status updates and tracking',
    ],
    technologies: ['Cloudflare Email Sending', 'Twilio', 'React Email', 'Workflow state management'],
  },
  {
    number: 6,
    title: 'Stripe Checkout',
    icon: CreditCard,
    goal: 'Implement secure payment processing',
    lessons: [
      'Create Stripe test account and understand dashboard',
      'Setup Stripe webhooks for event handling',
      'Add Stripe environment variables and security',
      'Create your first product and pricing models',
      'Create Stripe hosted payment links',
      'Add proper branding and checkout experience',
      'Handle payment success/failure scenarios',
      'Subscription management and billing',
      'Tax handling and compliance',
    ],
    technologies: ['Stripe API', 'Webhooks', 'Payment security'],
  },
  {
    number: 7,
    title: 'Reviews',
    icon: Star,
    goal: 'Build social proof and feedback systems',
    lessons: [
      'Design Supabase table for review management',
      'Create review collection workflow',
      'Connect reviews to homepage for social proof',
      'Moderate and manage customer feedback',
      'Display reviews with proper formatting',
      'Handle review analytics and insights',
    ],
    technologies: ['Review system design', 'Content moderation', 'Social proof'],
  },
  {
    number: 8,
    title: 'Tracking & Logging',
    icon: BarChart3,
    goal: 'Implement comprehensive monitoring and analytics',
    lessons: [
      'Setup Posthog for product analytics',
      'Setup logging with Betterstack (formerly Logtail)',
      'Create Stripe webhooks for business notifications',
      'Error tracking and alerting',
      'Performance monitoring',
      'Customer journey analytics',
      'Business metrics and KPIs',
    ],
    technologies: ['Posthog analytics', 'Betterstack logging', 'Monitoring'],
  },
  {
    number: 9,
    title: 'Setup the Business',
    icon: Building2,
    goal: 'Establish legal business entity and operational infrastructure',
    lessons: [
      'Buy a domain with GoDaddy and DNS configuration',
      'Setup Google Workspace for professional email',
      'Use Stripe Atlas to incorporate your business',
      'Get a business address with Stable',
      'Setup business bank account with Mercury',
      'Create legal documents and terms of service',
      'Understanding business compliance and requirements',
      'Business insurance and protection',
    ],
    technologies: ['Domain management', 'Business incorporation', 'Banking setup'],
  },
  {
    number: 10,
    title: 'Marketing',
    icon: Megaphone,
    goal: 'Drive customer acquisition and build brand presence',
    lessons: [
      'Use Veo3 for AI video generation',
      'Edit videos with CapCut for social media',
      'Create and optimize TikTok & Instagram accounts',
      'Setup Google Search Console for SEO',
      'Launch Facebook & Instagram ads campaigns',
      'Setup Google Ads for branded keywords',
      'Content marketing strategy',
      'Influencer outreach and partnerships',
      'Email marketing and retention',
    ],
    technologies: ['AI video generation', 'Social media marketing', 'Paid advertising', 'SEO'],
  },
  {
    number: 11,
    title: 'Bonus: AI Engineers',
    icon: Bot,
    goal: 'Leverage AI coding assistants for enhanced development',
    lessons: [
      'Use Codex for advanced code generation',
      'Integrate Devin for autonomous development tasks',
      'Setup Cursor Background Agent for continuous assistance',
      'AI-assisted debugging and optimization',
      'Automated testing with AI',
      'Code review and quality assurance with AI',
    ],
    technologies: ['Advanced AI coding assistants', 'Automated development workflows'],
  },
];

export function CourseModules() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container px-4 mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4 font-[family-name:var(--font-poppins)]">
            Course Curriculum
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            11 comprehensive modules covering everything from your first line of
            code to your first paying customer.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <AccordionItem key={mod.number} value={`module-${mod.number}`}>
                <AccordionTrigger className="hover:no-underline py-5">
                  <div className="flex items-center gap-4 text-left">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#5075FE]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#5075FE]" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-[#5075FE] uppercase tracking-wide">
                        Module {mod.number}
                      </span>
                      <h3 className="text-base font-semibold text-[#0F0F0F]">
                        {mod.title}
                      </h3>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-14 space-y-4">
                    <p className="text-sm text-muted-foreground font-medium">
                      <span className="text-[#0F0F0F]">Goal:</span> {mod.goal}
                    </p>

                    <div>
                      <h4 className="text-sm font-semibold text-[#0F0F0F] mb-2">
                        Lessons:
                      </h4>
                      <ul className="space-y-1.5">
                        {mod.lessons.map((lesson, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="text-[#5075FE] mt-1 flex-shrink-0">
                              &bull;
                            </span>
                            {lesson}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {mod.technologies.map((tech, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-muted-foreground px-2.5 py-1 rounded-full"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
