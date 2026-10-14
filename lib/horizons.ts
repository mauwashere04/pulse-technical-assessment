export type Horizon = "close" | "city" | "coast";

const RANGES: Record<Horizon, { minKm: number; maxKm: number }> = {
  close: { minKm: 1, maxKm: 3 },
  city: { minKm: 10, maxKm: 20 },
  coast: { minKm: 50, maxKm: 100 },
};

export function horizonRange(
  value: unknown,
): { minKm: number; maxKm: number } | null {
  if (typeof value !== "string") return null;
  if (value !== "close" && value !== "city" && value !== "coast") return null;
  return RANGES[value];
}
