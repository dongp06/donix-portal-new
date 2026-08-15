"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({
  className = "",
}: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      onClick={() => {
        if (!mounted) return;
        setTheme(isDark ? "light" : "dark");
      }}
      variant="ghost"
      size="icon"
      className={cn(
        "relative z-50 h-9 w-9 rounded-lg p-2 text-neutral-500",
        "transition-colors duration-200",
        "hover:bg-neutral-200/70 hover:text-amber-500",
        "dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-yellow-400",
        !mounted && "pointer-events-none opacity-70",
        className,
      )}
      aria-label={
        !mounted
          ? "Toggle theme"
          : isDark
            ? "Switch to light theme"
            : "Switch to dark theme"
      }
    >
      {isDark ? (
        <Sun className="h-5 w-5 stroke-[2]" aria-hidden />
      ) : (
        <Moon className="h-5 w-5 stroke-[2]" aria-hidden />
      )}
    </Button>
  );
}
