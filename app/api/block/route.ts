import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSecret, requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/block — body { id, blockedId }. Hides blockedId from id for the
// rest of this session: no report flow, no moderation inbox, just a mutual
// hide that ends when the blocker's session ends.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, blockedId } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || typeof blockedId !== "string") {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (!UUID_RE.test(blockedId) || blockedId === id) {
    return Response.json({ error: "invalid blockedId" }, { status: 400 });
  }

  const secret = readSecret(request);
  const session = await requireSession(id, secret);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: id, blockedId } },
    create: { blockerId: id, blockedId },
    update: {},
  });

  if (session.peerId === blockedId) {
    await prisma.presence.updateMany({
      where: { id: { in: [id, blockedId] } },
      data: { busy: false, peerId: null },
    });
    await prisma.signal.create({
      data: { fromId: id, toId: blockedId, type: "end", payload: null },
    });
  }

  await prisma.invite.deleteMany({
    where: {
      OR: [
        { fromId: id, toId: blockedId },
        { fromId: blockedId, toId: id },
      ],
    },
  });

  return Response.json({ ok: true });
}
