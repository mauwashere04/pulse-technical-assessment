"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
  errorText,
}: {
  onReady: (lat: number, lng: number) => void;
  errorText?: string;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
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
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-[var(--bg)] p-6 text-center text-[var(--ink)]">
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
        Your public dot is offset from your real location. Messages and video
        stay between the two browsers.
      </p>
    </div>
  );
}
