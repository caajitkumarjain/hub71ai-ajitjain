"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === "sand" ? "Night Oasis" : "Oasis"} theme`;
  return <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={label} title={label}>
    {theme === "sand" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
  </Button>;
}
