"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertCircle, X } from "lucide-react";
import { Button } from "./ui/Button";

interface VocabPopoverProps {
  word: string;
  lemma?: string;
  definition: string;
  cefrLevel: string;
  children: React.ReactNode;
}

export function VocabPopover({
  word,
  lemma,
  definition,
  cefrLevel,
  children,
}: VocabPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleReportError = () => {
    console.log(`Reported error for word: ${word}`);
    // Future: API call to report error
    alert("Thank you! The error has been reported to our linguists.");
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 rounded-lg border border-zinc-800 bg-black p-4 shadow-xl animate-in fade-in zoom-in-95"
          sideOffset={5}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{word}</h3>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                {cefrLevel}
              </span>
            </div>
            
            {lemma && lemma.toLowerCase() !== word.toLowerCase() && (
              <p className="text-sm text-zinc-400">
                Root: <span className="italic font-medium text-zinc-300">{lemma}</span>
              </p>
            )}

            <div className="my-2 border-t border-zinc-900" />

            <p className="text-sm text-zinc-200 leading-relaxed">
              {definition}
            </p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs flex items-center justify-center gap-1 bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                onClick={handleReportError}
              >
                <AlertCircle className="h-3 w-3" />
                Report Error
              </Button>
            </div>
          </div>
          <Popover.Close
            className="absolute top-2 right-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Popover.Close>
          <Popover.Arrow className="fill-zinc-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
