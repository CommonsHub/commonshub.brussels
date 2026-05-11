"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event as NostrEvent,
  type UnsignedEvent,
} from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";
import { nip73Kind } from "@/lib/nip73";

const DEFAULT_RELAYS = ["wss://relay.commonshub.brussels"];
const STORAGE_NSEC = "nostr_nsec";
const STORAGE_OUTBOX = "nostr_outbox";
const STORAGE_SENT = "nostr_sent";
const SENT_CAP = 500;
const KIND_ANNOTATION = 1111;

type OutboxItem = {
  event: NostrEvent;
  uri: string;
  attempts: number;
  lastError?: string;
};

export type Annotation = {
  uri: string;
  pubkey: string;
  createdAt: number;
  eventId: string;
  content: string;
  tagMap: Record<string, string>;
  origin: "outbox" | "sent" | "relay";
};

type NostrContextValue = {
  npub: string;
  pubkey: string;
  ready: boolean;
  outboxCount: number;
  publish: (
    uri: string,
    payload: { content?: string; tags?: Record<string, string | null | undefined> }
  ) => Promise<void>;
  watch: (uri: string) => void;
  getAnnotation: (uri: string | null | undefined) => Annotation | undefined;
  sync: () => void;
};

const NostrContext = createContext<NostrContextValue | null>(null);

function loadKeys(): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array();
  const stored = window.localStorage.getItem(STORAGE_NSEC);
  if (stored) {
    try {
      const decoded = nip19.decode(stored);
      if (decoded.type === "nsec") return decoded.data as Uint8Array;
    } catch {
      // fall through and regenerate
    }
  }
  const sk = generateSecretKey();
  window.localStorage.setItem(STORAGE_NSEC, nip19.nsecEncode(sk));
  return sk;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[nostr] failed to persist", key, err);
  }
}

function tagMapFromEvent(event: NostrEvent): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of event.tags) {
    if (t.length >= 2 && typeof t[0] === "string" && typeof t[1] === "string") {
      // single-value last-write-wins; tag-types like `t` collapse to the last one
      out[t[0]] = t[1];
    }
  }
  return out;
}

function eventUri(event: NostrEvent): string | null {
  for (const t of event.tags) {
    if (t[0] === "i" && typeof t[1] === "string") return t[1];
  }
  return null;
}

function mergeAnnotations(
  outbox: OutboxItem[],
  sent: NostrEvent[],
  relay: NostrEvent[]
): Map<string, Annotation> {
  const out = new Map<string, Annotation>();
  const accept = (uri: string, event: NostrEvent, origin: Annotation["origin"]) => {
    const existing = out.get(uri);
    if (existing && existing.createdAt >= event.created_at) return;
    out.set(uri, {
      uri,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      eventId: event.id,
      content: event.content,
      tagMap: tagMapFromEvent(event),
      origin,
    });
  };
  for (const evt of relay) {
    const uri = eventUri(evt);
    if (uri) accept(uri, evt, "relay");
  }
  for (const evt of sent) {
    const uri = eventUri(evt);
    if (uri) accept(uri, evt, "sent");
  }
  for (const item of outbox) {
    accept(item.uri, item.event, "outbox");
  }
  return out;
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [pubkey, setPubkey] = useState("");
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [sent, setSent] = useState<NostrEvent[]>([]);
  const [relayEvents, setRelayEvents] = useState<NostrEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const subIdRef = useRef<string>(
    "annot-" + Math.random().toString(36).slice(2, 10)
  );
  const watchedRef = useRef<Set<string>>(new Set());
  const okWaitersRef = useRef<Map<string, (ok: boolean, msg: string) => void>>(
    new Map()
  );
  const outboxRef = useRef<OutboxItem[]>([]);
  const sentRef = useRef<NostrEvent[]>([]);
  const subPendingRef = useRef(false);

  // ---- init keys + persisted state ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sk = loadKeys();
    setSecretKey(sk);
    setPubkey(getPublicKey(sk));
    const persistedOutbox = readJson<OutboxItem[]>(STORAGE_OUTBOX, []);
    const persistedSent = readJson<NostrEvent[]>(STORAGE_SENT, []);
    setOutbox(persistedOutbox);
    setSent(persistedSent);
    outboxRef.current = persistedOutbox;
    sentRef.current = persistedSent;
  }, []);

  useEffect(() => {
    outboxRef.current = outbox;
    writeJson(STORAGE_OUTBOX, outbox);
  }, [outbox]);
  useEffect(() => {
    sentRef.current = sent;
    writeJson(STORAGE_SENT, sent);
  }, [sent]);

  // ---- relay connection ----
  const updateSubscription = useCallback(() => {
    if (subPendingRef.current) return;
    subPendingRef.current = true;
    queueMicrotask(() => {
      subPendingRef.current = false;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const uris = Array.from(watchedRef.current);
      if (uris.length === 0) return;
      const filter = { kinds: [KIND_ANNOTATION], "#i": uris };
      ws.send(JSON.stringify(["REQ", subIdRef.current, filter]));
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pubkey) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const url = DEFAULT_RELAYS[0];

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        updateSubscription();
        // flush any outbox items now that we're online
        flushOutbox();
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (!Array.isArray(msg)) return;
          if (msg[0] === "EVENT" && msg[2]) {
            const ev = msg[2] as NostrEvent;
            setRelayEvents((prev) => {
              if (prev.some((e) => e.id === ev.id)) return prev;
              return [...prev, ev];
            });
          } else if (msg[0] === "OK") {
            const [, eventId, ok, reason] = msg;
            const waiter = okWaitersRef.current.get(eventId);
            if (waiter) {
              waiter(Boolean(ok), String(reason ?? ""));
              okWaitersRef.current.delete(eventId);
            }
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        if (closed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  // ---- publishing ----
  const sendEvent = useCallback(
    (event: NostrEvent): Promise<{ ok: boolean; reason: string }> => {
      return new Promise((resolve) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ ok: false, reason: "relay-offline" });
          return;
        }
        const timeout = setTimeout(() => {
          okWaitersRef.current.delete(event.id);
          resolve({ ok: false, reason: "timeout" });
        }, 8000);
        okWaitersRef.current.set(event.id, (ok, reason) => {
          clearTimeout(timeout);
          resolve({ ok, reason });
        });
        ws.send(JSON.stringify(["EVENT", event]));
      });
    },
    []
  );

  const flushOutbox = useCallback(async () => {
    const items = outboxRef.current;
    if (items.length === 0) return;
    for (const item of items) {
      const res = await sendEvent(item.event);
      if (res.ok) {
        setOutbox((prev) => prev.filter((i) => i.event.id !== item.event.id));
        setSent((prev) => {
          const next = [...prev, item.event];
          return next.length > SENT_CAP ? next.slice(-SENT_CAP) : next;
        });
      } else {
        setOutbox((prev) =>
          prev.map((i) =>
            i.event.id === item.event.id
              ? { ...i, attempts: i.attempts + 1, lastError: res.reason }
              : i
          )
        );
      }
    }
  }, [sendEvent]);

  const annotationsRef = useRef<Map<string, Annotation>>(new Map());

  const publish = useCallback<NostrContextValue["publish"]>(
    async (uri, payload) => {
      if (!secretKey) return;
      // Each kind:1111 event is a full snapshot of the annotation. Start from
      // whatever we already know for this URI so a partial update doesn't erase
      // tags we set in a previous event.
      const existing = annotationsRef.current.get(uri);
      const mergedTagMap: Record<string, string> = { ...(existing?.tagMap ?? {}) };
      if (payload.tags) {
        for (const [k, v] of Object.entries(payload.tags)) {
          if (v === null || v === undefined || v === "") {
            delete mergedTagMap[k];
          } else {
            mergedTagMap[k] = v;
          }
        }
      }
      const mergedContent =
        payload.content !== undefined ? payload.content : existing?.content ?? "";

      // Reserved tags first, then everything else (except i/k which we set).
      const tags: string[][] = [["i", uri], ["k", nip73Kind(uri)]];
      for (const [k, v] of Object.entries(mergedTagMap)) {
        if (k === "i" || k === "k") continue;
        tags.push([k, v]);
      }

      const unsigned: UnsignedEvent = {
        kind: KIND_ANNOTATION,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: mergedContent,
        pubkey: getPublicKey(secretKey),
      };
      const event = finalizeEvent(unsigned, secretKey);
      const item: OutboxItem = { event, uri, attempts: 0 };
      outboxRef.current = [...outboxRef.current, item];
      setOutbox(outboxRef.current);
      await flushOutbox();
    },
    [secretKey, flushOutbox]
  );

  const watch = useCallback(
    (uri: string) => {
      if (!uri) return;
      if (watchedRef.current.has(uri)) return;
      watchedRef.current.add(uri);
      updateSubscription();
    },
    [updateSubscription]
  );

  const annotations = useMemo(
    () => mergeAnnotations(outbox, sent, relayEvents),
    [outbox, sent, relayEvents]
  );
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const getAnnotation = useCallback(
    (uri: string | null | undefined) => (uri ? annotations.get(uri) : undefined),
    [annotations]
  );

  const sync = useCallback(() => {
    flushOutbox();
  }, [flushOutbox]);

  // ---- expose globals for console inspection ----
  useEffect(() => {
    if (typeof window === "undefined" || !secretKey) return;
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(pubkey);
    (window as any).nostr = {
      npub,
      nsec,
      get outbox() {
        return outboxRef.current;
      },
      get sent() {
        return sentRef.current;
      },
      relays: DEFAULT_RELAYS,
      publish,
      sync,
    };
  }, [secretKey, pubkey, publish, sync]);

  const value = useMemo<NostrContextValue>(
    () => ({
      npub: pubkey ? nip19.npubEncode(pubkey) : "",
      pubkey,
      ready: Boolean(secretKey),
      outboxCount: outbox.length,
      publish,
      watch,
      getAnnotation,
      sync,
    }),
    [pubkey, secretKey, outbox.length, publish, watch, getAnnotation, sync]
  );

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

export function useNostr(): NostrContextValue {
  const ctx = useContext(NostrContext);
  if (!ctx) {
    // Provider may not be mounted on every page; return inert defaults so
    // calling components don't have to special-case it.
    return {
      npub: "",
      pubkey: "",
      ready: false,
      outboxCount: 0,
      publish: async () => {},
      watch: () => {},
      getAnnotation: () => undefined,
      sync: () => {},
    };
  }
  return ctx;
}

export function useAnnotation(
  uri: string | null | undefined
): Annotation | undefined {
  const ctx = useContext(NostrContext);
  useEffect(() => {
    if (uri && ctx) ctx.watch(uri);
  }, [uri, ctx]);
  return ctx?.getAnnotation(uri) ?? undefined;
}
