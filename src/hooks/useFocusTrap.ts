/**
 * useFocusTrap — tiny focus-trap hook for custom modal dialogs.
 *
 * Most of the app's modals are handwritten <div> overlays instead of the
 * shadcn/Radix Dialog primitive. Those Radix dialogs already handle focus
 * trap + Escape + return-focus correctly, but the custom ones don't. This
 * hook fills the gap without pulling in `focus-trap-react`.
 *
 * Usage:
 *   const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
 *   return isOpen && <div ref={modalRef} role="dialog" aria-modal>...</div>;
 *
 * What it does when `active === true`:
 *   1. Remembers the previously focused element.
 *   2. Moves focus into the container on mount (first focusable element).
 *   3. Intercepts Tab/Shift+Tab so focus wraps within the container.
 *   4. Calls `onEscape` when Escape is pressed.
 *   5. On unmount/deactivate, restores focus to the original element.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = ref.current;
    if (!container) return;

    // Focus the first focusable element (or the container itself)
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    const first = focusables[0];
    if (first) {
      first.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === firstEl || !container.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (activeEl === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      // Return focus to whatever had it before we opened.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, onEscape]);

  return ref;
}
