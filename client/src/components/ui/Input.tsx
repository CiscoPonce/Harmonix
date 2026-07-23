import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[#E4EBE6] bg-white px-3 py-2 text-sm text-[#0C1210] shadow-xs transition-colors",
          "placeholder:text-[#9AABA0]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:border-[#0B4D2E] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0B4D2E]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-[#2A3530] dark:bg-[#171E1B] dark:text-[#F2F5F3] dark:placeholder:text-[#9AABA0]",
          "dark:focus-visible:border-[#3DCF7A] dark:focus-visible:ring-[#3DCF7A]/20",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
