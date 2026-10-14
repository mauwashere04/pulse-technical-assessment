// The poll heartbeat must refresh one session. An empty filter refreshes
// every dot and makes stale rows immortal.
export function heartbeatFilter(sessionId: string): { id: string } {
  return { id: sessionId };
}
