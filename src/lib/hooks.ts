import { useEffect, useRef, useState } from "react";
import { getJSON } from "./api";

// One request per URL at a time, and the last answer is shared, so several components can poll the same endpoint.
const inflight = new Map<string, Promise<unknown>>();
const last = new Map<string, { at: number; v: unknown }>();
function shared<T>(url: string): Promise<T> {
  const hit = last.get(url);
  if (hit && Date.now() - hit.at < 4000) return Promise.resolve(hit.v as T);
  let p = inflight.get(url) as Promise<T> | undefined;
  if (!p) {
    p = getJSON<T>(url)
      .then((v) => {
        last.set(url, { at: Date.now(), v });
        return v;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

// Polls a JSON endpoint. Keeps the last good value while a refresh is in flight.
export function usePoll<T>(url: string | null, everyMs = 15_000) {
  const [data, setData] = useState<T | null>(() => (url ? ((last.get(url)?.v as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const urlRef = useRef(url);
  urlRef.current = url;
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    const load = () =>
      shared<T>(url)
        .then((d) => {
          if (!alive || urlRef.current !== url) return;
          setData(d);
          setError(null);
        })
        .catch((e) => alive && setError(String(e?.message || e)))
        .finally(() => alive && setLoading(false));
    load();
    const t = everyMs > 0 ? setInterval(load, everyMs) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [url, everyMs]);
  return { data, error, loading };
}

export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    window.setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400);
  };
  return { copied, copy };
}
