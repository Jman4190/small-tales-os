import type React from "react"
import { Truck, Shield, ShieldCheck, BookOpen, Award, Gift } from "lucide-react"

interface ValueProp {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const valueProps: ValueProp[] = [
  {
    icon: Truck,
    title: "Free Shipping",
    description: "Shipping is on us with delivery in under two weeks.",
  },
  {
    icon: ShieldCheck,
    title: "100% Satisfaction",
    description: "If you're not satisfied we offer a full refund policy.",
  },
  {
    icon: BookOpen,
    title: "Full Book Preview",
    description: "You get to preview the entire book before it goes to print.",
  },
  {
    icon: Award,
    title: "Premium Hardcover",
    description: "We work with the best print shops across the country.",
  },
  {
    icon: Gift,
    title: "Birthday Gift",
    description: "The perfect gift for that upcoming birthday!",
  },
]

export function ValueProps() {
  return (
    <section className="bg-white py-8 sm:py-16 px-4">
      <div className="container mx-auto">
        <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-10">
          Why Go With Storybook Starter?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6">
          {valueProps.map((prop, index) => {
            const IconComponent = prop.icon
            return (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  <IconComponent className="w-12 h-12 text-gray-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{prop.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{prop.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
} 