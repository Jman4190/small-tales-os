/**
 * Centralized design tokens for button styles.
 * Update any token here to change button appearance across the codebase.
 */

export const BUTTON_BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const BUTTON_VARIANTS = {
  default: "bg-[#5075FE] text-primary-foreground hover:bg-[#5075FE]/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "bg-black text-white border-2 border-black hover:bg-black/80",
  secondary: "bg-black text-white hover:bg-black/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

export const BUTTON_SIZES = {
  default: "h-12 px-8 py-3 text-base",
  sm: "h-10 px-6 py-2 text-base",
  lg: "h-14 px-10 py-4 text-base",
  icon: "h-12 w-12",
}; 