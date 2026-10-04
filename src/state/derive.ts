// Derived values: effective stats, display states, scene ordering, references.

import { RELATIONS, TOKEN_TYPE } from '../data/campaign';
import { DEFAULT_PORTRAIT, PORTRAIT_SRC } from '../data/portraits';
import type {
  Ability,
  AnyEntity,
  Clue,
  Condition,
  DialogueCue,
  EntityType,
  Film,
  Item,
  ItemState,
  NPC,
  NpcStatus,
  PC,
  PcStatus,
  Rule,
  Scene,
  SceneStatus,
  Stat,
  StatBlock,
} from '../data/types';
import { STATS } from '../data/types';
import type { RollPart } from './dice';
import { all, ent, game, getData, getDataVersion, getUi } from './store';

export type Tone = 'good' | 'warn' | 'bad' | 'gold' | 'ghost' | 'stone' | 'info' | 'muted' | 'rec';

// ─── state vocabularies ───────────────────────────────────────────────────

export const ITEM_STATES: { id: ItemState; label: string; tone: Tone; hint: string }[] = [
  { id: 'held', label: 'Held', tone: 'good', hint: 'The party has it' },
  { id: 'equipped', label: 'Equipped', tone: 'gold', hint: 'Worn or in hand right now' },
  { id: 'unclaimed', label: 'Unclaimed', tone: 'muted', hint: 'Out in the world, not picked up yet' },
  { id: 'enemy', label: 'Enemy has it', tone: 'warn', hint: 'In an NPC\'s hands' },
  { id: 'missing', label: 'Missing', tone: 'bad', hint: 'Whereabouts unknown to the party' },
  { id: 'lost', label: 'Lost', tone: 'bad', hint: 'Dropped, stolen or left behind' },
  { id: 'spent', label: 'Used up', tone: 'stone', hint: 'Consumed or out of uses' },
  { id: 'destroyed', label: 'Destroyed', tone: 'stone', hint: 'Gone for good' },
];
export const itemStateInfo = (s: ItemState) => ITEM_STATES.find((x) => x.id === s) ?? ITEM_STATES[0];

export const PC_STATUSES: { id: PcStatus; label: string; tone: Tone; hint: string }[] = [
  { id: 'alive', label: 'Alive', tone: 'good', hint: 'In the fight' },
  { id: 'ghost', label: 'Ghost', tone: 'ghost', hint: 'Dead, but still playing. Needs a bagel and an improbable act.' },
  { id: 'stone', label: 'Stone', tone: 'stone', hint: 'Turned to stone by Medusa' },
  { id: 'down', label: 'Out cold', tone: 'warn', hint: 'Knocked out' },
];
export const pcStatusInfo = (s: PcStatus) => PC_STATUSES.find((x) => x.id === s) ?? PC_STATUSES[0];

export const NPC_STATUSES: { id: NpcStatus; label: string; tone: Tone }[] = [
  { id: 'unmet', label: 'Not met', tone: 'muted' },
  { id: 'present', label: 'Present', tone: 'info' },
  { id: 'friendly', label: 'Friendly', tone: 'good' },
  { id: 'hostile', label: 'Hostile', tone: 'bad' },
  { id: 'defeated', label: 'Defeated', tone: 'stone' },
  { id: 'dead', label: 'Dead', tone: 'stone' },
  { id: 'fled', label: 'Gone', tone: 'stone' },
  { id: 'stone', label: 'Stone', tone: 'stone' },
  { id: 'captured', label: 'Captured', tone: 'warn' },
];
export const npcStatusInfo = (s: NpcStatus) => NPC_STATUSES.find((x) => x.id === s) ?? NPC_STATUSES[0];

export const SCENE_STATUSES: { id: SceneStatus; label: string; tone: Tone }[] = [
  { id: 'upcoming', label: 'Upcoming', tone: 'muted' },
  { id: 'active', label: 'Now playing', tone: 'rec' },
  { id: 'done', label: 'Done', tone: 'good' },
  { id: 'skipped', label: 'Skipped', tone: 'stone' },
];

export const RECHARGE_LABEL: Record<Ability['recharge'], string> = {
  scene: 'per scene',
  fight: 'per fight',
  campaign: 'per campaign',
  turn: 'every turn',
  passive: 'passive',
  unlimited: 'unlimited',
};

export const SIDE_LABEL: Record<NPC['side'], string> = {
  ally: 'Ally',
  neutral: 'Neutral',
  foe: 'Foe',
  boss: 'Boss',
  oracle: 'Oracle',
};

export const KIND_LABEL: Record<Scene['kind'], string> = {
  narration: 'Narration',
  explore: 'Explore',
  social: 'Social',
  combat: 'Combat',
  boss: 'Boss fight',
  oracle: 'Oracle',
  decision: 'Decision',
  travel: 'Travel',
  hub: 'Hub',
  finale: 'Finale',
  epilogue: 'Epilogue',
};

export const ITEM_KIND_LABEL: Record<Item['kind'], string> = {
  mask: 'Mask',
  key: 'Key item',
  weapon: 'Weapon',
  gear: 'Gear',
  consumable: 'Consumable',
  money: 'Money',
  prop: 'Prop',
  hazard: 'Hazard',
};

// ─── names & secrecy ──────────────────────────────────────────────────────

export const shielded = () => getUi().shield;

/** The name to show for any entity, honoring the spoiler shield for unrevealed secrets. */
export function nameOf(type: EntityType, id: string): string {
  const e = ent(type, id) as any;
  if (!e) return id;
  if (type === 'item' && e.secret && !e.revealed && shielded()) return e.alias ?? 'Secret item';
  if (type === 'ability' && e.secret && !e.revealed && shielded()) return 'Secret';
  if (type === 'rule' && e.secret && shielded()) return 'DM secret';
  return e.name ?? e.title ?? id;
}

export function isSecretHidden(type: EntityType, id: string): boolean {
  const e = ent(type, id) as any;
  if (!e) return false;
  if (!shielded()) return false;
  if (type === 'item' || type === 'ability') return !!e.secret && !e.revealed;
  if (type === 'clue') return !!e.secret && !e.revealed;
  if (type === 'rule') return !!e.secret;
  return false;
}

export function holderName(holder: string): string {
  if (!holder) return 'Nobody';
  if (holder === 'party') return 'The party';
  const pc = ent<PC>('pc', holder);
  if (pc) return pc.name;
  const npc = ent<NPC>('npc', holder);
  if (npc) return npc.name;
  return holder;
}

export function holderType(holder: string): EntityType | null {
  if (ent('pc', holder)) return 'pc';
  if (ent('npc', holder)) return 'npc';
  return null;
}

// ─── stats ────────────────────────────────────────────────────────────────

export interface StatCalc {
  stat: Stat;
  base: number;
  total: number;
  parts: RollPart[];
  override?: string;
}

export function activeConditions(pc?: PC): Condition[] {
  const conds = all<Condition>('condition');
  return conds.filter((c) => (c.scope === 'party' ? c.active : !!pc && pc.effects.includes(c.id)));
}

export function maskOf(pc: PC): Item | undefined {
  if (pc.id !== 'flynn' || !pc.mask || pc.mask === 'none') return undefined;
  return ent<Item>('item', pc.mask);
}

export function isUnmasked(pc: PC) {
  return pc.id === 'flynn' && pc.mask === 'none';
}

export function statCalc(pc: PC, stat: Stat): StatCalc {
  const base = pc.stats[stat];
  const parts: RollPart[] = [];
  for (const c of activeConditions(pc)) {
    const m = c.mods?.[stat];
    if (m) parts.push({ label: c.name, value: m });
  }
  const mask = maskOf(pc);
  if (mask?.id === 'inkblot-mask' && stat === 'str') {
    parts.push({ label: 'Inkblot mask (STR becomes +4)', value: 4 - base });
  }
  let total = base + parts.reduce((a, p) => a + p.value, 0);
  let override: string | undefined;
  if (stat === 'cha' && isUnmasked(pc)) {
    const unmasked = ent<Ability>('ability', 'unmasked');
    if (!unmasked || unmasked.enabled) {
      total = 100;
      override = 'Unmasked: Charisma becomes +100';
    }
  }
  return { stat, base, total, parts, override };
}

export function allStats(pc: PC): Record<Stat, StatCalc> {
  const out = {} as Record<Stat, StatCalc>;
  for (const s of STATS) out[s] = statCalc(pc, s);
  return out;
}

export function checkParts(pc: PC, stat: Stat): RollPart[] {
  const c = statCalc(pc, stat);
  if (c.override) return [{ label: c.override, value: c.total }];
  return [{ label: `${pc.name} base`, value: c.base }, ...c.parts];
}

export function acCalc(pc: PC): { total: number; parts: RollPart[] } {
  const parts: RollPart[] = [];
  for (const it of all<Item>('item')) {
    if (it.acBonus && it.holder === pc.id && (it.state === 'held' || it.state === 'equipped')) {
      parts.push({ label: it.name, value: it.acBonus });
    }
  }
  return { total: pc.ac + parts.reduce((a, p) => a + p.value, 0), parts };
}

// ─── abilities ────────────────────────────────────────────────────────────

export type AbilityStatus = 'ready' | 'active' | 'passive' | 'spent' | 'locked' | 'disabled';

export const ABILITY_STATUS: Record<AbilityStatus, { label: string; tone: Tone }> = {
  ready: { label: 'Ready', tone: 'good' },
  active: { label: 'Active', tone: 'gold' },
  passive: { label: 'Always on', tone: 'info' },
  spent: { label: 'Spent', tone: 'stone' },
  locked: { label: 'Locked', tone: 'muted' },
  disabled: { label: 'Off', tone: 'stone' },
};

export function abilityStatus(ab: Ability): { status: AbilityStatus; why?: string; secret: boolean } {
  const secret = !!ab.secret && !ab.revealed;
  if (!ab.enabled) return { status: 'disabled', why: 'Turned off by the DM', secret };
  const owner = ent<PC>('pc', ab.owner);
  if (ab.id === 'unmasked') {
    if (owner && isUnmasked(owner)) return { status: 'active', why: 'Flynn is not wearing a mask', secret };
    return { status: 'locked', why: 'Only while Flynn wears no mask', secret };
  }
  if (ab.requires) {
    const it = ent<Item>('item', ab.requires);
    const wearing = owner?.mask === ab.requires;
    if (!it || it.state === 'lost' || it.state === 'destroyed' || it.state === 'missing') {
      return { status: 'locked', why: `${it?.name ?? 'Item'} is ${it ? itemStateInfo(it.state).label.toLowerCase() : 'gone'}`, secret };
    }
    if (!wearing) return { status: 'locked', why: `Requires wearing the ${it.name}`, secret };
    if (ab.max && ab.used >= ab.max) return { status: 'spent', why: `Used ${ab.used}/${ab.max} ${RECHARGE_LABEL[ab.recharge]}`, secret };
    return { status: ab.recharge === 'passive' ? 'active' : 'ready', why: `Wearing the ${it.name}`, secret };
  }
  if (owner && owner.status === 'ghost' && ab.id !== 'spiritual-moment') {
    // ghosts keep social abilities; physical ones are limited by the ghost rules
  }
  if (ab.max && ab.used >= ab.max) return { status: 'spent', why: `Used ${ab.used}/${ab.max} ${RECHARGE_LABEL[ab.recharge]}`, secret };
  if (ab.recharge === 'passive' || ab.recharge === 'turn') return { status: 'passive', secret };
  return { status: 'ready', secret };
}

export function usesLeft(ab: Ability): number | null {
  if (!ab.max) return null;
  return Math.max(0, ab.max - ab.used);
}

// ─── scenes ───────────────────────────────────────────────────────────────

export function sceneInPlay(s: Scene): boolean {
  const g = game();
  if (s.expandedOnly && !g.catVariant) return false;
  if (g.route === 'plane' && s.branch === 'boat') return false;
  if (g.route === 'boat' && s.branch === 'plane') return false;
  return true;
}

export function sceneStatus(s: Scene): SceneStatus {
  if (game().scene === s.id) return 'active';
  if (!sceneInPlay(s) && s.status === 'upcoming') return 'skipped';
  return s.status;
}

/** Scenes in story order that are part of this run (route + variant applied). */
export function spine(): Scene[] {
  return all<Scene>('scene').filter(sceneInPlay);
}

export function neighbors(id: string): { prev?: Scene; next?: Scene } {
  const list = spine();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return { next: list[0] };
  // next: the next scene after this one that is not done or skipped
  let next: Scene | undefined;
  for (let j = i + 1; j < list.length; j++) {
    const st = list[j].status;
    if (st !== 'done' && st !== 'skipped') {
      next = list[j];
      break;
    }
  }
  if (!next && list[i].id === 'pride') next = list.find((s) => s.id === 'gluttony');
  return { prev: list[i - 1], next };
}

export const actOf = (s: Scene) => ent<import('../data/types').Act>('act', s.act);

export function sceneMust(s: Scene): string[] {
  const out = [...(s.mustHappen ?? [])];
  if (s.variantMust) out.push(...(game().catVariant ? s.variantMust.expanded : s.variantMust.outline));
  return out;
}

export function sceneFoes(s: Scene): string[] {
  return [...new Set((s.encounters ?? []).flatMap((e) => e.foes))];
}

// ─── NPC stat blocks ──────────────────────────────────────────────────────

export function npcStat(n: NPC): StatBlock | undefined {
  if (n.phases?.length) return n.phases[Math.min(n.phase, n.phases.length - 1)]?.stat ?? n.stat;
  return n.stat;
}

export function npcMaxHp(n: NPC): number | null {
  return npcStat(n)?.hp ?? null;
}

// ─── references (backlinks) ───────────────────────────────────────────────

export interface RefHit {
  type: EntityType;
  id: string;
  field: string;
}

const TEXT_FIELDS = new Set([
  'logline', 'readAloud', 'beats', 'objective', 'mustHappen', 'variantMust', 'rolls', 'failsafes', 'tips', 'notes', 'secrets',
  'bio', 'play', 'tagline', 'role', 'look', 'personality', 'wants', 'knows', 'important', 'stat', 'phases', 'effect',
  'summary', 'mechanics', 'limits', 'examples', 'table', 'body', 'list', 'text', 'starts', 'ends', 'note',
  'dialogue', 'unknowns', 'portray', 'ifs', 'fight',
]);

let refsFor = -1;
let refIndex: Record<string, RefHit[]> = {};

function scan(value: unknown, onToken: (type: EntityType, id: string) => void) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\[\[([a-z]+):([a-z0-9-]+)/g)) {
      const t = TOKEN_TYPE[m[1]];
      if (t) onToken(t, m[2]);
    }
  } else if (Array.isArray(value)) value.forEach((v) => scan(v, onToken));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => scan(v, onToken));
}

function buildRefs() {
  if (refsFor === getDataVersion()) return;
  refIndex = {};
  const add = (target: string, hit: RefHit) => {
    const list = (refIndex[target] ??= []);
    if (!list.some((h) => h.type === hit.type && h.id === hit.id)) list.push(hit);
  };
  const types: EntityType[] = ['scene', 'pc', 'npc', 'item', 'ability', 'condition', 'clue', 'rule', 'film', 'act'];
  for (const type of types) {
    for (const e of all(type)) {
      const rec = e as unknown as Record<string, unknown>;
      for (const [field, value] of Object.entries(rec)) {
        if (!TEXT_FIELDS.has(field)) continue;
        scan(value, (t, id) => add(`${t}:${id}`, { type, id: e.id, field }));
      }
      // structural links
      if (type === 'scene') {
        const s = e as Scene;
        for (const c of s.cast ?? []) add(`npc:${c}`, { type, id: s.id, field: 'cast' });
        for (const f of sceneFoes(s)) add(`npc:${f}`, { type, id: s.id, field: 'encounters' });
        for (const l of s.loot ?? []) add(`item:${l}`, { type, id: s.id, field: 'loot' });
        for (const f of s.films ?? []) add(`film:${f}`, { type, id: s.id, field: 'films' });
      }
      if (type === 'item') {
        const it = e as Item;
        if (it.holder && it.holder !== 'party') add(`${ent('pc', it.holder) ? 'pc' : 'npc'}:${it.holder}`, { type, id: it.id, field: 'holder' });
        for (const f of it.films ?? []) add(`film:${f}`, { type, id: it.id, field: 'films' });
      }
      if (type === 'ability') {
        const ab = e as Ability;
        add(`pc:${ab.owner}`, { type, id: ab.id, field: 'owner' });
        if (ab.requires) add(`item:${ab.requires}`, { type, id: ab.id, field: 'requires' });
        for (const f of ab.films ?? []) add(`film:${f}`, { type, id: ab.id, field: 'films' });
      }
      if (type === 'npc' && (e as NPC).film) add(`film:${(e as NPC).film}`, { type, id: e.id, field: 'film' });
      if (type === 'pc') for (const f of (e as PC).films ?? []) add(`film:${f}`, { type, id: e.id, field: 'films' });
      if (type === 'rule') for (const f of (e as Rule).films ?? []) add(`film:${f}`, { type, id: e.id, field: 'films' });
      if (type === 'clue') add(`scene:${(e as Clue).source}`, { type, id: e.id, field: 'source' });
    }
  }
  refsFor = getDataVersion();
}

export function backlinks(type: EntityType, id: string): RefHit[] {
  buildRefs();
  return (refIndex[`${type}:${id}`] ?? []).filter(
    (h) => !(h.type === type && h.id === id) && !(h.field === 'film' && h.type === 'npc' && shielded() && ent<NPC>('npc', h.id)?.filmSecret),
  );
}

/** Scenes in which an NPC appears, in story order. */
export function scenesFor(type: EntityType, id: string): Scene[] {
  const hits = backlinks(type, id).filter((h) => h.type === 'scene');
  const ids = new Set(hits.map((h) => h.id));
  return all<Scene>('scene').filter((s) => ids.has(s.id));
}

// ─── portraits and sources ────────────────────────────────────────────────

/** The portrait key an entity uses: its own choice, else the default. '' when it has none. */
export function portraitKey(type: EntityType, id: string): string {
  const e = ent(type, id) as { portrait?: string } | undefined;
  if (!e) return '';
  const key = e.portrait ?? DEFAULT_PORTRAIT[`${type}:${id}`] ?? '';
  return key === 'none' ? '' : key;
}

/** Image for a player, character or item, or undefined (icon fallback). Secrets stay hidden behind the shield. */
export function portraitOf(type: EntityType, id: string): string | undefined {
  if (isSecretHidden(type, id)) return undefined;
  const key = portraitKey(type, id);
  return key ? PORTRAIT_SRC[key] : undefined;
}

export const FILM_KIND_LABEL: Record<NonNullable<Film['kind']>, string> = { film: 'Film', series: 'Series', myth: 'Myth' };

/**
 * Where a character comes from: their film or show first, then other references. Empty = an original.
 * A secret film (`filmSecret`) is left out when `hideSecret` is set, which it is behind the spoiler shield.
 */
export function sourcesOf(type: EntityType, id: string, hideSecret = shielded()): Film[] {
  const e = ent(type, id) as { film?: string; films?: string[]; filmSecret?: boolean } | undefined;
  if (!e) return [];
  const ids = [...(e.film && !(e.filmSecret && hideSecret) ? [e.film] : []), ...(e.films ?? [])];
  return [...new Set(ids)].map((f) => ent<Film>('film', f)).filter((f): f is Film => !!f);
}

/** The film that would give a character's twist away, if they have one. */
export function secretFilmOf(type: EntityType, id: string): Film | undefined {
  const e = ent(type, id) as { film?: string; filmSecret?: boolean } | undefined;
  return e?.film && e.filmSecret ? ent<Film>('film', e.film) : undefined;
}

/** A character's dialogue options, plus any of their lines that no situation uses yet ("More lines"). */
export function dialogueOf(npc: NPC): DialogueCue[] {
  const cues = (npc.dialogue ?? []).filter((c) => c.options.length);
  const used = new Set(cues.flatMap((c) => c.options.map((o) => o.trim())));
  const rest = (npc.lines ?? []).filter((l) => l.trim() && !used.has(l.trim()));
  return rest.length ? [...cues, { cue: cues.length ? 'More lines' : 'Lines', options: rest }] : cues;
}

/** The mask a character has on right now: Flynn's chosen mask, or Lou's V mask while he is in his masked phase. */
export function wornMask(type: EntityType, id: string): Item | undefined {
  if (type === 'pc' && id === 'flynn') {
    const pc = ent<PC>('pc', id);
    return pc ? maskOf(pc) : undefined;
  }
  if (type === 'npc') {
    const n = ent<NPC>('npc', id);
    if (n?.phases?.[n.phase]?.label === 'Masked') {
      const v = all<Item>('item').find((i) => i.kind === 'mask' && i.holder === id && i.state !== 'destroyed');
      return v && !isSecretHidden('item', v.id) ? v : undefined;
    }
  }
  return undefined;
}

export interface Relation {
  type: EntityType;
  id: string;
  label: string;
  /** 'out': this entity → other ("stole his ring"); 'in': other → this entity */
  dir: 'out' | 'in';
  /** a spoiler: hidden behind the spoiler shield */
  secret?: boolean;
}

/** Story relationships touching an entity, from the cast's relation list. */
export function relationsOf(type: EntityType, id: string): Relation[] {
  const key = `${type}:${id}`;
  const out: Relation[] = [];
  for (const r of RELATIONS) {
    const other = r.a === key ? r.b : r.b === key ? r.a : null;
    if (!other || (r.secret && shielded())) continue;
    const [t, oid] = other.split(':') as [EntityType, string];
    if (!ent(t, oid)) continue;
    out.push({ type: t, id: oid, label: r.label, dir: r.a === key ? 'out' : 'in', secret: r.secret });
  }
  return out;
}

export function itemsHeldBy(holder: string): Item[] {
  return all<Item>('item').filter((i) => i.holder === holder && i.state !== 'spent' && i.state !== 'destroyed');
}

export function abilitiesOf(pcId: string): Ability[] {
  return all<Ability>('ability').filter((a) => a.owner === pcId);
}

// ─── formatting ───────────────────────────────────────────────────────────

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function timeSpent(sceneId: string, now = Date.now()): number {
  const g = game();
  let ms = g.timer.spent[sceneId] ?? 0;
  if (g.timer.running && g.timer.since && g.scene === sceneId) ms += now - g.timer.since;
  return ms;
}

export function totalSpent(now = Date.now()): number {
  const g = game();
  let ms = Object.values(g.timer.spent).reduce((a, b) => a + b, 0);
  if (g.timer.running && g.timer.since) ms += now - g.timer.since;
  return ms;
}

export function strip(text: string): string {
  return text
    .replace(/\[\[[a-z]+:[a-z0-9-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([a-z]+):([a-z0-9-]+)\]\]/g, (_m, t, id) => {
      const type = TOKEN_TYPE[t];
      return type ? nameOf(type, id) : id;
    })
    .replace(/\{\{(str|agi|cha|per|int|any):(\d+)\}\}/g, (_m, s, dc) => `${s === 'any' ? '' : s.toUpperCase() + ' '}DC ${dc}`)
    .replace(/\{\{([^}]+)\}\}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

export function entityText(e: AnyEntity): string {
  const parts: string[] = [];
  scanText(e, (s) => parts.push(strip(s)));
  return parts.join(' ');
}

function scanText(value: unknown, onString: (s: string) => void) {
  if (typeof value === 'string') onString(value);
  else if (Array.isArray(value)) value.forEach((v) => scanText(v, onString));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => scanText(v, onString));
}

export const dataStamp = () => getData().savedAt;
