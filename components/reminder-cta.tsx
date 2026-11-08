// /components/reminder-cta.tsx
'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"


export function ReminderCta() {
  const [date, setDate] = useState<Date>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    childName: '',
    email: '',
    date: null as Date | null
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const form = e.currentTarget
    const childName = form.childName.value
    const email = form.email.value
    
    if (!childName || !email || !date) {
      alert('Please fill out all fields: Child\'s name, Email, and Reminder date.')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childName, email, reminderDate: date.toISOString().split('T')[0] }),
      })
      if (!response.ok) throw new Error('Unable to save reminder')
      
      // Save form data for success message
      setFormData({
        childName,
        email,
        date
      })
      
      // Show success state
      setIsSuccess(true)
    } catch (error) {
      console.error('Error saving reminder:', error)
      alert('Failed to save your reminder. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setIsSuccess(false)
    setDate(undefined)
    setFormData({
      childName: '',
      email: '',
      date: null
    })
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setCalendarOpen(false);
  }

  return (
    <section className="py-8 sm:py-16">
      <div className="container px-4 mx-auto">
        <div className="w-full max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-6 sm:p-10">
          {!isSuccess ? (
            <>
              <div className="text-center mb-6 sm:mb-10">
                <h2 className="text-2xl sm:text-4xl font-heading font-bold text-center text-primary-foreground mb-4">
                  Not ready to order now?
                </h2>
                <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto font-sans">
                  Get a reminder before a special child's birthday. Remember to order at least two weeks early to give time for printing and shipping!
                </p>
              </div>

              <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="childName" className="text-primary-foreground">
                    Child's name
                  </Label>
                  <Input
                    id="childName"
                    name="childName"
                    placeholder="Enter child's name"
                    className="bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-primary-foreground">
                    Your email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    className="bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="text-primary-foreground">
                    Remind me...
                  </Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          "bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20",
                          !date && "text-primary-foreground/50"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={handleDateSelect}
                        initialFocus
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                        classNames={{
                          nav_button: "text-primary hover:bg-primary/10 rounded-sm",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                          cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/5 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50",
                          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          day_hidden: "invisible"
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-end">
                  <Button 
                    type="submit" 
                    className="w-full bg-white text-primary hover:bg-white/90"
                  >
                    {isSubmitting ? "Processing..." : "Remind me"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center text-center py-8 px-4">
              <div className="rounded-full bg-white p-4 mb-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-4">
                You're all set!
              </h3>
              
              <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto mb-8">
                We will remind you on {formData.date ? format(formData.date, "PPP") : ""} to order a book for {formData.childName}!
              </p>
              
              <Button 
                onClick={resetForm}
                className="bg-white text-primary hover:bg-white/90"
              >
                Set another reminder
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

