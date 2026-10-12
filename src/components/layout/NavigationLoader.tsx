"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationLoader() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      showTimer.current = null;
      fallbackTimer.current = null;
    };

    const beginNavigation = (destinationPath: string) => {
      clearTimers();
      showTimer.current = setTimeout(
        () => setPendingPath(destinationPath),
        120,
      );
      fallbackTimer.current = setTimeout(() => setPendingPath(null), 15000);
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname !== window.location.pathname
      ) {
        beginNavigation(destination.pathname);
      }
    };

    const handlePopState = () => {
      if (window.location.pathname !== pathname) {
        beginNavigation(window.location.pathname);
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      clearTimers();
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  if (!pendingPath || pendingPath === pathname) return null;
  return (
    <div className="navigation-loader" role="status" aria-label="Loading page">
      <span />
    </div>
  );
}
