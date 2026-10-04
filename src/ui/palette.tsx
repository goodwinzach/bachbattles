import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TYPE_LABEL } from '../data/campaign';
import type { AnyEntity, EntityType, Scene } from '../data/types';
import { completeAndNext, goScene, toggleTimer } from '../state/actions';
import { entityText, isSecretHidden, nameOf, portraitOf, strip } from '../state/derive';
import { all, game, getDataVersion, getUi, openDrawer, openModal, setUi, VIEWS } from '../state/store';
import { setBulk } from './hooks';
import { Icon } from './icons';
import { cx } from './kit';
import { iconOf } from './rich';
import { openRoller } from './rollbus';

interface Hit {
  key: string;
  icon: string;
  face?: string;
  title: string;
  sub: string;
  kind: string;
  score: number;
  run: () => void;
}

const SEARCH_TYPES: EntityType[] = ['scene', 'pc', 'npc', 'location', 'item', 'ability', 'clue', 'condition', 'rule', 'film', 'act'];

let indexFor = -1;
let index: { type: EntityType; e: AnyEntity; name: string; text: string }[] = [];
function buildIndex() {
  if (indexFor === getDataVersion()) return index;
  index = [];
  for (const type of SEARCH_TYPES) {
    for (const e of all(type)) {
      index.push({ type, e, name: nameOf(type, e.id), text: entityText(e).toLowerCase() });
    }
  }
  indexFor = getDataVersion();
  return index;
}

function actions(): Hit[] {
  const ui = getUi();
  const g = game();
  const list: Omit<Hit, 'score'>[] = [
    ...VIEWS.map((v) => ({ key: `view:${v.id}`, icon: v.icon, title: `Go to ${v.label}`, sub: v.hint, kind: 'View', run: () => setUi({ view: v.id }) })),
    { key: 'act:edit', icon: 'pencil', title: ui.edit ? 'Turn off edit mode' : 'Turn on edit mode', sub: 'Change states and text everywhere', kind: 'Action', run: () => setUi({ edit: !ui.edit }) },
    { key: 'act:shield', icon: ui.shield ? 'eye' : 'eye-off', title: ui.shield ? 'Show DM secrets' : 'Hide DM secrets (spoiler shield)', sub: 'Before sharing your screen', kind: 'Action', run: () => setUi({ shield: !ui.shield }) },
    { key: 'act:next', icon: 'skip-forward', title: 'Finish this scene and go to the next', sub: 'Marks the current scene done', kind: 'Action', run: () => completeAndNext() },
    { key: 'act:timer', icon: g.timer.running ? 'pause' : 'play', title: g.timer.running ? 'Pause the session timer' : 'Start the session timer', sub: 'Feeds the pacing chart', kind: 'Action', run: toggleTimer },
    { key: 'act:dice', icon: 'dices', title: 'Open the dice tray', sub: 'Checks, advantage, damage', kind: 'Action', run: () => openRoller({}) },
    { key: 'act:expand', icon: 'chevrons-up-down', title: 'Expand everything in the script', sub: 'Open every section', kind: 'Action', run: () => { setUi({ view: 'story' }); setTimeout(() => setBulk('story', true), 30); } },
    { key: 'act:settings', icon: 'settings', title: 'Settings & campaign options', sub: 'Studio gauntlet version, route, theme', kind: 'Action', run: () => openModal({ kind: 'settings' }) },
    { key: 'act:export', icon: 'file-down', title: 'Export save', sub: 'Download or copy everything you changed', kind: 'Action', run: () => openModal({ kind: 'export' }) },
    { key: 'act:history', icon: 'list-restart', title: 'History', sub: 'Every change this session', kind: 'Action', run: () => openModal({ kind: 'history' }) },
  ];
  return list.map((h) => ({ ...h, score: 0 }));
}

function search(q: string): Hit[] {
  const query = q.trim().toLowerCase();
  const acts = actions();
  if (!query) {
    const cur = game().scene;
    const scenes = all<Scene>('scene');
    const i = scenes.findIndex((s) => s.id === cur);
    const near = scenes.slice(Math.max(0, i), i + 4);
    return [
      ...near.map((s) => entityHit('scene', s, 1)),
      ...acts.slice(0, 6),
    ];
  }
  const words = query.split(/\s+/);
  const hits: Hit[] = [];
  for (const row of buildIndex()) {
    if (isSecretHidden(row.type, row.e.id)) continue;
    const name = row.name.toLowerCase();
    let score = 0;
    if (name === query) score = 10;
    else if (name.startsWith(query)) score = 7;
    else if (name.split(/[\s-]+/).some((w) => w.startsWith(query))) score = 5;
    else if (name.includes(query)) score = 4;
    else if (words.every((w) => row.text.includes(w) || name.includes(w))) score = 1.5;
    if (!score) continue;
    if (row.type === 'scene' || row.type === 'pc') score += 0.5;
    hits.push(entityHit(row.type, row.e, score));
  }
  for (const a of acts) {
    const t = a.title.toLowerCase();
    if (t.includes(query) || words.every((w) => t.includes(w))) hits.push({ ...a, score: t.startsWith(query) ? 6 : 3 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 40);
}

function entityHit(type: EntityType, e: AnyEntity, score: number): Hit {
  const r = e as unknown as Record<string, unknown>;
  let sub = '';
  if (type === 'scene') sub = `${(e as Scene).slate} · ${strip((e as Scene).logline)}`;
  else if (typeof r.role === 'string') sub = strip(r.role);
  else if (typeof r.tagline === 'string') sub = strip(r.tagline);
  else if (typeof r.summary === 'string') sub = strip(r.summary);
  else if (typeof r.effect === 'string') sub = strip(r.effect);
  else if (typeof r.text === 'string') sub = strip(r.text);
  return {
    key: `${type}:${e.id}`,
    icon: iconOf(type, e),
    face: portraitOf(type, e.id),
    title: nameOf(type, e.id),
    sub,
    kind: TYPE_LABEL[type],
    score,
    run: () => {
      if (type === 'scene' && getUi().view === 'run') goScene(e.id);
      else openDrawer(type, e.id);
    },
  };
}

export function Palette() {
  const open = getUi().palette;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hits = useMemo(() => (open ? search(q) : []), [q, open, getDataVersion()]);
  useEffect(() => {
    // reset on close rather than on open, so keys typed right after opening are never wiped
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else {
      setQ('');
      setSel(0);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  if (!open) return null;
  const close = () => setUi({ palette: false });
  const run = (h: Hit | undefined) => {
    if (!h) return;
    close();
    h.run();
  };
  return (
    <div class="modalwrap modalwrap--top" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="palette" role="dialog" aria-label="Search">
        <div class="palette__bar">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            class="palette__input"
            placeholder="Search scenes, characters, items, abilities, rules…"
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel(Math.min(hits.length - 1, sel + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel(Math.max(0, sel - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(hits[sel]);
              } else if (e.key === 'Escape') close();
            }}
            aria-label="Search"
            aria-controls="palette-list"
          />
          <kbd>Esc</kbd>
        </div>
        <ul class="palette__list" id="palette-list" role="listbox" ref={listRef}>
          {hits.length === 0 && <li class="palette__empty">Nothing matches "{q}". Try a name, a movie or a rule.</li>}
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === sel} class={cx('palette__item', i === sel && 'is-sel')} onMouseEnter={() => setSel(i)} onClick={() => run(h)}>
              <span class={cx('palette__icon', h.face && 'palette__icon--face')}>
                {h.face ? <img src={h.face} alt="" decoding="async" /> : <Icon name={h.icon} size={16} />}
              </span>
              <span class="palette__text">
                <span class="palette__title">{h.title}</span>
                {h.sub && <span class="palette__sub">{h.sub}</span>}
              </span>
              <span class="palette__kind">{h.kind}</span>
            </li>
          ))}
        </ul>
        <div class="palette__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}
