import type { Stat } from '../data/types';

export interface RollPreset {
  stat?: Stat;
  dc?: number;
  inverted?: boolean;
  who?: string;
  n?: number;
}

let preset: RollPreset = {};
let open = false;
const listeners = new Set<() => void>();
let seq = 0;

export const getRoller = () => ({ preset, open });

export function onRoller(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((f) => f());
}

/** Open the dice tray, optionally preset to a stat / DC (from a clickable check in the text). */
export function openRoller(p: RollPreset) {
  preset = { ...preset, ...p, n: ++seq };
  if (p.stat === undefined && 'stat' in p) preset.stat = undefined;
  open = true;
  emit();
}

export function setRollerOpen(v: boolean) {
  open = v;
  emit();
}

export function setPreset(p: RollPreset) {
  preset = { ...preset, ...p };
  emit();
}
