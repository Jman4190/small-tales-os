import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from "@/components/ui/dialog"
  import { Button } from "@/components/ui/button"
  import { memo } from "react"
  
  interface PreviewModalProps {
    isOpen: boolean
    onClose: () => void
  }
  
  // Memoize the modal component to prevent unnecessary rerenders
  export const PreviewModal = memo(function PreviewModal({ isOpen, onClose }: PreviewModalProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent hideCloseButton>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ fontFamily: "var(--font-poppins)" }}>
              Please Read Before Reviewing
            </DialogTitle>
            <DialogDescription>
              Once you hit approve, we'll send it to print.
              If you're not happy with the quality of the illustrations, please let us know.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Got It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  })
  
  