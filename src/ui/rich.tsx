// Renders campaign text. [[type:id]] references become live chips (current name + state),
// {{cha:12}} becomes a clickable check, {{1d8}} a clickable die, **bold** and *italic* render.

import type { ComponentChildren } from 'preact';
import { TOKEN_TYPE } from '../data/campaign';
import type { Ability, AnyEntity, Clue, Condition, EntityType, Hue, Item, NPC, PC, Scene } from '../data/types';
import { STAT_ABBR, type Stat } from '../data/types';
import { rollPlain } from '../state/actions';
import {
  ABILITY_STATUS,
  abilityStatus,
  isSecretHidden,
  itemStateInfo,
  nameOf,
  npcStatusInfo,
  pcStatusInfo,
  portraitOf,
  sceneStatus,
  type Tone,
} from '../state/derive';
import { ent, openDrawer } from '../state/store';
import { Icon } from './icons';
import { cx, hueVar } from './kit';
import { openRoller } from './rollbus';

// ─── hover card bus ───────────────────────────────────────────────────────

export interface Peek {
  type: EntityType;
  id: string;
  rect: DOMRect;
}
let peek: Peek | null = null;
const peekListeners = new Set<() => void>();
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
export const getPeek = () => peek;
export function onPeek(fn: () => void) {
  peekListeners.add(fn);
  return () => peekListeners.delete(fn);
}
function setPeek(p: Peek | null) {
  peek = p;
  peekListeners.forEach((f) => f());
}
export function peekIn(type: EntityType, id: string, el: HTMLElement) {
  if (matchMedia('(hover: none)').matches) return;
  clearTimeout(hideTimer);
  clearTimeout(showTimer);
  showTimer = setTimeout(() => setPeek({ type, id, rect: el.getBoundingClientRect() }), peek ? 80 : 380);
}
export function peekOut() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => setPeek(null), 160);
}
export function peekHold() {
  clearTimeout(hideTimer);
}
export function peekClose() {
  clearTimeout(showTimer);
  setPeek(null);
}

// ─── entity state → tone ──────────────────────────────────────────────────

export function entityTone(type: EntityType, e: AnyEntity): { tone: Tone; struck?: boolean; label?: string } {
  switch (type) {
    case 'item': {
      const it = e as Item;
      const info = itemStateInfo(it.state);
      return { tone: info.tone, struck: it.state === 'destroyed' || it.state === 'spent', label: info.label };
    }
    case 'ability': {
      const ab = e as Ability;
      const st = abilityStatus(ab);
      const left = ab.max ? `${Math.max(0, ab.max - ab.used)}/${ab.max}` : undefined;
      return { tone: ABILITY_STATUS[st.status].tone, struck: st.status === 'disabled', label: left ?? ABILITY_STATUS[st.status].label };
    }
    case 'pc': {
      const pc = e as PC;
      const info = pcStatusInfo(pc.status);
      return { tone: info.tone, label: pc.status === 'alive' ? `${pc.hp}/${pc.hpMax}` : info.label };
    }
    case 'npc': {
      const n = e as NPC;
      const info = npcStatusInfo(n.status);
      return { tone: info.tone, struck: n.status === 'defeated' || n.status === 'dead', label: info.label };
    }
    case 'clue': {
      const c = e as Clue;
      return { tone: c.revealed ? 'gold' : 'muted', label: c.revealed ? 'Revealed' : 'Hidden' };
    }
    case 'condition': {
      const c = e as Condition;
      return { tone: c.active ? 'warn' : 'muted', label: c.active ? 'Active' : 'Off' };
    }
    case 'scene': {
      const st = sceneStatus(e as Scene);
      const tone: Tone = st === 'active' ? 'rec' : st === 'done' ? 'good' : st === 'skipped' ? 'stone' : 'muted';
      return { tone, label: st };
    }
    default:
      return { tone: 'gold' };
  }
}

const TYPE_ICON: Record<EntityType, string> = {
  act: 'film',
  scene: 'clapperboard',
  pc: 'user',
  npc: 'drama',
  item: 'package',
  ability: 'sparkles',
  condition: 'activity',
  clue: 'lightbulb',
  rule: 'book-open-text',
  film: 'film',
  location: 'map-pin',
};

export function iconOf(type: EntityType, e?: AnyEntity): string {
  const anyE = e as { icon?: string } | undefined;
  return anyE?.icon ?? TYPE_ICON[type];
}

// ─── refs ─────────────────────────────────────────────────────────────────

export function Ref({ type, id, label, chip, noDot }: { type: EntityType; id: string; label?: string; chip?: boolean; noDot?: boolean }) {
  const e = ent(type, id);
  if (!e) return <span class="ref ref--missing">{label ?? id}</span>;
  const hidden = isSecretHidden(type, id);
  const name = hidden && type !== 'item' ? nameOf(type, id) : label ?? nameOf(type, id);
  const { tone, struck } = entityTone(type, e);
  const open = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
    peekClose();
    openDrawer(type, id);
  };
  const common = {
    role: 'button' as const,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') open(ev);
    },
    onMouseEnter: (ev: MouseEvent) => peekIn(type, id, ev.currentTarget as HTMLElement),
    onMouseLeave: peekOut,
    'data-ref': `${type}:${id}`,
  };
  if (chip) {
    const hue = (e as { hue?: Hue }).hue;
    const face = hidden ? undefined : portraitOf(type, id);
    return (
      <span {...common} class={cx('chip', `t-${tone}`, struck && 'chip--struck', hidden && 'chip--secret')}>
        <span class={cx('chip__icon', hue && 'hue', face && 'chip__icon--face')} style={hue ? ({ '--c': hueVar(hue) } as never) : undefined}>
          {face ? <img src={face} alt="" decoding="async" draggable={false} /> : <Icon name={hidden ? 'lock' : iconOf(type, e)} size={13} />}
        </span>
        <span class="chip__label">{name}</span>
        {!noDot && type !== 'film' && type !== 'rule' && type !== 'act' && type !== 'location' && <span class="chip__dot" />}
      </span>
    );
  }
  const dot = !noDot && (type === 'item' || type === 'ability' || type === 'npc' || type === 'pc' || type === 'clue' || type === 'condition');
  // keep the state dot glued to the last word so it never wraps onto a line by itself
  const cut = dot ? name.lastIndexOf(' ') + 1 : 0;
  return (
    <span {...common} class={cx('ref', `t-${tone}`, `ref--${type}`, struck && 'ref--struck', hidden && 'ref--secret')}>
      {dot ? (
        <>
          {name.slice(0, cut)}
          <span class="ref__tail">{name.slice(cut)}</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}

export function CheckChip({ stat, dc, inverted }: { stat: Stat | 'any'; dc: number; inverted?: boolean }) {
  return (
    <button
      type="button"
      class="check"
      title={`Roll ${stat === 'any' ? 'a check' : STAT_ABBR[stat as Stat]} against DC ${dc}${inverted ? ' (inverted)' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        openRoller({ stat: stat === 'any' ? undefined : (stat as Stat), dc, inverted });
      }}
    >
      <Icon name="dices" size={12} />
      {stat !== 'any' && <span class="check__stat">{STAT_ABBR[stat as Stat]}</span>}
      <span class="check__dc num">DC {dc}</span>
    </button>
  );
}

export function DiceChip({ expr }: { expr: string }) {
  return (
    <button
      type="button"
      class="dice-chip"
      title={`Roll ${expr}`}
      onClick={(e) => {
        e.stopPropagation();
        rollPlain(expr);
        openRoller({});
      }}
    >
      {expr}
    </button>
  );
}

// ─── parser ───────────────────────────────────────────────────────────────

const TOKEN = /\[\[([a-z]+):([a-z0-9-]+)(?:\|([^\]]+))?\]\]|\{\{([^}]+)\}\}|\*\*(.+?)\*\*|\*([^*\n]+?)\*/g;

export function renderRich(text: string, keyBase = 'r'): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  let last = 0;
  let i = 0;
  TOKEN.lastIndex = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${keyBase}${i++}`;
    if (m[1]) {
      const type = TOKEN_TYPE[m[1]];
      out.push(type ? <Ref key={k} type={type} id={m[2]} label={m[3]} /> : m[0]);
    } else if (m[4]) {
      const body = m[4].trim();
      const check = body.match(/^(str|agi|cha|per|int|any):(\d+)$/);
      if (check) out.push(<CheckChip key={k} stat={check[1] as Stat | 'any'} dc={parseInt(check[2], 10)} />);
      else out.push(<DiceChip key={k} expr={body} />);
    } else if (m[5]) {
      out.push(<strong key={k}>{renderRich(m[5], k)}</strong>);
    } else if (m[6]) {
      out.push(<em key={k}>{renderRich(m[6], k)}</em>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Rich({ text, class: cls }: { text?: string; class?: string }) {
  if (!text) return null;
  return <span class={cls}>{renderRich(text)}</span>;
}

export function RichParas({ paras, class: cls }: { paras?: string[]; class?: string }) {
  if (!paras?.length) return null;
  return (
    <div class={cx('paras', cls)}>
      {paras.map((p, i) => (
        <p key={i}>{renderRich(p, `p${i}-`)}</p>
      ))}
    </div>
  );
}

export function RichList({ items, class: cls, ordered }: { items?: string[]; class?: string; ordered?: boolean }) {
  if (!items?.length) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag class={cx('rlist', ordered && 'rlist--ol', cls)}>
      {items.map((t, i) => (
        <li key={i}>{renderRich(t, `l${i}-`)}</li>
      ))}
    </Tag>
  );
}
