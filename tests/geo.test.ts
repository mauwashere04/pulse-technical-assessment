import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPrivacyOffset, isValidLatLng } from "../lib/geo.ts";

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const earth = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

describe("applyPrivacyOffset", () => {
  it("keeps a Manila point between 1 and 3 km away", () => {
    for (let i = 0; i < 40; i++) {
      const out = applyPrivacyOffset(14.5995, 120.9842);
      const d = distanceKm(14.5995, 120.9842, out.lat, out.lng);
      assert.ok(d >= 0.95 && d <= 3.15, `distance was ${d}`);
      assert.ok(out.lat >= -90 && out.lat <= 90);
      assert.ok(out.lng >= -180 && out.lng <= 180);
    }
  });

  it("stays in range at the edge of the map", () => {
    const out = applyPrivacyOffset(89.99, 179.99);
    assert.ok(out.lat <= 90);
    assert.ok(out.lng <= 180 && out.lng >= -180);
  });

  it("honors a custom min/max km range", () => {
    for (let i = 0; i < 20; i++) {
      const out = applyPrivacyOffset(14.5995, 120.9842, 10, 20);
      const d = distanceKm(14.5995, 120.9842, out.lat, out.lng);
      assert.ok(d >= 9.5 && d <= 20.5, `distance was ${d}`);
    }
  });
});

describe("isValidLatLng", () => {
  it("rejects non-finite and out-of-range values", () => {
    assert.equal(isValidLatLng(14.6, 121), true);
    assert.equal(isValidLatLng(91, 0), false);
    assert.equal(isValidLatLng(0, 181), false);
    assert.equal(isValidLatLng(Number.NaN, 0), false);
    assert.equal(isValidLatLng("14", "121"), false);
  });
});
