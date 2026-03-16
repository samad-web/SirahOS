import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      <Sun size={16} strokeWidth={1.5} className="block dark:hidden text-muted-foreground" />
      <Moon size={16} strokeWidth={1.5} className="hidden dark:block text-muted-foreground" />
    </button>
  );
}
