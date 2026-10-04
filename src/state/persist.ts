// Saving. Always to this browser (localStorage). When the page runs as a claude.ai Artifact with
// the db capability, the same save also syncs to the viewer's private storage so it survives
// cleared browser data and follows them across devices.

import {
  defaultPrefs,
  getData,
  getUi,
  loadData,
  normalize,
  onDataChange,
  onPrefsChange,
  setUi,
  toast,
  type Prefs,
  type SaveData,
} from './store';

const KEY_DATA = 'orf-dm/v1/data';
const KEY_PREFS = 'orf-dm/v1/prefs';

export type SyncState = 'local' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error';
let syncState: SyncState = 'local';
const syncListeners = new Set<(s: SyncState) => void>();
export const getSyncState = () => syncState;
export function onSync(fn: (s: SyncState) => void) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}
function setSync(s: SyncState) {
  syncState = s;
  syncListeners.forEach((f) => f(s));
}

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(): Partial<Prefs> {
  const p = readLocal<Partial<Prefs>>(KEY_PREFS);
  if (!p) return {};
  const d = defaultPrefs();
  const out: Partial<Prefs> = {};
  for (const k of Object.keys(d) as (keyof Prefs)[]) if (k in p) (out as any)[k] = (p as any)[k];
  return out;
}

export function bootData(): boolean {
  const saved = readLocal<SaveData>(KEY_DATA);
  if (saved && saved.v === 1) {
    loadData(saved);
    return true;
  }
  return false;
}

let localTimer: ReturnType<typeof setTimeout> | undefined;
let remoteTimer: ReturnType<typeof setTimeout> | undefined;
let remoteRef: { set(d: Record<string, unknown>): Promise<void> } | null = null;
let remoteBusy = false;
let remotePending = false;

export function startPersistence() {
  onDataChange(() => {
    clearTimeout(localTimer);
    localTimer = setTimeout(() => writeLocal(KEY_DATA, getData()), 300);
    if (remoteRef) {
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(pushRemote, 1500);
    }
  });
  onPrefsChange((p) => writeLocal(KEY_PREFS, p));
  window.addEventListener('pagehide', () => writeLocal(KEY_DATA, getData()));
  connectRemote();
}

async function pushRemote() {
  if (!remoteRef) return;
  if (remoteBusy) {
    remotePending = true;
    return;
  }
  remoteBusy = true;
  setSync('saving');
  try {
    const d = getData();
    // account documents cap at 256 KiB: keep every edit, but only the recent end of the session log
    await remoteRef.set({ v: 1, savedAt: d.savedAt, payload: JSON.stringify({ ...d, log: d.log.slice(-120) }) });
    setSync('synced');
  } catch (e: any) {
    setSync(e?.code === 'revoked' || e?.code === 'not_granted' ? 'local' : 'error');
    if (e?.code === 'invalid_argument' || e?.code === 'revoked') remoteRef = null;
  } finally {
    remoteBusy = false;
    if (remotePending) {
      remotePending = false;
      pushRemote();
    }
  }
}

async function connectRemote() {
  const claude = (window as any).claude;
  if (!claude?.use) return;
  setSync('connecting');
  try {
    const [user, db] = await Promise.all([claude.use('user'), claude.use('db')]);
    if (!user || !db) return setSync('local');
    const id = await user.id();
    if (!id) return setSync('local');
    const ref = db.doc(`data/users/${id}/orf-dm`);
    const snap = await ref.get();
    const local = getData();
    if (snap.exists) {
      const body = snap.data() as { savedAt?: number; payload?: string };
      let remote: SaveData | null = null;
      try {
        remote = body.payload ? normalize(JSON.parse(body.payload)) : null;
      } catch {
        remote = null;
      }
      if (remote && (remote.savedAt ?? 0) > (local.savedAt ?? 0)) {
        loadData(remote);
        writeLocal(KEY_DATA, remote);
        toast('Loaded your saved game from your Claude account.', { tone: 'info' });
      }
    }
    remoteRef = ref;
    setSync('synced');
    if (!snap.exists || ((snap.data() as any)?.savedAt ?? 0) < (getData().savedAt ?? 0)) {
      if (getData().savedAt) pushRemote();
    }
  } catch {
    setSync('local');
  }
}

// ─── files ────────────────────────────────────────────────────────────────

export async function saveFile(filename: string, text: string): Promise<'saved' | 'downloaded' | 'declined' | 'failed'> {
  const claude = (window as any).claude;
  if (claude?.use) {
    try {
      const dl = await claude.use('downloads');
      if (dl) {
        await dl.save({ filename, data: text });
        return 'saved';
      }
    } catch (e: any) {
      if (e?.code === 'declined') return 'declined';
    }
  }
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export function exportText(): string {
  return JSON.stringify({ app: 'one-ring-to-rule-flynn', ...getData() }, null, 1);
}

export function parseImport(text: string): SaveData | string {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return 'That is not valid JSON. Paste the full export, starting with {.';
  }
  if (!raw || typeof raw !== 'object' || raw.v !== 1 || !raw.game || !raw.patches) {
    return 'This JSON is not a save from this console. Export one with Settings → Export.';
  }
  return normalize(raw);
}

let themeSetByUs = false;
export function applyTheme(theme: Prefs['theme']) {
  const root = document.documentElement;
  if (theme === 'system') {
    // only undo our own choice; a host page may have set data-theme itself
    if (themeSetByUs) root.removeAttribute('data-theme');
    themeSetByUs = false;
  } else {
    root.setAttribute('data-theme', theme);
    themeSetByUs = true;
  }
}

export function applyPrefs(p: Partial<Prefs>) {
  setUi(p);
  applyTheme(getUi().theme);
}
