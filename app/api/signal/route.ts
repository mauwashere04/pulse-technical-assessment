import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSecret, requireSession } from "@/lib/auth";
import { hitRateLimit } from "@/lib/rate-limit";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time, and rejects any
// transition the sender isn't authorized to make (forged accept/offer/etc).
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { fromId, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof fromId !== "string" || typeof toId !== "string") {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const secret = readSecret(request);
  const sender = await requireSession(fromId, secret);
  if (!sender) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (await hitRateLimit(`signal:${fromId}`, 40, 10_000)) {
    return Response.json({ error: "slow down" }, { status: 429 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;

  if (signalType === "request") {
    const target = await prisma.presence.findUnique({
      where: { id: toId },
    });
    if (
      !target ||
      target.busy ||
      target.peerId ||
      sender.busy ||
      sender.peerId
    ) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }

    await prisma.invite.upsert({
      where: { fromId_toId: { fromId, toId } },
      create: { fromId, toId },
      update: { createdAt: new Date() },
    });
    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
    return Response.json({ ok: true });
  }

  if (signalType === "accept") {
    const invite = await prisma.invite.findUnique({
      where: { fromId_toId: { fromId: toId, toId: fromId } },
    });
    if (!invite) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    await prisma.invite.delete({ where: { id: invite.id } });
    await prisma.presence.updateMany({
      where: { id: fromId },
      data: { busy: true, peerId: toId },
    });
    await prisma.presence.updateMany({
      where: { id: toId },
      data: { busy: true, peerId: fromId },
    });
    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
    return Response.json({ ok: true });
  }

  if (signalType === "decline") {
    const invite = await prisma.invite.findUnique({
      where: { fromId_toId: { fromId: toId, toId: fromId } },
    });
    if (!invite) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    await prisma.invite.delete({ where: { id: invite.id } });
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false, peerId: null },
    });
    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
    return Response.json({ ok: true });
  }

  if (signalType === "end") {
    const bothInvites = await prisma.invite.findMany({
      where: {
        OR: [
          { fromId, toId },
          { fromId: toId, toId: fromId },
        ],
      },
    });
    const allowed = sender.peerId === toId || bothInvites.length > 0;
    if (!allowed) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false, peerId: null },
    });
    if (bothInvites.length > 0) {
      await prisma.invite.deleteMany({
        where: { id: { in: bothInvites.map((i) => i.id) } },
      });
    }
    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
    return Response.json({ ok: true });
  }

  // offer, answer, ice
  if (typeof payloadStr !== "string" || payloadStr.length === 0) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  const target = await prisma.presence.findUnique({ where: { id: toId } });
  if (!target || sender.peerId !== toId || target.peerId !== fromId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}
