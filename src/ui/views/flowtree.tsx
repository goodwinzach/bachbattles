// The story flow map's expanding nodes. Clicking a scene opens it into a card with a column of
// branches (its location, characters, fights, rolls, read-aloud...). Clicking a branch opens the
// next level off to the side, down to single lines of dialogue and stat lines. Every open node has
// a close button. Children are built lazily from live data, so edits show up in open branches too.

import type { JSX } from 'preact';
import type { Act, Clue, Encounter, EntityType, Item, Location, NPC, Roll, Scene } from '../../data/types';
import { goScene } from '../../state/actions';
import {
  dialogueOf,
  isSecretHidden,
  ITEM_KIND_LABEL,
  KIND_LABEL,
  nameOf,
  npcStat,
  portraitOf,
  sceneMust,
  shielded,
  SIDE_LABEL,
  strip,
} from '../../state/derive';
import { signed } from '../../state/dice';
import { all, ent, game, openDrawer, setUi } from '../../state/store';
import { Icon } from '../icons';
import { Face } from '../profile';
import { cx, hueVar } from '../kit';
import { CheckChip, Rich } from '../rich';

// ─── the tree ─────────────────────────────────────────────────────────────

export interface XNode {
  key: string;
  /** cat: a branch with a count; ent: a person, place or thing; text: a paragraph; line: a line of dialogue; roll: a check */
  kind: 'cat' | 'ent' | 'text' | 'line' | 'roll';
  icon?: string;
  title?: string;
  sub?: string;
  body?: string;
  face?: { type: EntityType; id: string };
  /** a wide picture (locations) */
  pic?: string;
  /** what the open button shows in the drawer */
  ref?: { type: EntityType; id: string };
  roll?: Roll;
  count?: number;
  tone?: 'must' | 'secret' | 'read' | 'note';
  kids?: () => XNode[];
}

export const rootKey = (sceneId: string) => `s:${sceneId}`;
export const isRootKey = (key: string) => key.startsWith('s:') && !key.includes('/');

const text = (key: string, body: string, extra: Partial<XNode> = {}): XNode => ({ key, kind: 'text', body, ...extra });
const list = (key: string, icon: string, title: string, items: string[] | undefined, extra: Partial<XNode> = {}): XNode | null =>
  items?.length ? { key, kind: 'cat', icon, title, count: items.length, kids: () => items.map((t, i) => text(`${key}/${i}`, t, { tone: extra.tone })), ...extra } : null;
const keep = (nodes: (XNode | null | undefined | false)[]): XNode[] => nodes.filter((n): n is XNode => !!n);

function statLine(npc: NPC): string | null {
  const st = npcStat(npc);
  if (!st) return null;
  if (st.invincible) return 'Invincible.';
  const atks = st.attacks.map((a) => `${a.name}${a.bonus != null ? ` ${signed(a.bonus)}` : ''}${a.dmg ? ` ${a.dmg}` : ''}${a.range ? ` (${a.range})` : ''}`);
  return [`AC ${st.ac ?? '—'} · HP ${npc.hp ?? st.hp}/${st.hp}`, ...atks].join(' · ');
}

function npcNode(npc: NPC, key: string): XNode {
  return {
    key,
    kind: 'ent',
    face: { type: 'npc', id: npc.id },
    title: nameOf('npc', npc.id),
    sub: npc.category ?? SIDE_LABEL[npc.side],
    ref: { type: 'npc', id: npc.id },
    kids: () => {
      const cues = dialogueOf(npc);
      const stats = statLine(npc);
      return keep([
        text(`${key}/role`, npc.role, { title: 'Who they are' }),
        npc.wants ? text(`${key}/wants`, npc.wants, { title: 'Wants' }) : null,
        npc.play ? text(`${key}/play`, npc.play, { title: 'Play it' }) : null,
        cues.length
          ? {
              key: `${key}/talk`,
              kind: 'cat',
              icon: 'messages-square',
              title: 'Dialogue options',
              count: cues.length,
              kids: () =>
                cues.map((c, i) => ({
                  key: `${key}/talk/${i}`,
                  kind: 'cat',
                  icon: 'message-square-quote',
                  title: c.cue,
                  count: c.options.length,
                  kids: () => c.options.map((o, j) => ({ key: `${key}/talk/${i}/${j}`, kind: 'line', body: o })),
                })),
            }
          : null,
        list(`${key}/knows`, 'lightbulb', 'What they know', npc.knows),
        list(`${key}/unknowns`, 'ban', 'What they do not know', npc.unknowns),
        list(`${key}/ifs`, 'route', 'Situations', npc.ifs),
        stats ? text(`${key}/stats`, stats, { title: 'Stats' }) : null,
        !shielded() ? list(`${key}/secrets`, 'lock', 'Secrets', npc.secrets, { tone: 'secret' }) : null,
      ]);
    },
  };
}

function locationNode(loc: Location, key: string): XNode {
  return {
    key,
    kind: 'ent',
    icon: loc.icon,
    pic: portraitOf('location', loc.id),
    title: loc.name,
    sub: `${loc.kind} · ${loc.where}`,
    ref: { type: 'location', id: loc.id },
    kids: () =>
      keep([
        text(`${key}/sum`, loc.summary),
        ...(loc.describe ?? []).map((d, i) => text(`${key}/see${i}`, d, { tone: 'read' })),
        ...(loc.notes ?? []).map((n, i) => text(`${key}/note${i}`, n, { tone: 'note' })),
      ]),
  };
}

function itemNode(item: Item, key: string): XNode {
  const hidden = isSecretHidden('item', item.id);
  return {
    key,
    kind: 'ent',
    icon: hidden ? 'lock' : item.icon,
    face: portraitOf('item', item.id) ? { type: 'item', id: item.id } : undefined,
    title: nameOf('item', item.id),
    sub: ITEM_KIND_LABEL[item.kind],
    ref: { type: 'item', id: item.id },
    kids: hidden ? undefined : () => keep([text(`${key}/fx`, item.effect), ...(item.notes ?? []).map((n, i) => text(`${key}/n${i}`, n, { tone: 'note' }))]),
  };
}

function clueNode(clue: Clue, key: string): XNode {
  const hidden = clue.secret && !clue.revealed && shielded();
  return text(key, hidden ? 'DM secret.' : clue.text, { title: clue.name + (clue.revealed ? ' (revealed)' : ''), tone: clue.secret ? 'secret' : undefined });
}

function encounterNode(enc: Encounter, key: string): XNode {
  const foes = enc.foes.map((f) => ent<NPC>('npc', f)).filter((n): n is NPC => !!n);
  return { key, kind: 'cat', icon: 'swords', title: enc.label, count: foes.length, kids: () => foes.map((n) => npcNode(n, `${key}/${n.id}`)) };
}

/** The first column of branches under an open scene. */
export function sceneBranches(scene: Scene): XNode[] {
  const k = rootKey(scene.id);
  const loc = scene.location ? ent<Location>('location', scene.location) : undefined;
  const must = sceneMust(scene);
  const cast = (scene.cast ?? []).map((id) => ent<NPC>('npc', id)).filter((n): n is NPC => !!n);
  const loot = (scene.loot ?? []).map((id) => ent<Item>('item', id)).filter((i): i is Item => !!i);
  const clues = all<Clue>('clue').filter((c) => c.source === scene.id);
  const notes = game().mapNotes.filter((n) => n.scene === scene.id && n.text.trim());
  return keep([
    notes.length
      ? {
          key: `${k}/mine`,
          kind: 'cat',
          icon: 'sticky-note',
          title: 'Your notes',
          count: notes.length,
          kids: () => notes.map((n) => text(`${k}/mine/${n.id}`, n.text, { tone: 'note' })),
        }
      : null,
    loc && locationNode(loc, `${k}/loc`),
    scene.objective || must.length
      ? {
          key: `${k}/goal`,
          kind: 'cat',
          icon: 'target',
          title: 'Objective and must happen',
          count: must.length + (scene.objective ? 1 : 0),
          kids: () => keep([scene.objective ? text(`${k}/goal/o`, scene.objective, { title: 'Objective' }) : null, ...must.map((m, i) => text(`${k}/goal/${i}`, m, { tone: 'must' }))]),
        }
      : null,
    cast.length ? { key: `${k}/cast`, kind: 'cat', icon: 'drama', title: 'Characters', count: cast.length, kids: () => cast.map((n) => npcNode(n, `${k}/cast/${n.id}`)) } : null,
    scene.encounters?.length
      ? { key: `${k}/fights`, kind: 'cat', icon: 'swords', title: 'Fights', count: scene.encounters.length, kids: () => scene.encounters!.map((e, i) => encounterNode(e, `${k}/fights/${i}`)) }
      : null,
    scene.rolls?.length
      ? { key: `${k}/rolls`, kind: 'cat', icon: 'dices', title: 'Rolls and DCs', count: scene.rolls.length, kids: () => scene.rolls!.map((r, i) => ({ key: `${k}/rolls/${i}`, kind: 'roll', roll: r, body: r.label })) }
      : null,
    list(`${k}/read`, 'megaphone', 'Read aloud', scene.readAloud, { tone: 'read' }),
    scene.beats?.length
      ? { key: `${k}/beats`, kind: 'cat', icon: 'list', title: 'Beats', count: scene.beats.length, kids: () => scene.beats!.map((b, i) => text(`${k}/beats/${i}`, b.text, { title: b.label })) }
      : null,
    scene.failsafes?.length
      ? {
          key: `${k}/ifs`,
          kind: 'cat',
          icon: 'git-branch',
          title: 'If they…',
          count: scene.failsafes.length,
          kids: () => scene.failsafes!.map((f, i) => text(`${k}/ifs/${i}`, f.then, { title: `If ${strip(f.when)}` })),
        }
      : null,
    loot.length ? { key: `${k}/loot`, kind: 'cat', icon: 'package', title: 'Loot', count: loot.length, kids: () => loot.map((i) => itemNode(i, `${k}/loot/${i.id}`)) } : null,
    clues.length ? { key: `${k}/clues`, kind: 'cat', icon: 'lightbulb', title: 'Clues', count: clues.length, kids: () => clues.map((c) => clueNode(c, `${k}/clues/${c.id}`)) } : null,
    list(`${k}/tips`, 'sparkles', 'Ideas for the players', scene.tips),
    list(`${k}/notes`, 'notebook-pen', 'DM notes', scene.notes, { tone: 'note' }),
    !shielded() ? list(`${k}/secrets`, 'lock', 'Secrets', scene.secrets, { tone: 'secret' }) : null,
  ]);
}

// ─── layout ───────────────────────────────────────────────────────────────

export const ROOT_W = 324;
const GAP_X = 36;
const GAP_Y = 10;
const WIDTH: Record<XNode['kind'], number> = { cat: 236, ent: 256, text: 300, line: 300, roll: 300 };

export interface Placed {
  key: string;
  node?: XNode;
  x: number;
  y: number;
  w: number;
  h: number;
  parent?: string;
  depth: number;
}

/** A first guess at a node's height; the real height is measured after it renders. */
function guess(n: XNode, w: number): number {
  if (n.kind === 'cat' || n.kind === 'ent') return n.pic ? 66 : n.sub ? 54 : 42;
  const chars = strip(n.body ?? '').length;
  const perLine = Math.max(20, Math.floor((w - 26) / 7.1));
  return 22 + Math.ceil(chars / perLine) * 19 + (n.title ? 20 : 0) + (n.kind === 'roll' ? 26 : 0);
}

/**
 * Lays out one open scene: its card at the scene's spot, the branches in a column underneath, and
 * each open branch's children in the next column to the right, siblings stacked downward.
 */
export function layoutScene(scene: Scene, at: { x: number; y: number }, open: Set<string>, heights: Record<string, number>): Placed[] {
  const out: Placed[] = [];
  const rk = rootKey(scene.id);
  const rootH = heights[rk] ?? 200;
  out.push({ key: rk, x: at.x, y: at.y, w: ROOT_W, h: rootH, depth: 0 });
  const place = (n: XNode, x: number, y: number, parent: string, depth: number): number => {
    const w = WIDTH[n.kind];
    const h = heights[n.key] ?? guess(n, w);
    out.push({ key: n.key, node: n, x, y, w, h, parent, depth });
    if (!n.kids || !open.has(n.key)) return h;
    let cy = y;
    for (const kid of n.kids()) cy += place(kid, x + w + GAP_X, cy, n.key, depth + 1) + GAP_Y;
    return Math.max(h, cy - y - GAP_Y);
  };
  let y = at.y + rootH + 24;
  for (const b of sceneBranches(scene)) y += place(b, at.x + 26, y, rk, 1) + GAP_Y;
  return out;
}

/** Connector from a parent to a child: down the side of an open scene card, otherwise out of the parent's right edge, down a shared spine and into the child. */
export function connector(p: Placed, c: Placed): string {
  const cy = c.y + Math.min(21, c.h / 2);
  const r = 8;
  if (p.depth === 0) {
    const x = p.x + 13;
    return `M${x},${p.y + p.h} V${cy - r} Q${x},${cy} ${x + r},${cy} H${c.x}`;
  }
  const x1 = p.x + p.w;
  const y1 = p.y + Math.min(21, p.h / 2);
  if (Math.abs(cy - y1) < 1) return `M${x1},${y1} H${c.x}`;
  const xm = x1 + (c.x - x1) / 2;
  const rr = Math.min(r, Math.abs(cy - y1) / 2);
  return `M${x1},${y1} H${xm - rr} Q${xm},${y1} ${xm},${y1 + rr} V${cy - rr} Q${xm},${cy} ${xm + rr},${cy} H${c.x}`;
}

// ─── rendering ────────────────────────────────────────────────────────────

/** The open scene: a bigger card in place of its node, with the ways into the rest of the app. */
export function SceneCard({
  scene,
  p,
  onClose,
  onGrab,
  onNote,
}: {
  scene: Scene;
  p: Placed;
  onClose: () => void;
  /** drag the scene by its card */
  onGrab: (e: PointerEvent) => void;
  /** add a note next to this scene */
  onNote: () => void;
}) {
  const act = ent<Act>('act', scene.act);
  const pic = scene.location ? portraitOf('location', scene.location) : undefined;
  const current = game().scene === scene.id;
  return (
    <div
      class="xroot hue nopan"
      data-xkey={p.key}
      style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, '--c': hueVar(act?.hue) } as JSX.CSSProperties}
      onPointerDown={(e) => {
        // the picture and the heading are handles for moving the scene; buttons and text links are not
        if ((e.target as HTMLElement).closest('button, a, [role=button], .xroot__log')) return;
        onGrab(e);
      }}
    >
      {pic && (
        <div class="xroot__pic">
          <img src={pic} alt="" draggable={false} />
        </div>
      )}
      <div class="xroot__head">
        <span class="xroot__slate num">{scene.slate}</span>
        <div class="xroot__titles">
          <div class="xroot__eyebrow">
            {act?.num}: {act?.title} · {KIND_LABEL[scene.kind]}
          </div>
          <div class="xroot__title">{scene.title}</div>
        </div>
        <button type="button" class="xbtn" onClick={onClose} aria-label={`Close ${scene.title}`} title="Close">
          <Icon name="x" size={14} />
        </button>
      </div>
      <Rich text={scene.logline} class="xroot__log" />
      <div class="xroot__actions">
        {current ? (
          <span class="xroot__now">
            <span class="rec" /> Now playing
          </span>
        ) : (
          <button type="button" class="btn btn--xs btn--primary" onClick={() => goScene(scene.id)}>
            <Icon name="play" /> Play
          </button>
        )}
        <button type="button" class="btn btn--xs" onClick={() => setUi({ view: 'story', focusScene: scene.id })}>
          <Icon name="scroll-text" /> Script
        </button>
        <button type="button" class="btn btn--xs btn--ghost" onClick={() => openDrawer('scene', scene.id)}>
          <Icon name="info" /> Details
        </button>
        <button type="button" class="btn btn--xs btn--ghost" onClick={onNote} title="Stick a note next to this scene">
          <Icon name="sticky-note" /> Note
        </button>
      </div>
    </div>
  );
}

const cueOf = (t: string) => {
  const s = t.trim();
  return s.startsWith('(') && s.endsWith(')') && !s.slice(1, -1).includes(')') ? s.slice(1, -1) : null;
};

export function NodeView({ p, open, onToggle }: { p: Placed; open: boolean; onToggle: (key: string) => void }) {
  const n = p.node!;
  const style = { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px` } as JSX.CSSProperties;
  const cls = cx('xnode', `xnode--${n.kind}`, n.tone && `xnode--${n.tone}`, open && 'is-open');
  if (n.kind === 'cat' || n.kind === 'ent') {
    const can = !!n.kids;
    return (
      <div class={cls} data-xkey={n.key} style={style}>
        <button type="button" class="xnode__main" onClick={() => can && onToggle(n.key)} aria-expanded={can ? open : undefined} disabled={!can}>
          {n.pic ? (
            <span class="xnode__pic">
              <img src={n.pic} alt="" draggable={false} />
            </span>
          ) : n.face ? (
            <Face type={n.face.type} id={n.face.id} size={30} />
          ) : (
            <span class="xnode__icon">
              <Icon name={n.icon ?? 'circle'} size={15} />
            </span>
          )}
          <span class="xnode__txt">
            <span class="xnode__title">{n.title}</span>
            {n.sub && <span class="xnode__sub">{n.sub}</span>}
          </span>
          {n.count != null && <span class="xnode__count num">{n.count}</span>}
        </button>
        {n.ref && (
          <button type="button" class="xbtn xbtn--sm" onClick={() => openDrawer(n.ref!.type, n.ref!.id)} title="Open its page" aria-label={`Open ${n.title}`}>
            <Icon name="arrow-up-right" size={13} />
          </button>
        )}
        {can && (
          <button
            type="button"
            class={cx('xbtn xbtn--sm xnode__toggle', open && 'is-close')}
            onClick={() => onToggle(n.key)}
            title={open ? 'Close' : 'Open'}
            aria-label={open ? `Close ${n.title}` : `Open ${n.title}`}
          >
            <Icon name={open ? 'x' : 'plus'} size={13} />
          </button>
        )}
      </div>
    );
  }
  if (n.kind === 'roll' && n.roll) {
    return (
      <div class={cls} data-xkey={n.key} style={style}>
        <CheckChip stat={n.roll.stat} dc={n.roll.dc} inverted={n.roll.inverted} />
        <Rich text={n.roll.label} class="xnode__body" />
        {n.roll.note && <Rich text={n.roll.note} class="xnode__note" />}
      </div>
    );
  }
  const cue = n.kind === 'line' ? cueOf(n.body ?? '') : null;
  return (
    <div class={cx(cls, cue != null && 'xnode--cue')} data-xkey={n.key} style={style}>
      {n.title && <div class="xnode__label">{n.title}</div>}
      <Rich text={cue ?? n.body} class="xnode__body" />
    </div>
  );
}
