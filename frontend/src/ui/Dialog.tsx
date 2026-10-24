/**
 * ui/Dialog.tsx — a modal dialog primitive (R13).
 *
 * Focus is trapped while open; Escape closes (when `dismissible`). Labelled by
 * its heading via aria-labelledby. The critical dialog composes this but opts
 * out of Escape/backdrop dismissal.
 */
import { useEffect, useRef, type ReactNode } from "react";
import "./ui.css";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  describedBy?: string;
  dismissible?: boolean;
  ariaLive?: "off" | "polite" | "assertive";
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  dismissible = true,
  ariaLive = "off",
  children,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      if (!node) return [];
      return Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    // Move focus into the dialog on open.
    const first = focusables()[0];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="dialog-backdrop"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-live={ariaLive === "off" ? undefined : ariaLive}
      >
        {children}
      </div>
    </>
  );
}
