// Central store. All campaign content is immutable base data; everything the DM changes
// (runtime state like HP and item states, and content edits like names and text) lives in one
// patch layer keyed by "type:id". Every view reads merged entities from here, so a single edit
// shows up everywhere at once. Undo/redo snapshots the patch layer and game state.

import { BASE_INDEX, CAMPAIGN, COLLECTION } from '../data/campaign';
import type { AnyEntity, EntityType, Stat } from '../data/types';
import type { RollResult } from './dice';

export type View = 'run' | 'story' | 'map' | 'slides' | 'cast' | 'codex' | 'rules';
export const VIEWS: { id: View; label: string; icon: string; hint: string }[] = [
  { id: 'run', label: 'Run', icon: 'clapperboard', hint: 'DM screen for the live session' },
  { id: 'story', label: 'Script', icon: 'scroll-text', hint: 'The whole campaign as an organized script' },
  { id: 'map', label: 'Map', icon: 'workflow', hint: 'Story flow, connections web and pacing chart' },
  { id: 'slides', label: 'Slides', icon: 'presentation', hint: 'A deck for the table or for prep' },
  { id: 'cast', label: 'Cast', icon: 'contact', hint: 'A profile page for every player and character' },
  { id: 'codex', label: 'Codex', icon: 'library-big', hint: 'Every character, item, ability and clue' },
  { id: 'rules', label: 'Rules', icon: 'book-open-text', hint: 'Rules reference and DM craft' },
];

export interface Combatant {
  key: string;
  type: 'pc' | 'npc';
  id: string;
  init: number;
}

export interface Combat {
  scene: string;
  /** which of the scene's encounters this is (for its round budget and how it ends) */
  enc?: number;
  label: string;
  round: number;
  turn: number;
  list: Combatant[];
}

export type MapNoteColor = 'yellow' | 'pink' | 'blue' | 'green';

/** A sticky note the DM put on the story flow map. It belongs to a scene and sits relative to it. */
export interface MapNote {
  id: string;
  text: string;
  color: MapNoteColor;
  scene: string;
  /** offset from the scene node's top left corner */
  dx: number;
  dy: number;
}

export interface Game {
  scene: string;
  route: 'plane' | 'boat' | null;
  catVariant: boolean;
  costelloAsked: number;
  combat: Combat | null;
  timer: { running: boolean; since: number | null; spent: Record<string, number> };
  notes: string;
  applied: Record<string, boolean>;
  sinOrder: string[];
  /** story flow map: where the DM dragged scenes, per layout (h: left to right, v: top to bottom) */
  mapPos: { h: Record<string, { x: number; y: number }>; v: Record<string, { x: number; y: number }> };
  mapNotes: MapNote[];
  /** when each player last had the spotlight (ms since epoch) */
  spotlight: Record<string, number>;
}

export interface LogEntry {
  id: string;
  t: number;
  kind: 'roll' | 'event';
  text: string;
  roll?: RollResult;
}

export interface SaveData {
  v: 1;
  patches: Record<string, Record<string, unknown>>;
  created: Record<string, AnyEntity>;
  game: Game;
  log: LogEntry[];
  savedAt: number;
}

export interface Toast {
  id: string;
  text: string;
  tone?: 'good' | 'bad' | 'gold' | 'info';
  /** the history entry this toast reports; its Undo button only shows while that entry is the latest */
  undoId?: number;
  big?: boolean;
}

export type ModalSpec =
  | { kind: 'confirm'; title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => void }
  | { kind: 'export' }
  | { kind: 'import' }
  | { kind: 'settings' }
  | { kind: 'history' }
  | { kind: 'shortcuts' }
  | { kind: 'encounter'; scene: string; index: number }
  | { kind: 'reveal'; title: string; body: string }
  | { kind: 'recap' };

export interface DrawerSpec {
  type: EntityType;
  id: string;
  tab: 'info' | 'edit' | 'links';
}

export interface Prefs {
  view: View;
  edit: boolean;
  shield: boolean;
  theme: 'system' | 'light' | 'dark';
  mapMode: 'flow' | 'web' | 'timeline';
  mapVertical: boolean | null;
  webFilter: string[];
  deck: 'table' | 'dm';
  presenter: boolean;
  codexTab: string;
  rulesGroup: string;
  diceMode: 'normal' | 'adv' | 'dis';
}

export interface UiState extends Prefs {
  drawer: DrawerSpec | null;
  modal: ModalSpec | null;
  palette: boolean;
  toasts: Toast[];
  slide: number;
  lastRoll: RollResult | null;
  focusScene: string | null;
  /** an entity key ('npc:lou') the connections web should select when it next renders */
  webFocus: string | null;
  /** the profile page open in the Cast view ('npc:lou'), or null for the gallery */
  castFocus: string | null;
  /** dialogue lines marked as said this session ('lou␟line text'); not saved */
  said: Record<string, true>;
}

// ─── defaults ──────────────────────────────────────────────────────────────

export const defaultGame = (): Game => ({
  scene: 'prologue',
  route: null,
  catVariant: false,
  costelloAsked: 0,
  combat: null,
  timer: { running: false, since: null, spent: {} },
  notes: '',
  applied: {},
  sinOrder: [],
  mapPos: { h: {}, v: {} },
  mapNotes: [],
  spotlight: {},
});

export const defaultData = (): SaveData => ({ v: 1, patches: {}, created: {}, game: defaultGame(), log: [], savedAt: 0 });

export const defaultPrefs = (): Prefs => ({
  view: 'run',
  edit: false,
  shield: false,
  theme: 'system',
  mapMode: 'flow',
  mapVertical: null,
  webFilter: ['pc', 'npc', 'film'],
  deck: 'table',
  presenter: false,
  codexTab: 'party',
  rulesGroup: 'all',
  diceMode: 'normal',
});

// ─── state ─────────────────────────────────────────────────────────────────

let data: SaveData = defaultData();
let ui: UiState = {
  ...defaultPrefs(),
  drawer: null,
  modal: null,
  palette: false,
  toasts: [],
  slide: 0,
  lastRoll: null,
  focusScene: null,
  webFocus: null,
  castFocus: null,
  said: {},
};
let dataVersion = 0;
let uiVersion = 0;

const listeners = new Set<() => void>();
const dataListeners = new Set<(d: SaveData) => void>();
const prefListeners = new Set<(p: Prefs) => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function onDataChange(fn: (d: SaveData) => void): () => void {
  dataListeners.add(fn);
  return () => dataListeners.delete(fn);
}
export function onPrefsChange(fn: (p: Prefs) => void): () => void {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

let emitQueued = false;
function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => {
    emitQueued = false;
    listeners.forEach((f) => f());
  });
}

export const getData = () => data;
export const getUi = () => ui;
export const getVersion = () => dataVersion * 100000 + uiVersion;
export const getDataVersion = () => dataVersion;
export const game = () => data.game;

function dataChanged() {
  dataVersion++;
  data.savedAt = Date.now();
  dataListeners.forEach((f) => f(data));
  emit();
}

function prefsOf(u: UiState): Prefs {
  const p = defaultPrefs();
  (Object.keys(p) as (keyof Prefs)[]).forEach((k) => ((p as any)[k] = (u as any)[k]));
  return p;
}

export function setUi(patch: Partial<UiState>) {
  ui = { ...ui, ...patch };
  uiVersion++;
  const prefKeys = Object.keys(defaultPrefs());
  if (Object.keys(patch).some((k) => prefKeys.includes(k))) prefListeners.forEach((f) => f(prefsOf(ui)));
  emit();
}

// ─── merged entity access ─────────────────────────────────────────────────

let mergedFor = -1;
let merged: Record<string, AnyEntity> = {};
let lists: Partial<Record<EntityType, AnyEntity[]>> = {};

function rebuild() {
  if (mergedFor === dataVersion) return;
  merged = {};
  lists = {};
  for (const [key, base] of Object.entries(BASE_INDEX)) {
    const p = data.patches[key];
    merged[key] = p ? ({ ...base, ...p } as AnyEntity) : base;
  }
  for (const [key, ent] of Object.entries(data.created)) {
    const p = data.patches[key];
    merged[key] = p ? ({ ...ent, ...p } as AnyEntity) : ent;
  }
  mergedFor = dataVersion;
}

export function ent<T extends AnyEntity = AnyEntity>(type: EntityType, id: string): T | undefined {
  rebuild();
  return merged[`${type}:${id}`] as T | undefined;
}

export function all<T extends AnyEntity = AnyEntity>(type: EntityType): T[] {
  rebuild();
  if (!lists[type]) {
    const base = (CAMPAIGN[COLLECTION[type]] as AnyEntity[]).map((e) => merged[`${type}:${e.id}`]);
    const extra = Object.keys(data.created)
      .filter((k) => k.startsWith(type + ':'))
      .map((k) => merged[k]);
    lists[type] = [...base, ...extra];
  }
  return lists[type] as T[];
}

export function baseOf<T extends AnyEntity = AnyEntity>(type: EntityType, id: string): T | undefined {
  return (BASE_INDEX[`${type}:${id}`] ?? data.created[`${type}:${id}`]) as T | undefined;
}

export function isPatched(type: EntityType, id: string, field?: string): boolean {
  const p = data.patches[`${type}:${id}`];
  if (!p) return false;
  return field ? field in p : Object.keys(p).length > 0;
}

export function isCustom(type: EntityType, id: string) {
  return `${type}:${id}` in data.created;
}

// ─── mutation with undo ───────────────────────────────────────────────────

interface UndoEntry {
  id: number;
  label: string;
  snap: string;
  t: number;
  coalesce?: string;
}

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];
const UNDO_LIMIT = 150;
let undoSeq = 0;
/** id of the change an Undo would revert right now */
export const latestUndoId = () => undoStack[undoStack.length - 1]?.id;

const snapshot = () => JSON.stringify({ patches: data.patches, created: data.created, game: data.game });
function restore(snap: string) {
  const s = JSON.parse(snap);
  data = { ...data, patches: s.patches, created: s.created, game: s.game };
}

export const undoInfo = () => ({
  canUndo: undoStack.length > 0,
  canRedo: redoStack.length > 0,
  undoLabel: undoStack[undoStack.length - 1]?.label,
  redoLabel: redoStack[redoStack.length - 1]?.label,
  history: [...undoStack].reverse().map((e) => ({ label: e.label, t: e.t })),
});

export interface MutateOpts {
  /** merge with the previous undo entry if it has the same key and is recent */
  coalesce?: string;
  /** show a toast with an Undo button */
  toast?: boolean | 'gold' | 'good' | 'bad';
  /** add a line to the session log */
  log?: boolean;
}

export function mutate(labelOrFn: string | (() => string), fn: (d: SaveData) => void, opts: MutateOpts = {}) {
  const before = snapshot();
  fn(data);
  const after = snapshot();
  if (after === before) return;
  const label = typeof labelOrFn === 'function' ? labelOrFn() : labelOrFn;
  const top = undoStack[undoStack.length - 1];
  const now = Date.now();
  if (opts.coalesce && top && top.coalesce === opts.coalesce && now - top.t < 2500) {
    top.label = label;
    top.t = now;
  } else {
    undoStack.push({ id: ++undoSeq, label, snap: before, t: now, coalesce: opts.coalesce });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  redoStack.length = 0;
  if (opts.log) pushLog({ kind: 'event', text: label });
  dataChanged();
  if (opts.toast) toast(label, { undoId: latestUndoId(), tone: typeof opts.toast === 'string' ? (opts.toast as Toast['tone']) : undefined });
}

export function undo(steps = 1) {
  let label = '';
  for (let i = 0; i < steps && undoStack.length; i++) {
    const e = undoStack.pop()!;
    redoStack.push({ id: e.id, label: e.label, snap: snapshot(), t: Date.now() });
    restore(e.snap);
    label = e.label;
  }
  if (!label) return;
  dataChanged();
  toast(`Undid: ${label}`, { tone: 'info' });
}

export function redo() {
  const e = redoStack.pop();
  if (!e) return;
  undoStack.push({ id: e.id, label: e.label, snap: snapshot(), t: Date.now() });
  restore(e.snap);
  dataChanged();
  toast(`Redid: ${e.label}`, { tone: 'info' });
}

/** Replace all saved data (import, reset, remote load). Clears undo history. */
export function replaceData(next: SaveData, opts: { keepUndo?: boolean; label?: string } = {}) {
  if (opts.keepUndo) undoStack.push({ id: ++undoSeq, label: opts.label ?? 'Replace data', snap: snapshot(), t: Date.now() });
  else undoStack.length = 0;
  redoStack.length = 0;
  data = normalize(next);
  dataChanged();
}

/** Entities renamed since earlier versions (old key → new key), so older saves keep their edits. */
const RENAMED: [string, string][] = [
  ['npc:narrator', 'npc:norton'],
  ['item:donuts', 'item:bagels'],
  ['rule:donut-rule', 'rule:bagel-rule'],
];

/** Rewrites renamed ids in saved edits and game state: patch keys, [[links]] and plain id values (holders, combatants). */
function renameIds<T>(value: T): T {
  if (value == null) return value;
  let s = JSON.stringify(value);
  for (const [from, to] of RENAMED) {
    const oldId = from.slice(from.indexOf(':') + 1);
    const newId = to.slice(to.indexOf(':') + 1);
    s = s.split(`"${from}"`).join(`"${to}"`).split(`[[${from}`).join(`[[${to}`).split(`"${oldId}"`).join(`"${newId}"`);
  }
  return JSON.parse(s) as T;
}

export function normalize(raw: Partial<SaveData>): SaveData {
  const d = defaultData();
  const input = renameIds(raw);
  return {
    v: 1,
    patches: input.patches && typeof input.patches === 'object' ? input.patches : d.patches,
    created: input.created && typeof input.created === 'object' ? input.created : d.created,
    game: {
      ...d.game,
      ...(input.game ?? {}),
      timer: { ...d.game.timer, ...(input.game?.timer ?? {}) },
      mapPos: { h: { ...(input.game?.mapPos?.h ?? {}) }, v: { ...(input.game?.mapPos?.v ?? {}) } },
      mapNotes: Array.isArray(input.game?.mapNotes) ? input.game!.mapNotes : [],
    },
    log: Array.isArray(input.log) ? input.log.slice(-300) : [],
    savedAt: typeof input.savedAt === 'number' ? input.savedAt : 0,
  };
}

/** Load without touching undo history or the savedAt stamp (boot). */
export function loadData(next: SaveData) {
  data = normalize(next);
  dataVersion++;
  emit();
}

// ─── patches ──────────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Write fields into an entity's patch, pruning fields that match the original. */
export function writePatch(d: SaveData, type: EntityType, id: string, fields: Record<string, unknown>) {
  const key = `${type}:${id}`;
  const base = (BASE_INDEX[key] ?? d.created[key]) as unknown as Record<string, unknown> | undefined;
  if (!base) return;
  const p = { ...(d.patches[key] ?? {}) };
  for (const [k, v] of Object.entries(fields)) {
    if (same(base[k], v)) delete p[k];
    else p[k] = v;
  }
  if (Object.keys(p).length) d.patches = { ...d.patches, [key]: p };
  else {
    const { [key]: _drop, ...rest } = d.patches;
    d.patches = rest;
  }
}

export function patch(type: EntityType, id: string, fields: Record<string, unknown>, label: string, opts: MutateOpts = {}) {
  mutate(label, (d) => writePatch(d, type, id, fields), opts);
}

export function resetEntity(type: EntityType, id: string, name: string) {
  mutate(`Reset ${name} to the original`, (d) => {
    const key = `${type}:${id}`;
    const { [key]: _drop, ...rest } = d.patches;
    d.patches = rest;
  }, { toast: true });
}

export function setGame(fields: Partial<Game>, label: string, opts: MutateOpts = {}) {
  mutate(label, (d) => {
    d.game = { ...d.game, ...fields };
  }, opts);
}

// ─── log ──────────────────────────────────────────────────────────────────

let logSeq = 0;
export function pushLog(entry: Omit<LogEntry, 'id' | 't'>) {
  const e: LogEntry = { id: `l${Date.now().toString(36)}${logSeq++}`, t: Date.now(), ...entry };
  data.log = [...data.log, e].slice(-300);
  dataChanged();
}

export function clearLog() {
  data.log = [];
  dataChanged();
}

// ─── toasts ───────────────────────────────────────────────────────────────

let toastSeq = 0;
export function toast(text: string, o: { tone?: Toast['tone']; undoId?: number; big?: boolean; ms?: number } = {}) {
  const t: Toast = { id: `t${toastSeq++}`, text, tone: o.tone, undoId: o.undoId, big: o.big };
  // a coalesced change (e.g. tapping HP down repeatedly) replaces its own toast instead of stacking
  const rest = ui.toasts.filter((x) => o.undoId == null || x.undoId !== o.undoId);
  setUi({ toasts: [...rest.slice(-2), t] });
  setTimeout(() => dismissToast(t.id), o.ms ?? (o.big ? 6000 : o.undoId != null ? 5000 : 3200));
}

export function dismissToast(id: string) {
  if (!ui.toasts.some((t) => t.id === id)) return;
  setUi({ toasts: ui.toasts.filter((t) => t.id !== id) });
}

// ─── UI helpers ───────────────────────────────────────────────────────────

export function openDrawer(type: EntityType, id: string, tab?: DrawerSpec['tab']) {
  setUi({ drawer: { type, id, tab: tab ?? (ui.edit ? 'edit' : 'info') }, palette: false });
}
export const closeDrawer = () => setUi({ drawer: null });
/** Open a player's or character's full profile page in the Cast view. */
export function openProfile(type: 'pc' | 'npc', id: string) {
  setUi({ view: 'cast', castFocus: `${type}:${id}`, drawer: null, palette: false });
}
export const openModal = (modal: ModalSpec) => setUi({ modal, palette: false });
export const closeModal = () => setUi({ modal: null });

export function confirmThen(title: string, body: string, confirm: string, onConfirm: () => void, danger = false) {
  openModal({ kind: 'confirm', title, body, confirm, danger, onConfirm });
}

export function go(view: View) {
  // picking Cast again from a profile page goes back to the gallery
  setUi({ view, palette: false, ...(view === 'cast' && ui.view === 'cast' ? { castFocus: null } : {}) });
}

export function lastRoll(r: RollResult, logIt = true) {
  setUi({ lastRoll: r });
  if (logIt) pushLog({ kind: 'roll', text: r.label, roll: r });
}

/** Reset everything back to the campaign as written. */
export function resetAll() {
  replaceData(defaultData());
  toast('Reset to the campaign as written. Your previous state is gone.', { tone: 'info' });
}

export type { Stat };
