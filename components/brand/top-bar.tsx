"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { useAskManzil } from "@/components/agent/ask-manzil";

const navigation = [{ href: "/path", label: "Your path" }, { href: "/bank", label: "Bank check" }, { href: "/deadlines", label: "Deadlines" }, { href: "/agents", label: "Agents" }];

export function TopBar() {
  const pathname = usePathname();
  const askManzil = useAskManzil();
  return (
    <header className="relative z-20 border-b border-line bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1152px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 pt-4 md:flex md:min-h-22 md:gap-8 md:py-4">
        <Logo />
        <nav aria-label="Main navigation" className="order-3 col-span-2 flex min-w-0 max-w-full gap-6 overflow-x-auto pt-2 md:order-none md:ml-auto md:gap-7 md:pt-0">
          {navigation.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
            className={cn("relative flex min-h-12 items-center whitespace-nowrap text-[13px] font-medium transition-colors duration-200 hover:text-primary-ink", pathname === href ? "text-primary-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-ink-muted")}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-1 md:gap-3">
          <ThemeToggle />
          {!pathname.startsWith("/admin") && <Button variant="outline" size="sm" onClick={askManzil.open} aria-haspopup="dialog"><MessageSquare aria-hidden="true" className="hidden sm:block" />Ask Manzil</Button>}
        </div>
      </div>
    </header>
  );
}
