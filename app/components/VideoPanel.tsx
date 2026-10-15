"use client";

import { useEffect, useRef } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Remote (full bleed) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full bg-[var(--bg)] object-cover"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)]">
            Waiting for their camera…
          </div>
        )}
        {/* Local (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-20 right-4 h-[160px] w-[112px] rounded-lg border border-[var(--line)] bg-[var(--bg)] object-cover"
        />
      </div>
      <div className="flex justify-center bg-[var(--bg)] p-4">
        <button
          onClick={onEnd}
          className="rounded-full bg-[var(--danger)] px-8 py-3 font-semibold text-white hover:opacity-90"
        >
          End camera
        </button>
      </div>
    </div>
  );
}
