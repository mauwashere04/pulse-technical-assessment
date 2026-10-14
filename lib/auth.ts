import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma.ts";

export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(secret: string, secretHash: string): boolean {
  if (!secret || !secretHash) return false;
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(hashSecret(secret), "hex");
    b = Buffer.from(secretHash, "hex");
  } catch {
    return false;
  }
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readSecret(request: Request, bodySecret?: unknown): string | null {
  const header = request.headers.get("x-pulse-secret");
  if (typeof header === "string" && header.length > 0) return header;
  if (typeof bodySecret === "string" && bodySecret.length > 0) return bodySecret;
  return null;
}

export async function requireSession(id: string, secret: string | null) {
  if (!id || !secret) return null;
  const row = await prisma.presence.findUnique({ where: { id } });
  if (!row) return null;
  if (!secretMatches(secret, row.secretHash)) return null;
  return row;
}
