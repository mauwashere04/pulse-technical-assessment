import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { horizonRange } from "../lib/horizons.ts";

describe("horizonRange", () => {
  it("maps each known horizon to its km band", () => {
    assert.deepEqual(horizonRange("close"), { minKm: 1, maxKm: 3 });
    assert.deepEqual(horizonRange("city"), { minKm: 10, maxKm: 20 });
    assert.deepEqual(horizonRange("coast"), { minKm: 50, maxKm: 100 });
  });

  it("rejects unknown or missing values", () => {
    assert.equal(horizonRange("near"), null);
    assert.equal(horizonRange(0), null);
    assert.equal(horizonRange(undefined), null);
  });
});
