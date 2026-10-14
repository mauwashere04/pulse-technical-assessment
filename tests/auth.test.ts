import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashSecret, newSecret, secretMatches } from "../lib/auth.ts";

describe("session secrets", () => {
  it("matches a secret to its hash and rejects a different secret", () => {
    const secret = newSecret();
    const hash = hashSecret(secret);
    assert.equal(secretMatches(secret, hash), true);
    assert.equal(secretMatches(newSecret(), hash), false);
    assert.equal(secretMatches("", hash), false);
    assert.equal(secretMatches(secret, ""), false);
  });

  it("uses a long secret", () => {
    assert.ok(newSecret().length >= 40);
  });
});
