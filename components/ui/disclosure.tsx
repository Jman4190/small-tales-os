"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

interface DisclosureContextType {
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
  currentId: string;
}

const DisclosureContext = React.createContext<DisclosureContextType | undefined>(undefined);

interface DisclosureProps {
  children: React.ReactNode;
  defaultOpen?: string | null;
}

const Disclosure = ({ children, defaultOpen = null }: DisclosureProps) => {
  const [openItem, setOpenItem] = React.useState<string | null>(defaultOpen);
  const idRef = React.useRef(0);
  const currentId = `disclosure-${idRef.current++}`;

  return (
    <DisclosureContext.Provider value={{ openItem, setOpenItem, currentId }}>
      {children}
    </DisclosureContext.Provider>
  );
};

const useDisclosure = () => {
  const context = React.useContext(DisclosureContext);
  if (!context) {
    throw new Error("useDisclosure must be used within a Disclosure");
  }
  return context;
};

const Button = ({
  children,
  className,
  id,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { id: string }) => {
  const { openItem, setOpenItem } = useDisclosure();
  const isOpen = openItem === id;

  return (
    <button
      type="button"
      onClick={() => setOpenItem(isOpen ? null : id)}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
      <span className={cn(
        "ml-6 flex h-7 items-center transition-transform duration-200",
        isOpen && "rotate-180"
      )}>
        <ChevronDown className="h-4 w-4" />
      </span>
    </button>
  );
};

const Panel = ({
  children,
  className,
  id,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { id: string }) => {
  const { openItem } = useDisclosure();
  const isOpen = openItem === id;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

Disclosure.Button = Button;
Disclosure.Panel = Panel;

export { Disclosure }; 