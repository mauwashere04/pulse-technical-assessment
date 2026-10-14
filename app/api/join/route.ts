import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { hashSecret, newSecret } from "@/lib/auth";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";
import { horizonRange } from "@/lib/horizons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (await hitRateLimit(`join:${clientKey(request)}`, 10, 60_000)) {
    return Response.json({ error: "slow down" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { lat, lng, horizon } = (body ?? {}) as Record<string, unknown>;
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }
  const range = horizonRange(horizon);
  if (!range) {
    return Response.json({ error: "invalid horizon" }, { status: 400 });
  }
  const offset = applyPrivacyOffset(
    lat as number,
    lng as number,
    range.minKm,
    range.maxKm,
  );
  const id = crypto.randomUUID();
  const secret = newSecret();

  try {
    await prisma.presence.create({
      data: {
        id,
        secretHash: hashSecret(secret),
        lat: offset.lat,
        lng: offset.lng,
        busy: false,
        lastSeen: new Date(),
      },
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 500 });
  }

  return Response.json({
    id,
    secret,
    lat: offset.lat,
    lng: offset.lng,
  });
}
