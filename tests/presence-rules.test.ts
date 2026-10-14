import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heartbeatFilter } from "../lib/presence-rules.ts";

describe("heartbeatFilter", () => {
  it("names only the caller, never an empty filter", () => {
    assert.deepEqual(heartbeatFilter("6f1c1c3e-9a0b-4c2d-8e11-0a1b2c3d4e5f"), {
      id: "6f1c1c3e-9a0b-4c2d-8e11-0a1b2c3d4e5f",
    });
  });
});
