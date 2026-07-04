"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Gentle install nudge for the staff pocket screen. Android/Chrome gets the
 * real install prompt; iOS Safari gets the Share → Add to Home Screen tip.
 * Hidden once running standalone (already installed).
 */
export function InstallHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"none" | "android" | "ios">("none");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari legacy flag
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setPlatform("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === "none") return null;

  return (
    <div className="mt-4 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-center">
      {platform === "android" && prompt ? (
        <button
          type="button"
          onClick={() => void prompt.prompt()}
          className="text-sm font-semibold text-ink hover:underline"
        >
          ⬇ Install HUBz Loyalty on this phone
        </button>
      ) : (
        <p className="text-xs text-ink-faint">
          Keep it one tap away: <span className="font-medium text-ink">Share</span>{" "}
          → <span className="font-medium text-ink">Add to Home Screen</span>
        </p>
      )}
    </div>
  );
}
