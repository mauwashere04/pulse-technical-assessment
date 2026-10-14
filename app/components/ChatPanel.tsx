"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onBlock,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onBlock: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [blockArmed, setBlockArmed] = useState(false);
  const blockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function handleBlockClick() {
    if (blockArmed) {
      if (blockTimer.current) clearTimeout(blockTimer.current);
      setBlockArmed(false);
      onBlock();
      return;
    }
    setBlockArmed(true);
    blockTimer.current = setTimeout(() => setBlockArmed(false), 3_000);
  }

  useEffect(() => {
    return () => {
      if (blockTimer.current) clearTimeout(blockTimer.current);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div
      className="pulse-glass absolute inset-x-0 bottom-0 z-20 flex h-[48vh] flex-col rounded-b-none text-[var(--ink)] md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:w-[400px] md:rounded-l-[20px] md:rounded-r-none"
    >
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="font-semibold">Stranger</p>
          <p className="text-xs text-[var(--muted)]">
            {connected ? "Connected" : "Linking…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm hover:border-[var(--ink)]/40 disabled:opacity-40"
          >
            Camera
          </button>
          <button
            onClick={handleBlockClick}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--ink)]/40"
          >
            {blockArmed ? "Block them?" : "Block"}
          </button>
          <button
            onClick={onEnd}
            className="rounded-full bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-[var(--muted)]">
            Nothing here is saved.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
              style={
                m.mine
                  ? { background: "var(--signal)", color: "#1a0c08" }
                  : {
                      background: "rgba(244, 239, 230, 0.08)",
                      color: "var(--ink)",
                    }
              }
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-[var(--line)] p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Linking…"}
          disabled={!connected}
          className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--signal)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-full bg-[var(--signal)] px-4 py-2 text-sm font-semibold text-[#1a0c08] disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
