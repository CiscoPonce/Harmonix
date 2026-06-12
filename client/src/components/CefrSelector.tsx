"use client";

import * as React from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CEFR_LEVELS = [
  { value: "A1", label: "A1 - Beginner" },
  { value: "A2", label: "A2 - Elementary" },
  { value: "B1", label: "B1 - Intermediate" },
  { value: "B2", label: "B2 - Upper Intermediate" },
  { value: "C1", label: "C1 - Advanced" },
  { value: "C2", label: "C2 - Mastery" },
];

interface CefrSelectorProps {
  currentLevel?: string;
  onLevelChange?: (level: string) => void;
  className?: string;
}

export function CefrSelector({
  currentLevel = "B1",
  onLevelChange,
  className,
}: CefrSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Proficiency Level
      </label>
      <Select.Root value={currentLevel} onValueChange={onLevelChange}>
        <Select.Trigger
          className="inline-flex items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-white transition-colors hover:bg-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 gap-2 min-w-[180px]"
          aria-label="CEFR Level"
        >
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-zinc-400" />
            <Select.Value />
          </div>
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="z-50 overflow-hidden rounded-md border border-zinc-800 bg-black shadow-xl animate-in fade-in zoom-in-95">
            <Select.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-black text-zinc-400">
              <ChevronDown className="h-4 w-4 rotate-180" />
            </Select.ScrollUpButton>
            
            <Select.Viewport className="p-1">
              {CEFR_LEVELS.map((level) => (
                <Select.Item
                  key={level.value}
                  value={level.value}
                  className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-zinc-300 outline-hidden hover:bg-zinc-800 hover:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <Select.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{level.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-black text-zinc-400">
              <ChevronDown className="h-4 w-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
