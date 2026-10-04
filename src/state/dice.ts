import type { Stat } from '../data/types';

export interface DiceSpec {
  count: number;
  sides: number;
  mod: number;
}

export type RollMode = 'normal' | 'adv' | 'dis';

export interface RollPart {
  label: string;
  value: number;
}

export interface RollResult {
  id: string;
  t: number;
  kind: 'check' | 'dice' | 'attack' | 'damage' | 'init' | 'table';
  label: string;
  /** every die rolled, in order */
  dice: number[];
  sides: number;
  /** the d20 that counted, for checks with advantage/disadvantage */
  kept?: number;
  mode?: RollMode;
  mod: number;
  parts?: RollPart[];
  total: number;
  dc?: number;
  inverted?: boolean;
  success?: boolean;
  nat?: 1 | 20;
  who?: string;
  stat?: Stat;
  note?: string;
  tone?: 'good' | 'warn' | 'bad';
}

let seq = 0;
export const uid = (prefix = 'r') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function rollDie(sides: number): number {
  if (sides <= 1) return 1;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  // rejection sampling keeps every face equally likely
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return (buf[0] % sides) + 1;
  }
}

export function parseDice(text: string): DiceSpec | null {
  const m = text.trim().toLowerCase().replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  if (!count || !sides || count > 100 || sides > 1000) return null;
  return { count, sides, mod: m[3] ? parseInt(m[3], 10) : 0 };
}

export function formatDice(spec: DiceSpec): string {
  return `${spec.count}d${spec.sides}${spec.mod ? (spec.mod > 0 ? `+${spec.mod}` : spec.mod) : ''}`;
}

export function signed(n: number): string {
  if (n === 0) return '+0';
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Roll an arbitrary dice expression like 2d6+1. */
export function rollExpr(expr: string, label?: string, kind: RollResult['kind'] = 'dice'): RollResult | null {
  const spec = parseDice(expr);
  if (!spec) return null;
  const dice = Array.from({ length: spec.count }, () => rollDie(spec.sides));
  const total = dice.reduce((a, b) => a + b, 0) + spec.mod;
  return {
    id: uid(),
    t: Date.now(),
    kind,
    label: label ?? formatDice(spec),
    dice,
    sides: spec.sides,
    mod: spec.mod,
    total,
  };
}

/** A d20 check: d20 (with advantage/disadvantage) + modifiers, optionally against a DC. */
export function rollCheck(opts: {
  label: string;
  parts: RollPart[];
  mode?: RollMode;
  dc?: number;
  inverted?: boolean;
  kind?: RollResult['kind'];
  who?: string;
  stat?: Stat;
}): RollResult {
  const mode = opts.mode ?? 'normal';
  const dice = mode === 'normal' ? [rollDie(20)] : [rollDie(20), rollDie(20)];
  const kept = mode === 'adv' ? Math.max(...dice) : mode === 'dis' ? Math.min(...dice) : dice[0];
  const mod = opts.parts.reduce((a, p) => a + p.value, 0);
  const total = kept + mod;
  let success: boolean | undefined;
  if (opts.dc != null) {
    // inverted checks (Medusa): staying at or under 10 is safe, i.e. total < dc
    success = opts.inverted ? total < opts.dc : total >= opts.dc;
  }
  const nat = kept === 20 ? 20 : kept === 1 ? 1 : undefined;
  if (nat === 20 && opts.dc != null && !opts.inverted) success = true;
  if (nat === 1 && opts.dc != null && !opts.inverted) success = false;
  return {
    id: uid(),
    t: Date.now(),
    kind: opts.kind ?? 'check',
    label: opts.label,
    dice,
    sides: 20,
    kept,
    mode,
    mod,
    parts: opts.parts,
    total,
    dc: opts.dc,
    inverted: opts.inverted,
    success,
    nat,
    who: opts.who,
    stat: opts.stat,
  };
}
