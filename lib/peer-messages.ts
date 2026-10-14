export type PeerControl =
  | "video-request"
  | "video-accept"
  | "video-decline"
  | "video-end";

const CONTROLS: readonly PeerControl[] = [
  "video-request",
  "video-accept",
  "video-decline",
  "video-end",
];

function isControl(value: string): value is PeerControl {
  return (CONTROLS as readonly string[]).includes(value);
}

export function encodeChat(text: string): string {
  return JSON.stringify({ t: "chat", text: text.slice(0, 500) });
}

export function encodeControl(ctrl: PeerControl): string {
  return JSON.stringify({ t: "ctrl", ctrl });
}

export function decodePeerMessage(
  raw: string,
): { kind: "chat"; text: string } | { kind: "ctrl"; ctrl: PeerControl } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const msg = parsed as Record<string, unknown>;
  if (msg.t === "chat" && typeof msg.text === "string") {
    return { kind: "chat", text: msg.text.slice(0, 500) };
  }
  if (msg.t === "ctrl" && typeof msg.ctrl === "string" && isControl(msg.ctrl)) {
    return { kind: "ctrl", ctrl: msg.ctrl };
  }
  return null;
}
