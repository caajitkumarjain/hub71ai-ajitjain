import { useId } from "react";
import { cn } from "@/lib/utils";

export function GeoPattern({ className }: { className?: string }) {
  const patternId = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" focusable="false" className={cn("pointer-events-none absolute inset-0 size-full text-primary opacity-5", className)} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} width="96" height="96" patternUnits="userSpaceOnUse">
          <path d="M48 8 60 28 80 16 68 36 88 48 68 60 80 80 60 68 48 88 36 68 16 80 28 60 8 48 28 36 16 16 36 28Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 0 16 16M96 0 80 16M96 96 80 80M0 96 16 80M36 28 60 28 68 36 68 60 60 68 36 68 28 60 28 36Z" fill="none" stroke="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
