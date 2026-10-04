// CAST: every player and character as a portrait gallery, and a full profile page for each.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Act, NPC, PC, Scene } from '../../data/types';
import { entityText, npcStatusInfo, pcStatusInfo, SIDE_LABEL } from '../../state/derive';
import { all, ent, game, getDataVersion, getUi, openProfile, setUi } from '../../state/store';
import { isTyping } from '../hooks';
import { Icon } from '../icons';
import { Badge, Empty, cx, hueVar } from '../kit';
import { Face, faceState, NpcProfile, PcProfile, sourceTitle } from '../profile';

type Who = { type: 'pc' | 'npc'; id: string };
type Filter = 'all' | 'pc' | 'ally' | 'enemy' | 'neutral';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'pc', label: 'Players' },
  { id: 'ally', label: 'Allies' },
  { id: 'enemy', label: 'Bosses & foes' },
  { id: 'neutral', label: 'Neutral' },
];

/** Players first, then characters in the order the story introduces them, grouped by act. */
function castGroups(): { key: string; title: string; act?: Act; who: Who[] }[] {
  const scenes = all<Scene>('scene');
  const first = new Map<string, Scene>();
  for (const s of scenes) {
    const ids = [...(s.cast ?? []), ...(s.encounters ?? []).flatMap((e) => e.foes)];
    for (const id of ids) if (!first.has(id)) first.set(id, s);
  }
  const order = new Map(scenes.map((s, i) => [s.id, i]));
  const npcs = all<NPC>('npc')
    .map((n, i) => ({ n, i, s: first.get(n.id) }))
    .sort((a, b) => (a.s ? order.get(a.s.id)! : 999) - (b.s ? order.get(b.s.id)! : 999) || a.i - b.i);
  const groups: { key: string; title: string; act?: Act; who: Who[] }[] = [{ key: 'party', title: 'The party', who: all<PC>('pc').map((p) => ({ type: 'pc', id: p.id })) }];
  for (const { n, s } of npcs) {
    const act = s ? ent<Act>('act', s.act) : undefined;
    const key = act?.id ?? 'elsewhere';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: act ? `${act.num}: ${act.title}` : 'Not in a scene yet', act, who: [] };
      groups.push(g);
    }
    g.who.push({ type: 'npc', id: n.id });
  }
  return groups;
}

export const castOrder = (): Who[] => castGroups().flatMap((g) => g.who);

function matchesFilter(w: Who, f: Filter) {
  if (f === 'all') return true;
  if (f === 'pc') return w.type === 'pc';
  if (w.type !== 'npc') return false;
  const side = ent<NPC>('npc', w.id)?.side;
  if (f === 'enemy') return side === 'boss' || side === 'foe';
  return f === 'neutral' ? side === 'neutral' || side === 'oracle' : side === f;
}

function Tile({ w, here }: { w: Who; here: boolean }) {
  const e = ent<PC | NPC>(w.type, w.id);
  if (!e) return null;
  const pc = w.type === 'pc' ? (e as PC) : undefined;
  const npc = w.type === 'npc' ? (e as NPC) : undefined;
  const st = faceState(w.type, e);
  const status = pc ? (pc.status !== 'alive' ? pcStatusInfo(pc.status) : undefined) : npc!.status !== 'unmet' ? npcStatusInfo(npc!.status) : undefined;
  return (
    <button
      type="button"
      class={cx('ctile', pc && 'hue', st && `ctile--${st}`, here && 'is-here')}
      style={pc ? ({ '--c': hueVar(pc.hue) } as never) : undefined}
      onClick={() => openProfile(w.type, w.id)}
    >
      <span class="ctile__face">
        <Face type={w.type} id={w.id} size={112} />
        {here && (
          <span class="ctile__here" title="In the current scene">
            <span class="rec" /> In scene
          </span>
        )}
      </span>
      <span class="ctile__name">{e.name}</span>
      <span class="ctile__src">{pc ? `Played by ${pc.player}` : sourceTitle('npc', w.id)}</span>
      <span class="ctile__meta">
        {npc && (
          <Badge tone={npc.side === 'boss' ? 'bad' : npc.side === 'ally' ? 'good' : npc.side === 'oracle' ? 'gold' : 'muted'} dot={false} class="badge--sm">
            {SIDE_LABEL[npc.side]}
          </Badge>
        )}
        {pc && (
          <Badge tone="gold" dot={false} class="badge--sm">
            {pc.title}
          </Badge>
        )}
        {status && (
          <Badge tone={status.tone} class="badge--sm">
            {status.label}
          </Badge>
        )}
      </span>
    </button>
  );
}

function Gallery() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const v = getDataVersion();
  const groups = useMemo(castGroups, [v]);
  const cur = ent<Scene>('scene', game().scene);
  const inScene = new Set([...(cur?.cast ?? []), ...(cur?.encounters ?? []).flatMap((e) => e.foes)]);
  const query = q.trim().toLowerCase();
  const visible = (w: Who) => {
    if (!matchesFilter(w, filter)) return false;
    if (!query) return true;
    const e = ent(w.type, w.id);
    return !!e && (entityText(e) + ' ' + sourceTitle(w.type, w.id)).toLowerCase().includes(query);
  };
  const shown = groups.map((g) => ({ ...g, who: g.who.filter(visible) })).filter((g) => g.who.length);
  const total = groups.reduce((n, g) => n + g.who.length, 0);
  return (
    <div class="view cast">
      <header class="cast__head">
        <div>
          <div class="eyebrow">Who's who</div>
          <h1 class="cast__title">The cast</h1>
          <p class="muted cast__blurb">
            {total} players and characters. Open anyone for their profile: where they're from, how to play them, lines to use and stats. Clicking a name anywhere in the app opens the same profile.
          </p>
        </div>
      </header>
      <div class="cast__tools">
        <label class="searchfield cast__search">
          <Icon name="search" size={16} />
          <input class="input" placeholder="Search names, films, roles" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search the cast" />
        </label>
        <div class="seg cast__filters" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        shown.map((g) => (
          <section key={g.key} class={cx('cast__group', g.act && 'hue')} style={g.act ? ({ '--c': hueVar(g.act.hue) } as never) : undefined}>
            <h2 class="cast__gh">
              {g.act ? <span class="swatch" /> : <Icon name="users" size={16} />}
              {g.title}
              <span class="muted num">{g.who.length}</span>
            </h2>
            <div class="cast__grid">
              {g.who.map((w) => (
                <Tile key={`${w.type}:${w.id}`} w={w} here={w.type === 'npc' && inScene.has(w.id)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <Empty icon="contact" title="Nobody matches." />
      )}
    </div>
  );
}

function Page({ who }: { who: Who }) {
  const order = castOrder();
  const i = order.findIndex((o) => o.type === who.type && o.id === who.id);
  const prev = i > 0 ? order[i - 1] : undefined;
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : undefined;
  const e = ent<PC | NPC>(who.type, who.id)!;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [who.type, who.id]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const ui = getUi();
      if (isTyping(ev) || ev.metaKey || ev.ctrlKey || ev.altKey || ui.drawer || ui.modal || ui.palette) return;
      if (ev.key === 'ArrowLeft' && prev) openProfile(prev.type, prev.id);
      if (ev.key === 'ArrowRight' && next) openProfile(next.type, next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev?.id, next?.id]);
  const nameOf = (w?: Who) => (w ? ent<PC | NPC>(w.type, w.id)?.name ?? '' : '');
  return (
    <div class="view cast cast--page">
      <nav class="castnav" aria-label="Cast navigation">
        <button type="button" class="btn btn--sm btn--ghost" onClick={() => setUi({ castFocus: null })}>
          <Icon name="layout-grid" /> All cast
        </button>
        <span class="castnav__pos muted num">
          {i + 1} of {order.length}
        </span>
        <span class="spacer" />
        <button type="button" class="btn btn--sm castnav__btn" disabled={!prev} onClick={() => prev && openProfile(prev.type, prev.id)} title="Previous (←)">
          <Icon name="chevron-left" />
          {prev && <Face type={prev.type} id={prev.id} size={22} />}
          <span class="castnav__name">{nameOf(prev)}</span>
        </button>
        <button type="button" class="btn btn--sm castnav__btn" disabled={!next} onClick={() => next && openProfile(next.type, next.id)} title="Next (→)">
          <span class="castnav__name">{nameOf(next)}</span>
          {next && <Face type={next.type} id={next.id} size={22} />}
          <Icon name="chevron-right" />
        </button>
      </nav>
      {who.type === 'pc' ? <PcProfile pc={e as PC} mode="page" /> : <NpcProfile npc={e as NPC} mode="page" />}
    </div>
  );
}

export function CastView() {
  const focus = getUi().castFocus;
  if (focus) {
    const [type, id] = focus.split(':') as ['pc' | 'npc', string];
    if ((type === 'pc' || type === 'npc') && ent(type, id)) return <Page who={{ type, id }} />;
  }
  return <Gallery />;
}
