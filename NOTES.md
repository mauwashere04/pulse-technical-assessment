# Notes

## Phase 1 — Make it run

- **Dead dots never died.** The poll heartbeat ran `updateMany({ where: {} })`,
  refreshing every row on every poll — so the stale-reap delete right after it never
  found anything old enough to delete, and one person's poll kept the whole map
  "alive" forever. Scoped the heartbeat to the caller's own id. Checked by polling as
  B while A never polled again — A's dot was gone within 15s.
- **Chat text never arrived.** `sendChat` sent `{ t: "msg", text }`, but the receiver
  only accepted `t === "chat"`. Fixed with one shared codec used by both send and
  receive, checked typing both directions in two browser windows.
- **`end` never cleared `busy`/`peerId`**, and `leave` never told the partner, so the
  partner's chat stayed open against a ghost. Added `peerId`, fixed the busy
  transitions, made `leave` deliver an `end` signal to the partner first. Checked: A
  leaves, B's chat closes and B isn't stuck busy.
- **ICE candidates were flushed before the remote description was set**, so
  `addIceCandidate` threw (silently caught) and the queue was discarded — a call only
  connected on lucky signaling order. Reordered: set remote description, then flush.
  Video now connects reliably on a normal network.
- **A fake, non-empty Mapbox token fallback** hid a missing real token behind an
  opaque auth error instead of the "set your token" state. Also dropped a leftover
  ngrok host from `next.config.ts`, and the "you" pin now shows the server-stored
  offset, never the raw GPS fix.
- **Found live, post-deploy:** `video-end` stopped local tracks *before* sending the
  control message over the data channel — track removal triggers renegotiation, which
  could race the message and drop it, leaving the other side's video stuck open.
  Reordered to send first, then tear down tracks.
- **Found live, post-deploy:** the remote video during a call could grow past its box
  at wide viewports and cover the "End camera" button entirely — a classic flexbox
  gap, where a flex child's default `min-height: auto` lets its content (the video,
  sized to its native resolution) push past the space `flex-1` actually allotted it.
  Fixed by clipping that box to its given space (`min-height: 0` + `overflow: hidden`)
  so the video is always cropped to fit, never the layout stretched to fit the video.

## Phase 2 — Make it good

- Rebuilt Pulse as a night globe: Mapbox's `globe` projection with fog, Instrument
  Serif for the wordmark, Outfit everywhere else, a warm brass/orange/ink palette
  instead of generic zinc-and-emerald.
- The globe *is* the layout — chat and prompts float as glass panels over it instead
  of carving it into a smaller box.
- Chat is a 48vh bottom sheet under 768px so the globe stays visible on a phone, and
  a fixed 400px right column above that.
- Busy peers are a hollow ring, not a dimmed filled dot — reads as "in a
  conversation," not "about to disappear."
- `prefers-reduced-motion: reduce` turns off the dot pulse and the wave ripple.
- Peer dots originally used a six-color hash palette, each matched to a same-colored
  border — which erased the contrast ring and made some colors hard to spot against
  the globe. Simplified to one fixed color for every peer dot with a dark contrast
  ring always on top, after live two-browser testing surfaced the visibility gap.

## Phase 3 — Make it secure

Ranked by what I'd fix first before shipping:

1. **Unauthenticated mailbox** — the map broadcasts every peer id, and anyone who saw
   a dot could poll as that person (reading their SDP, which leaks network
   addresses), signal as them, or delete them. Fixed with a per-session secret minted
   at join, hashed at rest, timing-safe compared, sent only via a header (or a body
   field for `sendBeacon`, which can't set headers) — never in a URL or the peer list.
2. **Forged `accept`/`offer`/`end`** — a third party who knew two ids could accept a
   request that wasn't theirs or inject a fake SDP offer. Added an `Invite` row so
   only the actually-invited id can accept/decline, and required offer/answer/ice/end
   to match the live `peerId` pairing on both sides.
3. **Mailbox race** — the inbox was read then deleted in two steps, so two overlapping
   polls could both deliver the same signal. Switched to one `DELETE ... RETURNING`.
4. **No rate limiting, no security headers** — added a hashed-IP bucket for join and a
   per-session bucket for signal, plus CSP/X-Frame-Options/Referrer-Policy/
   Permissions-Policy headers.

## Phase 4 — Make it better

- **Horizon bands.** Pick how anonymous to be before entering — Close (1–3 km), City
  (10–20 km), or Coast (50–100 km). The server enforces the band; the client's choice
  is just a request.
- **Waves** — a content-free ripple at your own public dot, visible to everyone for
  12s, at most once every 8s. The payload is only `{ id, lat, lng }` — no sender id,
  no text. The "alive" half: say you're here without starting a conversation.
  Live testing showed the ripple alone (a thin 2px ring, 2.4s) was easy to miss, so
  two follow-ups: an immediate "Wave sent." toast on click, independent of the
  animation; and the sender's actual dot now blinks orange while their wave is live,
  by matching the wave's `lat`/`lng` against the current peer list on the client —
  same stored offset, read twice, no identity ever sent. A ripple marker is still the
  fallback for the rare poll tick where a brand-new peer's own dot isn't up yet.
- **Block** — a two-tap "Block them?" confirm hides that person from your map (and
  you from theirs) for the rest of the session, ends any active connection, and
  prevents them reaching you again without ever telling them they were blocked (it
  just looks like a normal decline). It doesn't survive a refresh — a new session is
  a new id, so the block resets. That's the stated trade-off of "nothing persists,"
  not a bug.
- With more time: a TURN server for strict NATs, and a way to keep a block across a
  refresh without storing anything identifying.

## Assumptions

- Neon Postgres in `ap-southeast-1` (Singapore), pooled connection, pool size 1.
- STUN only, no TURN — a documented, accepted gap.
- Mapbox `dark-v11` style with the `globe` projection.
- The database holds only disposable session data.
