"use client";

import { useEffect, useRef } from "react";
import { BOOKMARKLET_HREF } from "@/lib/bookmarklet";

const ROSE = "#c8535a";

type Props = {
  label?: string;
  size?: "sm" | "md";
};

export default function BookmarkletDragButton({
  label = "★ Save to Seoulful",
  size = "md",
}: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // React 19 sanitizes javascript: URLs out of href props. Setting the
  // attribute imperatively after mount bypasses that, so dragging the
  // anchor to the bookmarks bar captures the real bookmarklet code.
  useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute("href", BOOKMARKLET_HREF);
    }
  }, []);

  const padding =
    size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3 text-base";

  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      ref={linkRef}
      href="#"
      onClick={(e) => {
        // Don't fire the bookmarklet on the install page itself — we want
        // users to drag it to their bookmarks bar, not run it here.
        e.preventDefault();
      }}
      draggable
      className={`inline-block rounded-lg font-semibold cursor-grab select-none ${padding}`}
      style={{ background: ROSE, color: "#fff", textDecoration: "none" }}
    >
      {label}
    </a>
  );
}
