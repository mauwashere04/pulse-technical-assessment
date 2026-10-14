import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSecret, requireSession } from "@/lib/auth";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wave — body { id }. Drops a content-free ripple at the caller's
// own public (already-offset) coordinates. Never trusts client-supplied
// coordinates, and never carries the sender's id to other pollers.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const secret = readSecret(request);
  const session = await requireSession(id, secret);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (await hitRateLimit(`wave:${id}`, 1, 8_000)) {
    return Response.json({ error: "slow down" }, { status: 429 });
  }

  await prisma.wave.create({
    data: { fromId: id, lat: session.lat, lng: session.lng },
  });

  return Response.json({ ok: true });
}
