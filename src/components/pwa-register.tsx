"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (production only — dev builds churn chunks
 * and a SW would serve stale ones). Rendered once from the root layout.
 */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed", err);
    });
  }, []);
  return null;
}
