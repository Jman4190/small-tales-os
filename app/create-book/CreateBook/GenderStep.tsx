"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ButtonRow } from "../components/ButtonRow"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BookData } from "@/types/book"

interface GenderStepProps {
  gender: "boy" | "girl"
  age?: number
  onBack: () => void
  onNext: (data: { gender: "boy" | "girl"; age: number }) => void
  bookData: BookData
}

export function GenderStep({ gender: initialGender, age: initialAge, onNext, onBack, bookData }: GenderStepProps) {
  const [selectedGender, setSelectedGender] = useState<"boy" | "girl" | null>(initialGender || null)
  const [selectedAge, setSelectedAge] = useState<number | null>(initialAge ?? null)

  const handleNext = () => {
    if (selectedGender && selectedAge !== null) {
      onNext({ gender: selectedGender, age: selectedAge })
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex-grow p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="px-0">
            <div className="flex items-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="hidden md:flex -ml-16 mr-6 mt-1"
                aria-label="Go back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>

              <div className="space-y-2 flex-grow">
                <h2 className="text-4xl font-semibold tracking-tight">
                  Select {bookData.name ? `${bookData.name}'s` : "Character"} Details
                </h2>
                <p className="text-muted-foreground">
                  Providing the child's gender & age leads to more accurate character illustrations.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <RadioGroup
              value={selectedGender || ""}
              onValueChange={(value) => setSelectedGender(value as "boy" | "girl")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="boy" id="boy" className="peer sr-only" />
                <Label
                  htmlFor="boy"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-6 peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary [&:has([data-state=checked])]:border-6 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground [&:has([data-state=checked])]:ring-2 [&:has([data-state=checked])]:ring-primary cursor-pointer"
                >
                  <span className="text-4xl mb-2">👦</span>
                  <span className="text-lg font-medium">Boy</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="girl" id="girl" className="peer sr-only" />
                <Label
                  htmlFor="girl"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-6 peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary [&:has([data-state=checked])]:border-6 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent [&:has([data-state=checked])]:text-accent-foreground [&:has([data-state=checked])]:ring-2 [&:has([data-state=checked])]:ring-primary cursor-pointer"
                >
                  <span className="text-4xl mb-2">👧</span>
                  <span className="text-lg font-medium">Girl</span>
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6">
              <Label className="text-md font-bold">Character Age</Label>
              <Select value={selectedAge?.toString()} onValueChange={(value) => setSelectedAge(Number(value))}>
                <SelectTrigger className="w-full focus-visible:ring-0">
                  <SelectValue placeholder="Select Age" />
                </SelectTrigger>
                <SelectContent className="w-full min-w-[8rem]">
                  {[2, 3, 4, 5, 6, 7].map((age) => (
                    <SelectItem key={age} value={String(age)}>
                      {age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6">
            <ButtonRow 
              onNext={handleNext} 
              nextDisabled={!selectedGender || selectedAge === null} 
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

