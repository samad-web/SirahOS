/**
 * Global keyboard-shortcut cheat sheet.
 *
 * Opens with Shift+? (or just `?` when no input is focused). Displays a
 * categorized list of all discoverable shortcuts so keyboard power users
 * aren't stuck guessing.
 *
 * Kept alongside CommandBar because both are app-wide overlays triggered
 * by modifier keys and share the same "floating root-level dialog" feel.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  label: string;
  items: Shortcut[];
}

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const GROUPS: ShortcutGroup[] = [
  {
    label: "Global",
    items: [
      { keys: [mod, "K"],           description: "Open command palette / global search" },
      { keys: ["Shift", "?"],       description: "Show this keyboard shortcuts help" },
      { keys: ["Esc"],              description: "Close any open dialog or modal" },
    ],
  },
  {
    label: "Navigation",
    items: [
      { keys: [mod, "K", "then type"], description: "Jump to any page via the palette" },
      { keys: ["Tab"],              description: "Move focus forward through interactive elements" },
      { keys: ["Shift", "Tab"],     description: "Move focus backward" },
    ],
  },
  {
    label: "Tables & Lists",
    items: [
      { keys: ["Enter"],            description: "Activate the focused row / button" },
      { keys: ["Space"],            description: "Toggle the focused checkbox or button" },
    ],
  },
];

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md border border-border bg-muted text-[11px] font-mono font-semibold text-foreground shadow-sm">
      {label}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing inside inputs/textareas/contenteditable.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;

      // Shift+? (key === "?") — works both with and without editables, because
      // ? is a deliberate combo. But plain "?" is only for non-input focus.
      if (e.key === "?" && (e.shiftKey || !isEditable)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow. Press <KeyCap label="Shift" /> <KeyCap label="?" /> anytime to reopen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {GROUPS.map(group => (
            <div key={group.label}>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{item.description}</span>
                    <span className="flex items-center gap-1 flex-shrink-0" aria-hidden>
                      {item.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-muted-foreground text-xs">+</span>}
                          <KeyCap label={k} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
