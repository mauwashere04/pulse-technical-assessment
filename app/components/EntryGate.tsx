"use client";

import { useEffect, useRef, useState } from "react";
import type { Horizon } from "@/lib/horizons";

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "close", label: "Close · 1–3 km" },
  { value: "city", label: "City · 10–20 km" },
  { value: "coast", label: "Coast · 50–100 km" },
];

export default function EntryGate({
  onReady,
  errorText,
}: {
  onReady: (lat: number, lng: number, horizon: Horizon) => void;
  errorText?: string;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [horizon, setHorizon] = useState<Horizon>("close");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only start the looping background for people who haven't asked for
  // reduced motion — otherwise leave it on its static poster frame.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    videoRef.current?.play().catch(() => {});
  }, []);

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude, horizon),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="relative min-h-full flex-1 overflow-hidden bg-[var(--bg)]">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/bg/globe-loop.mp4"
        poster="/bg/globe-poster.jpg"
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* Darkens the whole clip and goes darkest at center, so text always
          has enough contrast no matter what's happening in the footage. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(7,8,13,0.72) 0%, rgba(7,8,13,0.55) 45%, rgba(7,8,13,0.82) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center text-[var(--ink)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brass)]">
          One session. No account.
        </p>

        <h1
          className="font-serif italic text-[var(--ink)]"
          style={{ fontSize: "clamp(64px, 10vw, 120px)", lineHeight: 0.9 }}
        >
          Pulse
        </h1>

        <p className="max-w-[28rem] text-base text-[var(--muted)]">
          Strangers, as dots on a globe. Tap one. Talk. Leave, and it is gone.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHorizon(h.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                horizon === h.value
                  ? "border-[var(--brass)] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <p className="max-w-[28rem] text-xs text-[var(--muted)]">
          Close is the default. City and Coast push the public dot further out.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          className="rounded-full bg-[var(--signal)] px-7 py-3.5 text-[15px] font-semibold text-[#1a0c08] transition hover:opacity-90 disabled:opacity-60"
        >
          {status === "locating" ? "Finding a horizon…" : "Enter"}
        </button>

        {status === "error" && (
          <p className="max-w-sm text-sm text-[var(--danger)]">{error}</p>
        )}

        {errorText && (
          <p className="max-w-sm text-sm text-[var(--danger)]">{errorText}</p>
        )}

        <p className="max-w-[28rem] text-xs text-[var(--muted)]">
          Your public dot is offset from your real location. Messages and
          video stay between the two browsers.
        </p>
      </div>
    </div>
  );
}
