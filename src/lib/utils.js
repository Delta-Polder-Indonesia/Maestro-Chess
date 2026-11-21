import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional classes for the shared Radix components. */
export function cn(...kelas) {
  return twMerge(clsx(kelas));
}
