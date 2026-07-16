"use client";

import { useEffect } from "react";

import { shouldActivateViewportGate } from "@/lib/viewport-gate";

/**
 * JS viewport gate + focus rescue when shell is hidden.
 * Replaces CSS-only max-width/height media that false-triggered at 200% zoom.
 */
export function ViewportGateFocusGuard() {
  useEffect(() => {
    function applyGate() {
      const active = shouldActivateViewportGate({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
        },
      });

      const gate = document.querySelector(".min-viewport-gate");
      const focused = document.activeElement;

      document.documentElement.dataset.viewportGate = active
        ? "active"
        : "ok";

      if (!active) {
        if (
          gate instanceof HTMLElement &&
          focused instanceof Node &&
          gate.contains(focused)
        ) {
          const main = document.querySelector("#main-content");
          if (main instanceof HTMLElement) {
            main.focus();
          } else if (document.body instanceof HTMLElement) {
            document.body.focus();
          }
        }
        return;
      }

      const shell = document.querySelector(".app-shell-root");
      if (!(shell instanceof HTMLElement) || !(focused instanceof Node)) {
        return;
      }
      if (!shell.contains(focused)) return;

      if (gate instanceof HTMLElement) {
        gate.focus();
        return;
      }
      if (document.body instanceof HTMLElement) {
        document.body.focus();
      }
    }

    applyGate();
    window.addEventListener("resize", applyGate);
    return () => {
      window.removeEventListener("resize", applyGate);
      delete document.documentElement.dataset.viewportGate;
    };
  }, []);

  return null;
}
