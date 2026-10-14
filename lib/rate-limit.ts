import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const RETENTION_MS = 120_000;

// Hash so the raw IP is never stored, even transiently.
export function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const firstHop = forwardedFor.split(",")[0]?.trim() ?? "";
  return createHash("sha256").update(firstHop).digest("hex").slice(0, 24);
}

// Returns true when the caller is over the limit — in that case the new hit
// was NOT recorded, so a flood of rejected calls can't itself grow the table.
export async function hitRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  await prisma.rateHit.deleteMany({
    where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
  });

  const count = await prisma.rateHit.count({
    where: { bucket, createdAt: { gte: new Date(now - windowMs) } },
  });
  if (count >= limit) {
    return true;
  }

  await prisma.rateHit.create({ data: { bucket } });
  return false;
}
