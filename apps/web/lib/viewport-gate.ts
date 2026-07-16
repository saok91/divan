const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
/** Allow tiny outer vs avail mismatch (window frame / rounding). */
const AVAIL_SLACK_PX = 16;

export type ViewportMetrics = {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
  };
};

/**
 * Decide whether the desktop gate should show.
 *
 * - Genuine small window: outer below product MIN *and* clearly below usable
 *   desktop (`screen.avail*`) → gate. Maximized on a 1280×720 panel often has
 *   `outerHeight < 720` because of the OS taskbar; comparing to avail avoids
 *   false gates on the MVP reference display.
 * - Small reference display with small CSS viewport → gate.
 * - ≥1280×720 display with zoom (inner shrinks, outer stays large) → shell stays.
 */
export function shouldActivateViewportGate(win: ViewportMetrics): boolean {
  const availW = win.screen.availWidth;
  const availH = win.screen.availHeight;
  const effectiveMinW = Math.min(MIN_WIDTH, availW);
  const effectiveMinH = Math.min(MIN_HEIGHT, availH);

  const outerTooSmall =
    win.outerWidth < effectiveMinW - AVAIL_SLACK_PX ||
    win.outerHeight < effectiveMinH - AVAIL_SLACK_PX;
  if (outerTooSmall) return true;

  const screenOk =
    win.screen.width >= MIN_WIDTH && win.screen.height >= MIN_HEIGHT;
  const innerTooSmall =
    win.innerWidth < MIN_WIDTH || win.innerHeight < MIN_HEIGHT;

  if (!screenOk && innerTooSmall) return true;
  return false;
}
