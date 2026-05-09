// cn() — merges Tailwind classes safely, resolving conflicts
// Used everywhere: cn("base-class", conditional && "extra-class", props.className)
// clsx handles conditionals, tailwind-merge resolves Tailwind conflicts (e.g. p-2 + p-4 → p-4)

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
