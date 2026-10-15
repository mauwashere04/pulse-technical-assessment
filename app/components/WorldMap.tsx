"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot, WaveDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export default function WorldMap({
  peers,
  me,
  waves,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  waves: WaveDot[];
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const waveMarkersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the globe once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        antialias: true,
        // Open centered on the user if we know where they are, else world view.
        center: me ? [me.lng, me.lat] : [0, 12],
        zoom: me ? 2.2 : 1.35,
        attributionControl: true,
      });
      map.on("style.load", () => {
        map.setFog({
          color: "rgb(7, 8, 13)",
          "high-color": "rgb(36, 52, 74)",
          "horizon-blend": 0.12,
          "space-color": "rgb(4, 5, 10)",
          "star-intensity": 0.4,
        });
      });
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      waveMarkersRef.current.forEach((m) => m.remove());
      waveMarkersRef.current.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "You" marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `<span class="pulse-me-label">You</span><span class="pulse-me-ring"></span>`;
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.title = "Tap to connect";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        marker.getElement().classList.toggle("pulse-dot--busy", peer.busy);
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  // Reconcile wave feedback (Task 13). A wave's lat/lng is read server-side
  // straight from the same Presence row as the peer list — the exact same
  // stored offset, never recomputed — so matching on exact coordinates tells
  // us whose dot just waved without the server ever naming them: the API
  // never sends a wave's fromId, by design, to keep waves anonymous.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const matchedPeerIds = new Set<string>();
    let selfWaving = false;
    const unmatched: WaveDot[] = [];

    for (const w of waves) {
      if (me && w.lat === me.lat && w.lng === me.lng) {
        selfWaving = true;
        continue;
      }
      const peer = peers.find((p) => p.lat === w.lat && p.lng === w.lng);
      if (peer) {
        matchedPeerIds.add(peer.id);
      } else {
        unmatched.push(w);
      }
    }

    meMarkerRef.current
      ?.getElement()
      .classList.toggle("pulse-me--waving", selfWaving);
    for (const [id, marker] of markersRef.current) {
      marker
        .getElement()
        .classList.toggle("pulse-dot--waving", matchedPeerIds.has(id));
    }

    // Fallback ripple for a wave that doesn't line up with a visible dot yet
    // (e.g. the one poll tick before a brand-new peer's own marker exists).
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = waveMarkersRef.current;
      const seen = new Set<string>();

      for (const w of unmatched) {
        seen.add(w.id);
        if (markers.has(w.id)) continue;
        const el = document.createElement("div");
        el.className = "pulse-wave";
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([w.lng, w.lat])
          .addTo(map);
        markers.set(w.id, marker);
      }

      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [waves, peers, me, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[var(--bg)]" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="pulse-glass max-w-md p-4 text-sm text-[var(--ink)]">
            Set{" "}
            <code className="text-[var(--brass)]">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
            in <code>.env</code> to load the globe.
          </p>
        </div>
      )}

      {/* Online count */}
      <div className="pulse-glass absolute bottom-4 left-4 px-3 py-1.5 text-xs text-[var(--ink)]">
        {peers.length} online
      </div>
    </div>
  );
}
