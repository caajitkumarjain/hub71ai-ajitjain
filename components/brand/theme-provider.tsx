"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readTheme, themeKey, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: "sand", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const [theme, setTheme] = useState<Theme>(isAdmin ? "night" : "sand");
  useEffect(() => {
    let next: Theme = isAdmin ? "night" : "sand";
    try { next = readTheme(isAdmin, window.localStorage); } catch { /* Storage may be unavailable. */ }
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, [isAdmin]);
  function toggleTheme() {
    const next = theme === "sand" ? "night" : "sand";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { window.localStorage.setItem(themeKey(isAdmin), next); } catch { /* Theme still works for this visit. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
