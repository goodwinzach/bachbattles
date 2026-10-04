// Campaign data model.
//
// Every piece of content is an entity (scene, pc, npc, item, ability, ...). Text fields are
// "rich" strings that may reference other entities with [[type:id]] or [[type:id|label]] tokens,
// checks with {{stat:dc}} and dice with {{1d8}}. The UI resolves references live, so an edit to an
// entity (name, state, uses, holder...) shows up everywhere that entity is mentioned.

export type Rich = string;

export type Stat = 'str' | 'agi' | 'cha' | 'per' | 'int';
export const STATS: Stat[] = ['str', 'agi', 'cha', 'per', 'int'];
export const STAT_NAME: Record<Stat, string> = {
  str: 'Strength',
  agi: 'Agility',
  cha: 'Charisma',
  per: 'Perception',
  int: 'Intelligence',
};
export const STAT_ABBR: Record<Stat, string> = { str: 'STR', agi: 'AGI', cha: 'CHA', per: 'PER', int: 'INT' };

export type Hue = 'blue' | 'orange' | 'aqua' | 'yellow' | 'magenta' | 'green' | 'violet' | 'red';

export type EntityType = 'act' | 'scene' | 'pc' | 'npc' | 'item' | 'ability' | 'condition' | 'clue' | 'rule' | 'film';

export interface Act {
  id: string;
  num: string;
  title: string;
  tagline: string;
  hue: Hue;
  summary: Rich;
}

export type SceneKind =
  | 'narration'
  | 'explore'
  | 'social'
  | 'combat'
  | 'boss'
  | 'oracle'
  | 'decision'
  | 'travel'
  | 'hub'
  | 'finale'
  | 'epilogue';

export type SceneStatus = 'upcoming' | 'active' | 'done' | 'skipped';

export interface Roll {
  stat: Stat | 'any';
  dc: number;
  label: Rich;
  /** extra note, e.g. "Inverted: 10 or lower is safe" */
  note?: Rich;
  /** success when total is BELOW the DC (Medusa's gaze) */
  inverted?: boolean;
}

export interface Encounter {
  label: string;
  foes: string[];
  /** default fighters if not the whole party (e.g. a duel) */
  fighters?: string[];
  /** stat-block phase to use for foes with phases (Lou) */
  phase?: number;
}

export interface Line {
  by: string; // npc or pc id
  text: string;
  note?: string;
}

export interface Beat {
  label: string;
  text: Rich;
}

export interface Failsafe {
  when: Rich;
  then: Rich;
}

interface EffectBase {
  label: string;
  /** only offered in one version of the studio gauntlet */
  only?: 'outline' | 'expanded';
}

export type Effect = EffectBase &
  (
    | { kind: 'condition'; id: string; active: boolean }
    | { kind: 'clock'; set: number }
    | { kind: 'clockDelta'; delta: number }
    | { kind: 'items'; ids: string[]; patch: Partial<ItemRuntime> }
    | { kind: 'healAll' }
    | { kind: 'clues'; ids: string[] }
    | { kind: 'npcs'; ids: string[]; patch: Partial<NpcRuntime> }
    | { kind: 'pcs'; filter: 'all' | 'notFlynn' | 'down' | 'stone' | 'flynn'; patch: Partial<PcRuntime> }
    | { kind: 'abilities'; ids: string[]; patch: Partial<AbilityRuntime> }
  );

export interface SceneVariantText {
  outline: Rich[];
  expanded: Rich[];
}

export interface Scene {
  id: string;
  act: string;
  slate: string;
  title: string;
  /** label used in the original outline / Latest.docx */
  ref?: string;
  slug: string;
  kind: SceneKind;
  optional?: boolean;
  branch?: 'plane' | 'boat';
  /** only part of the expanded build (The Cat in the Hat) */
  expandedOnly?: boolean;
  minutes?: [number, number];
  clock?: string;
  clockTarget?: number;
  logline: Rich;
  readAloud?: Rich[];
  beats?: Beat[];
  objective?: Rich;
  mustHappen?: Rich[];
  variantMust?: SceneVariantText;
  cast?: string[];
  encounters?: Encounter[];
  rolls?: Roll[];
  lines?: Line[];
  failsafes?: Failsafe[];
  tips?: Rich[];
  notes?: Rich[];
  secrets?: Rich[];
  loot?: string[];
  effects?: Effect[];
  source?: string;
  next: string[];
  layout: { col: number; lane: number };
  films?: string[];
  /** runtime */
  status: SceneStatus;
  dmNote?: string;
}

export type PcStatus = 'alive' | 'ghost' | 'stone' | 'down';

export interface PcRuntime {
  hp: number;
  status: PcStatus;
  effects: string[];
  mask: string; // flynn only: an item id, 'none' when he takes it off by choice (Unmasked), '' when it was lost
  dmNote: string;
}

export interface PC extends PcRuntime {
  id: string;
  name: string;
  player: string;
  title: string;
  tagline: Rich;
  icon: string;
  hue: Hue;
  ac: number;
  hpMax: number;
  stats: Record<Stat, number>;
  bio: Rich;
  play: Rich;
  abilities: string[];
  secrets?: Rich[];
  notes?: Rich[];
  films?: string[];
  /** portrait key (src/data/portraits.ts); 'none' shows the icon instead */
  portrait?: string;
}

export type NpcStatus = 'unmet' | 'present' | 'friendly' | 'hostile' | 'defeated' | 'dead' | 'fled' | 'stone' | 'captured';
export type NpcSide = 'ally' | 'neutral' | 'foe' | 'boss' | 'oracle';

export interface Attack {
  name: string;
  bonus?: number;
  dmg?: string;
  range?: string;
  note?: Rich;
}

export interface Special {
  name: string;
  uses?: string;
  text: Rich;
}

export interface StatBlock {
  ac: number | null;
  hp: number | null;
  attacks: Attack[];
  specials?: Special[];
  behavior?: Rich;
  invincible?: boolean;
}

export interface NpcRuntime {
  status: NpcStatus;
  hp: number | null;
  phase: number;
  dmNote: string;
}

export interface NPC extends NpcRuntime {
  id: string;
  name: string;
  aka?: string;
  film?: string;
  side: NpcSide;
  icon: string;
  role: Rich;
  look?: Rich;
  personality?: Rich;
  play?: Rich;
  wants?: Rich;
  knows?: Rich[];
  important?: Rich[];
  lines?: string[];
  stat?: StatBlock;
  /** alternate stat blocks (Lou masked / unmasked) */
  phases?: { label: string; stat: StatBlock }[];
  group?: string;
  minor?: boolean;
  /** other films or shows they are tied to, after `film` */
  films?: string[];
  /** portrait key (src/data/portraits.ts); 'none' shows the icon instead */
  portrait?: string;
}

export type ItemKind = 'mask' | 'key' | 'weapon' | 'gear' | 'consumable' | 'money' | 'prop' | 'hazard';
export type ItemState = 'unclaimed' | 'held' | 'equipped' | 'missing' | 'enemy' | 'lost' | 'spent' | 'destroyed';

export interface ItemRuntime {
  state: ItemState;
  holder: string; // pc id, npc id, 'party', or ''
  qty: number | null;
  ammo: number | null;
  revealed: boolean;
  dmNote: string;
}

export interface Item extends ItemRuntime {
  id: string;
  name: string;
  kind: ItemKind;
  icon: string;
  tier?: 'unarmed' | 'light' | 'normal' | 'heavy';
  dmg?: string;
  range?: string;
  acBonus?: number;
  effect: Rich;
  notes?: Rich[];
  source?: string;
  ammoMax?: number;
  secret?: boolean;
  alias?: string;
  films?: string[];
  /** portrait key (src/data/portraits.ts); 'none' shows the icon instead */
  portrait?: string;
}

export type Recharge = 'scene' | 'fight' | 'campaign' | 'turn' | 'passive' | 'unlimited';

export interface AbilityRuntime {
  used: number;
  enabled: boolean;
  revealed: boolean;
  dmNote: string;
}

export interface Ability extends AbilityRuntime {
  id: string;
  name: string;
  owner: string;
  icon: string;
  recharge: Recharge;
  max?: number;
  summary: Rich;
  mechanics?: Rich[];
  limits?: Rich[];
  examples?: Rich[];
  table?: { range: string; label: string; tone: 'good' | 'warn' | 'bad'; text: Rich; examples?: Rich[] }[];
  requires?: string;
  secret?: boolean;
  films?: string[];
}

export interface Condition {
  id: string;
  name: string;
  icon: string;
  scope: 'party' | 'pc';
  mods?: Partial<Record<Stat, number>>;
  summary: Rich;
  starts?: Rich;
  ends?: Rich;
  active: boolean;
  dmNote: string;
}

export interface Clue {
  id: string;
  name: string;
  text: Rich;
  source: string;
  group: 'costello' | 'story';
  revealed: boolean;
  secret?: boolean;
  dmNote: string;
}

export type RuleGroup = 'core' | 'combat' | 'conditions' | 'death' | 'secrets' | 'craft';

export interface Rule {
  id: string;
  group: RuleGroup;
  title: string;
  summary: Rich;
  body?: Rich[];
  table?: { head: string[]; rows: Rich[][] };
  list?: Rich[];
  secret?: boolean;
  films?: string[];
  dmNote: string;
}

export interface Film {
  id: string;
  title: string;
  favorite: boolean;
  note?: Rich;
  /** what kind of source it is; films are the default */
  kind?: 'film' | 'series' | 'myth';
}

export interface Campaign {
  acts: Act[];
  scenes: Scene[];
  pcs: PC[];
  npcs: NPC[];
  items: Item[];
  abilities: Ability[];
  conditions: Condition[];
  clues: Clue[];
  rules: Rule[];
  films: Film[];
}

export type AnyEntity = Act | Scene | PC | NPC | Item | Ability | Condition | Clue | Rule | Film;
