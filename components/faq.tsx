// /components/faq.tsx
import { FaqSection } from "@/components/ui/faq-section"

export const FAQS = [
  {
    question: "How does the AI process actually work?",
    answer: "Our AI technology carefully analyzes your child's photo to create a beautifully illustrated character that captures their unique features. The process is quick, secure, and produces high-quality illustrations that maintain your child's likeness while fitting seamlessly into our storybook style."
  },
  {
    question: "What age range is the book typically for?",
    answer: "Our book is designed for children aged 3-6 years old. Our story is carefully crafted to be age-appropriate, engaging, and educational."
  },
  {
    question: "How long does it take to receive the book?",
    answer: "After you approve the final preview, books typically take 9-12 business days for printing and shipping within the US. Each book is carefully printed and bound to ensure the highest quality. Shipping is free."
  },
  {
    question: "Can I preview the book before ordering?",
    answer: "While you cannot preview the entire book before ordering, you will receive a complete digital preview of your personalized book via email within 24 hours of your purchase. This includes all illustrations and text, allowing you to ensure you're completely satisfied with how your child is represented in the story before it's printed. If there are any issues we will work with you to fix them."
  },
  {
    question: "What if I'm not satisfied with the result?",
    answer: "Your satisfaction is our priority. If you're not happy with the initial character illustration, we offer unlimited revisions until you're completely satisfied. You can provide specific feedback, and our team will adjust the illustration accordingly."
  },
  {
    question: "What happens to the uploaded picture of my child after I submit it?",
    answer: "Every photo upload on our website gets permanently deleted 30 days after submission. To ensure a safe and secure environment, your child's photo(s) will never be used for anything other than your personal book's printing."
  },
  {
    question: "What is the size of the book?",
    answer: "The hardcoverbook is 11x11 inches and 30 pages long."
  },
  {
    question: "Do you only offer one version of the book?",
    answer: "Yes, we only have one book adventure available at the moment. However it will be personalized for each child."
  }
]

export function Faq() {
  return (
    <section id="faqs" className="py-8 sm:py-16 bg-background">
      <div className="container px-4 mx-auto">
        <FaqSection
          title="Frequently Asked Questions"
          items={FAQS}
        />
      </div>
    </section>
  )
}

