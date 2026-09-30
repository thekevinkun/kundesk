"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border transition-all outline-none",
        "h-5 w-9",
        "border-(--color-border)",
        "bg-(--color-border)",
        "hover:border-(--color-brand-mid)",
        "data-[state=checked]:border-(--color-brand)",
        "data-[state=checked]:bg-(--color-brand)",
        "data-[state=checked]:hover:shadow-[0_0_0_3px_var(--color-brand-light)]",
        "focus-visible:ring-[3px] focus-visible:ring-(--color-brand)/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
          "data-[state=checked]:translate-x-[calc(100%-2px)]",
          "data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
