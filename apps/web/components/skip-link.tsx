"use client";

/**
 * First focusable control in the app shell. Hidden until focused;
 * never uses display:none / visibility:hidden.
 */
export function SkipLink() {
  function onActivate(event: React.MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main-content");
    if (!main) return;
    // App Router may not move focus on hash navigation — focus explicitly.
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", "#main-content");
  }

  return (
    <a
      href="#main-content"
      className="skip-link focus-ring-chrome"
      onClick={onActivate}
    >
      پرش به محتوا
    </a>
  );
}
