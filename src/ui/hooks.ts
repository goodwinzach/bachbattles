import { useEffect, useRef, useState } from 'preact/hooks';
import { subscribe } from '../state/store';

/** Re-render whenever the store changes. Used once, at the root. */
function useForce() {
  const [, setN] = useState(0);
  return () => setN((n) => n + 1);
}

export function useStore() {
  const force = useForce();
  useEffect(() => subscribe(force), []);
}

/** Re-render on an interval (live timers). */
export function useTick(ms: number, active = true) {
  const force = useForce();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(force, ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

export function useMedia(query: string): boolean {
  const get = () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Remember a value across renders without causing renders. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Simple persisted open/closed memory for expanders (survives re-mounts in a session). */
const openMemory = new Map<string, boolean>();
export function useOpen(id: string | undefined, initial: boolean): [boolean, (v: boolean) => void] {
  const read = () => (id && openMemory.has(id) ? openMemory.get(id)! : initial);
  const [state, setState] = useState(() => ({ id, open: read() }));
  // the same expander can be reused for another scene (another id): start from that id's own state
  const open = state.id === id ? state.open : read();
  const set = (v: boolean) => {
    if (id) openMemory.set(id, v);
    setState({ id, open: v });
  };
  return [open, set];
}

/** Broadcast "expand all / collapse all" to expanders in a group. */
type Bulk = { group: string; open: boolean; n: number };
let bulk: Bulk = { group: '', open: false, n: 0 };
const bulkListeners = new Set<() => void>();
export function setBulk(group: string, open: boolean) {
  bulk = { group, open, n: bulk.n + 1 };
  for (const key of [...openMemory.keys()]) if (key.startsWith(group + ':')) openMemory.set(key, open);
  bulkListeners.forEach((f) => f());
}
export function useBulk(id: string | undefined, onBulk: (open: boolean) => void) {
  const cb = useLatest(onBulk);
  useEffect(() => {
    if (!id) return;
    const f = () => {
      if (bulk.group && id.startsWith(bulk.group + ':')) cb.current(bulk.open);
    };
    bulkListeners.add(f);
    return () => {
      bulkListeners.delete(f);
    };
  }, [id]);
}
