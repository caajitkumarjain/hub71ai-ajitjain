import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-sm" aria-label="Manzil home">
      <svg viewBox="0 0 48 48" className="size-7 text-gold" fill="none" aria-hidden="true">
        <path d="m24 2 6.4 10.5L42 6l-6.5 11.6L46 24l-10.5 6.4L42 42l-11.6-6.5L24 46l-6.4-10.5L6 42l6.5-11.6L2 24l10.5-6.4L6 6l11.6 6.5Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M24 15 33 24 24 33 15 24Z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="font-display text-[28px] leading-none tracking-[-0.04em]">Manzil<span className="text-gold">.</span></span>
    </Link>
  );
}
