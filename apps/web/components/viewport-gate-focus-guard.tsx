"use client";

import { useEffect } from "react";

const VIEWPORT_GATE_MQ = "(max-width: 1279px), (max-height: 719px)";

/**
 * When the CSS viewport gate hides `.app-shell-root`, move focus out of the
 * display:none subtree so keyboard users are not stranded.
 */
export function ViewportGateFocusGuard() {
  useEffect(() => {
    const mql = window.matchMedia(VIEWPORT_GATE_MQ);

    function rescueFocus() {
      if (!mql.matches) return;
      const shell = document.querySelector(".app-shell-root");
      const active = document.activeElement;
      if (!(shell instanceof HTMLElement) || !(active instanceof Node)) return;
      if (!shell.contains(active)) return;

      const gate = document.querySelector(".min-viewport-gate");
      if (gate instanceof HTMLElement) {
        gate.focus();
        return;
      }
      if (document.body instanceof HTMLElement) {
        document.body.focus();
      }
    }

    rescueFocus();
    mql.addEventListener("change", rescueFocus);
    return () => mql.removeEventListener("change", rescueFocus);
  }, []);

  return null;
}
