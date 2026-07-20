"use client";

import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Small "?" icon shown next to a summary-card label. Clicking it opens a
 * popover explaining, in plain language, how that card's figure is calculated
 * so non-technical users can understand the numbers.
 */
export const CardInfo = ({ label, text }: { label: string; text: string }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${label} is calculated`}
          className="text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <p className="mb-1 text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-sm leading-relaxed text-gray-600">{text}</p>
      </PopoverContent>
    </Popover>
  );
};
