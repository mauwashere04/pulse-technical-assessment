import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodePeerMessage, encodeChat, encodeControl } from "../lib/peer-messages.ts";

describe("peer messages", () => {
  it("round-trips a chat line as type chat", () => {
    const decoded = decodePeerMessage(encodeChat("hello"));
    assert.deepEqual(decoded, { kind: "chat", text: "hello" });
    assert.equal(JSON.parse(encodeChat("hello")).t, "chat");
  });

  it("truncates chat to 500 characters", () => {
    const decoded = decodePeerMessage(encodeChat("a".repeat(800)));
    assert.equal(decoded?.kind, "chat");
    if (decoded?.kind === "chat") assert.equal(decoded.text.length, 500);
  });

  it("round-trips video controls and drops junk", () => {
    assert.deepEqual(decodePeerMessage(encodeControl("video-end")), {
      kind: "ctrl",
      ctrl: "video-end",
    });
    assert.equal(decodePeerMessage("not-json"), null);
    assert.equal(decodePeerMessage(JSON.stringify({ t: "msg", text: "nope" })), null);
    assert.equal(decodePeerMessage(JSON.stringify({ t: "ctrl", ctrl: "nope" })), null);
  });
});
