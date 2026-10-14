// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";
import type { Horizon } from "@/lib/horizons";

export async function join(
  lat: number,
  lng: number,
  horizon: Horizon,
): Promise<{ id: string; secret: string; lat: number; lng: number }> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, horizon }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  const data = (await res.json()) as {
    id?: unknown;
    secret?: unknown;
    lat?: unknown;
    lng?: unknown;
  };
  if (
    typeof data.id !== "string" ||
    typeof data.secret !== "string" ||
    typeof data.lat !== "number" ||
    typeof data.lng !== "number"
  ) {
    throw new Error("join failed: missing session");
  }
  return { id: data.id, secret: data.secret, lat: data.lat, lng: data.lng };
}

export async function poll(id: string, secret: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { "x-pulse-secret": secret },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  secret: string,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulse-secret": secret,
    },
    body: JSON.stringify({ fromId, toId, type, payload }),
  });
}

export async function wave(id: string, secret: string): Promise<boolean> {
  const res = await fetch("/api/wave", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulse-secret": secret,
    },
    body: JSON.stringify({ id }),
  });
  return res.ok;
}

export async function block(id: string, secret: string, blockedId: string): Promise<void> {
  await fetch("/api/block", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulse-secret": secret,
    },
    body: JSON.stringify({ id, blockedId }),
  });
}

// Fire-and-forget leave that survives the tab closing.
export function leave(id: string, secret: string): void {
  const body = JSON.stringify({ id, secret });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon("/api/leave", blob);
    if (sent) return;
  }
  void fetch("/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
