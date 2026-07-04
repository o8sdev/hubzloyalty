"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CheckinResultCard, type CheckinResult } from "../checkin-ticket";

// Extract a business slug from a scanned QR. HUBz QRs encode …/r/[slug]; we also
// accept a bare slug for resilience.
function slugFromQr(text: string): string | null {
  const m = text.match(/\/r\/([a-z0-9][a-z0-9-]*)/i);
  if (m) return m[1].toLowerCase();
  const t = text.trim();
  if (/^[a-z0-9][a-z0-9-]{1,79}$/i.test(t)) return t.toLowerCase();
  return null;
}

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "checking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const checkIn = useCallback(
    async (slug: string) => {
      stop();
      setStatus("checking");
      try {
        const res = await fetch("/api/guest/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Could not check in");
          setStatus("error");
          return;
        }
        setResult(data as CheckinResult);
      } catch {
        setError("Network error — please try again");
        setStatus("error");
      }
    },
    [stop]
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const qr = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
    const slug = qr?.data ? slugFromQr(qr.data) : null;
    if (slug) {
      void checkIn(slug);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [checkIn]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setStatus("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setStatus("error");
      setError(
        !window.isSecureContext
          ? "The camera needs a secure (https) connection. Open the app via its https link — or use “Check in here” on a place's page."
          : "Couldn't open the camera. Check its permission and try again."
      );
    }
  }, [tick]);

  useEffect(() => () => stop(), [stop]);

  if (result) {
    return (
      <div className="space-y-3">
        <CheckinResultCard result={result} />
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setStatus("idle");
          }}
          className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper"
        >
          Scan another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {status === "scanning" ? (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            {status === "checking" ? "Checking in…" : "Camera off"}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {status === "idle" || status === "error" ? (
        <button
          type="button"
          onClick={start}
          className="mt-3 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
        >
          {status === "error" ? "Try again" : "Start camera"}
        </button>
      ) : null}

      <p className="mt-3 text-center text-xs text-ink-faint">
        Point at a HUBz QR at the counter.
      </p>
    </div>
  );
}
