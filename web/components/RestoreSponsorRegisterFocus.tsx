"use client";

import { useEffect } from "react";

export function RestoreSponsorRegisterFocus() {
  useEffect(() => {
    const awardId = new URLSearchParams(window.location.search).get("focus");
    const heading = document.getElementById("sponsor-register-title");
    if (!awardId) {
      if (window.location.hash.startsWith("#award-") && heading) {
        heading.focus();
      }
      return;
    }

    if (awardId === "heading") {
      heading?.focus();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLElement>("[data-award-open]"),
      );
      const target = links.find(
        (link) => link.dataset.awardOpen === awardId && link.getClientRects().length > 0,
      );
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center", behavior: "auto" });
      } else {
        heading?.focus();
        heading?.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
