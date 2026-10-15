import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS, WAVE_TTL_MS } from "@/lib/presence";
import { heartbeatFilter } from "@/lib/presence-rules";
import { readSecret, requireSession } from "@/lib/auth";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll?id= — the single endpoint that drives the live map.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const secret = readSecret(request);
  const session = id ? await requireSession(id, secret) : null;
  if (!id || !session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);
  const waveCutoff = new Date(now - WAVE_TTL_MS);

  // 1) Heartbeat — refresh lastSeen for the caller.
  await prisma.presence.updateMany({
    where: heartbeatFilter(id),
    data: { lastSeen: new Date(now) },
  });

  // 2) Reap stale presence rows and orphaned signals (independent deletes —
  // no atomicity needed, and avoids transactions over a PgBouncer pooler).
  await prisma.presence.deleteMany({ where: { lastSeen: { lt: staleCutoff } } });
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });
  await prisma.wave.deleteMany({ where: { createdAt: { lt: waveCutoff } } });

  // 3) Online peers, excluding self and anyone blocked in either direction.
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: id }, { blockedId: id }] },
    select: { blockerId: true, blockedId: true },
  });
  const hidden = new Set<string>();
  for (const b of blocks) {
    hidden.add(b.blockerId === id ? b.blockedId : b.blockerId);
  }

  const peers = await prisma.presence.findMany({
    where: {
      id: { notIn: [id, ...hidden] },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, busy: true, peerId: true },
  });

  // 4) Drain this user's mailbox in one statement, so two overlapping polls
  // can never both deliver the same signal.
  const inbox = await prisma.$queryRaw<
    {
      id: string;
      fromId: string;
      toId: string;
      type: string;
      payload: string | null;
      createdAt: Date;
    }[]
  >`
    DELETE FROM "Signal"
    WHERE "id" IN (
      SELECT "id" FROM "Signal"
      WHERE "toId" = ${id}
      ORDER BY "createdAt" ASC
    )
    RETURNING "id", "fromId", "toId", "type", "payload", "createdAt"
  `;

  const waves = await prisma.wave.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, lat: true, lng: true },
  });

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
      peerId: p.peerId,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: new Date(s.createdAt).toISOString(),
    })),
    waves,
  };

  return Response.json(response);
}
