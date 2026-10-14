"use client";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-6">
      <div className="pulse-glass w-full max-w-[360px] p-6 text-center text-[var(--ink)]">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)]/40"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-full bg-[var(--signal)] px-4 py-2 text-sm font-semibold text-[#1a0c08] hover:opacity-90"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
