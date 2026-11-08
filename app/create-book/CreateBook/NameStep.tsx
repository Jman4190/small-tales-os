"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ButtonRow } from "../components/ButtonRow"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface NameStepProps {
  name: string
  onNext: (name: string) => void
  onBack?: () => void
}

export function NameStep({ name: initialName, onNext, onBack }: NameStepProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState("")

  const handleNext = () => {
    if (!name.trim()) {
      setError("Please enter your child's name")
      return
    }
    onNext(name.trim())
  }

  return (
    <div className="flex flex-col">
      <div className="flex-grow p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="px-0">
            <div className="flex items-start">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="hidden md:flex -ml-16 mr-6 mt-1"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              )}
              <div className="space-y-2 flex-grow">
                <h2 className="text-4xl font-semibold tracking-tight">
                  What's your character's first name?
                </h2>
                <p className="text-muted-foreground">
                  This name will be used on the cover and throughout the story.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-md font-bold">
                Character's First Name
              </Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError("")
                }}
                className="max-w-md"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>

          <div className="mt-6">
            <ButtonRow onNext={handleNext} nextDisabled={!name.trim()} size="lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

