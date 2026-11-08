"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (feedback: { reason: string; otherText?: string }) => void
  isSubmitting?: boolean
}

export function FeedbackModal({ isOpen, onClose, onSubmit, isSubmitting }: FeedbackModalProps) {
  const [selected, setSelected] = useState("")
  const [otherText, setOtherText] = useState("")

  const handleSubmit = () => {
    if (selected) {
      onSubmit({
        reason: selected,
        otherText: selected === "other" ? otherText : undefined
      })
      setSelected("")
      setOtherText("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Please select a reason</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3">
            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted">
              <RadioGroupItem value="layout" id="layout" />
              <Label htmlFor="layout" className="flex-grow cursor-pointer">
                Layout or formatting issues
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted">
              <RadioGroupItem value="single_image" id="single_image" />
              <Label htmlFor="single_image" className="flex-grow cursor-pointer">
                1 image doesn't look good
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted">
              <RadioGroupItem value="multiple_images" id="multiple_images" />
              <Label htmlFor="multiple_images" className="flex-grow cursor-pointer">
                Multiple images don't look good
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted">
              <RadioGroupItem value="other" id="other" />
              <Label htmlFor="other" className="flex-grow cursor-pointer">
                Other reason
              </Label>
            </div>
          </RadioGroup>
          {selected === "other" && (
            <Textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Please specify your reason..."
              className="min-h-[80px]"
            />
          )}
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={!selected || (selected === "other" && !otherText.trim()) || isSubmitting} 
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Decline & Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 