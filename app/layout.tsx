import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/brand/theme-provider";
import { TopBar } from "@/components/brand/top-bar";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: "500", variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500"], variable: "--font-ibm-plex-arabic", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = { title: { default: "Manzil — Arrive. Build. Belong.", template: "%s · Manzil" }, description: "Your Abu Dhabi journey, compiled into one simple path." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="sand" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${arabic.variable} ${mono.variable}`}>
    <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
    <body>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:p-4">Skip to content</a>
      <ThemeProvider>
        <div className="flex min-h-dvh flex-col">
          <TopBar />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1152px] flex-1 px-4">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-[1152px] flex-col gap-4 px-4 py-7 text-xs leading-5 text-ink-muted md:flex-row md:items-center md:justify-between">
              <p className="max-w-2xl">Manzil prepares and explains. You submit through official channels. Not legal or tax advice.</p>
              <Link href="/admin/login" className="w-fit whitespace-nowrap underline-offset-4 hover:text-ink hover:underline">Operator access</Link>
            </div>
          </footer>
        </div>
      </ThemeProvider>
    </body>
  </html>;
}
