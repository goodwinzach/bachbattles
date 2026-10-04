// MAP: the campaign as a storyboard flowchart, a connections web, and a pacing chart.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { RELATIONS } from '../../data/campaign';
import { CLOCK_RHYTHM, PACING } from '../../data/scenes';
import type { Act, EntityType, Film, Item, NPC, PC, Scene } from '../../data/types';
import { goScene } from '../../state/actions';
import { fmtDuration, KIND_LABEL, nameOf, portraitOf, sceneInPlay, sceneMust, sceneStatus, timeSpent, totalSpent } from '../../state/derive';
import { all, ent, game, getDataVersion, getUi, openDrawer, setUi } from '../../state/store';
import { useMedia, useTick } from '../hooks';
import { Icon } from '../icons';
import { Badge, cx, hueVar } from '../kit';
import { Ref, Rich, RichList, iconOf } from '../rich';

// ─── pan & zoom ───────────────────────────────────────────────────────────

interface View {
  x: number;
  y: number;
  k: number;
}

function usePanZoom(initial: () => View) {
  const [view, setView] = useState<View>(initial);
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number; view: View; dist?: number; mid?: { x: number; y: number } } | null = null;
    let moved = 0;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, select, input, .nopan')) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      moved = 0;
      start = { ...local(e), view: viewRef.current };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        start.dist = Math.hypot(a.x - b.x, a.y - b.y);
        start.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      el.classList.add('is-panning');
    };
    const onMove = (e: PointerEvent) => {
      if (!start || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 2 && start.dist && start.mid) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const k = clamp(start.view.k * (dist / start.dist), 0.2, 2.5);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const wx = (start.mid.x - start.view.x) / start.view.k;
        const wy = (start.mid.y - start.view.y) / start.view.k;
        setView({ k, x: mid.x - wx * k, y: mid.y - wy * k });
        return;
      }
      const p = local(e);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!pointers.size) {
        start = null;
        el.classList.remove('is-panning');
      } else start = { ...[...pointers.values()][0], view: viewRef.current };
      if (moved > 6) {
        // swallow the click that ends a drag
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        el.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', stop, { capture: true } as never), 0);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.nopan')) return;
      e.preventDefault();
      const v = viewRef.current;
      const p = local(e);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      const k = clamp(v.k * factor, 0.2, 2.5);
      const wx = (p.x - v.x) / v.k;
      const wy = (p.y - v.y) / v.k;
      setView({ k, x: p.x - wx * k, y: p.y - wy * k });
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);
  const zoomBy = (f: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    const k = clamp(v.k * f, 0.2, 2.5);
    const cx = r.width / 2;
    const cy = r.height / 2;
    setView({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k });
  };
  return { ref, view, setView, zoomBy };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ZoomControls({ zoomBy, onFit, extra }: { zoomBy: (f: number) => void; onFit: () => void; extra?: JSX.Element | null }) {
  return (
    <div class="mapctl nopan">
      <button type="button" class="btn btn--icon btn--sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
        <Icon name="zoom-in" />
      </button>
      <button type="button" class="btn btn--icon btn--sm" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">
        <Icon name="zoom-out" />
      </button>
      <button type="button" class="btn btn--icon btn--sm" onClick={onFit} aria-label="Fit everything" title="Fit everything">
        <Icon name="scan" />
      </button>
      {extra}
    </div>
  );
}

// ─── FLOW ─────────────────────────────────────────────────────────────────

const NODE_W = 178;
const NODE_H = 78;

function flowGeometry(vertical: boolean) {
  const scenes = all<Scene>('scene');
  const COL = vertical ? 118 : 212;
  const LANE = vertical ? 204 : 98;
  const pos = new Map<string, { x: number; y: number }>();
  for (const s of scenes) {
    const { col, lane } = s.layout;
    const x = vertical ? (lane + 2.5) * LANE - NODE_W / 2 + 30 : col * COL + 40;
    const y = vertical ? col * COL + 90 : (lane + 2.5) * LANE + 70 - NODE_H / 2;
    pos.set(s.id, { x, y });
  }
  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const width = Math.max(...xs) + NODE_W + 60;
  const height = Math.max(...ys) + NODE_H + 60;
  return { scenes, pos, width, height };
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, vertical: boolean) {
  if (vertical) {
    const x1 = a.x + NODE_W / 2;
    const y1 = a.y + NODE_H;
    const x2 = b.x + NODE_W / 2;
    const y2 = b.y;
    const dy = Math.max(30, (y2 - y1) / 2);
    return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
  }
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(30, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function FlowMap() {
  const ui = getUi();
  const narrow = useMedia('(max-width: 760px)');
  const vertical = ui.mapVertical ?? narrow;
  const g = game();
  const geo = useMemo(() => flowGeometry(vertical), [vertical, getDataVersion()]);
  const acts = all<Act>('act');
  const selected = ui.mapSelected ? ent<Scene>('scene', ui.mapSelected) : undefined;

  const centerOn = (id: string, k = narrow ? 0.8 : 0.9): View => {
    const p = geo.pos.get(id);
    const vw = vpRef.current?.clientWidth ?? 1000;
    const vh = vpRef.current?.clientHeight ?? 600;
    if (!p) return { x: 20, y: 20, k };
    let x = vw / 2 - (p.x + NODE_W / 2) * k;
    let y = vh / 2 - (p.y + NODE_H / 2) * k;
    // never leave a wide empty margin before the first scene or after the last
    x = Math.min(24, Math.max(vw - geo.width * k - 24, x));
    y = geo.height * k < vh ? (vh - geo.height * k) / 2 : Math.min(24, Math.max(vh - geo.height * k - 24, y));
    return { k, x, y };
  };
  const vpRef = useRef<HTMLDivElement | null>(null);
  const pz = usePanZoom(() => centerOn(g.scene));
  const fit = () => {
    const vw = pz.ref.current?.clientWidth ?? 1000;
    const vh = pz.ref.current?.clientHeight ?? 600;
    const k = clamp(Math.min(vw / geo.width, vh / geo.height) * 0.96, 0.15, 1.2);
    pz.setView({ k, x: (vw - geo.width * k) / 2, y: (vh - geo.height * k) / 2 });
  };
  useLayoutEffect(() => {
    vpRef.current = pz.ref.current;
    pz.setView(centerOn(g.scene));
  }, [vertical]);

  // act bands
  const bands = acts.map((a) => {
    const ids = geo.scenes.filter((s) => s.act === a.id).map((s) => geo.pos.get(s.id)!);
    const minX = Math.min(...ids.map((p) => p.x)) - 14;
    const maxX = Math.max(...ids.map((p) => p.x)) + NODE_W + 14;
    const minY = Math.min(...ids.map((p) => p.y)) - 14;
    const maxY = Math.max(...ids.map((p) => p.y)) + NODE_H + 14;
    return { a, minX, maxX, minY, maxY };
  });

  const edges: { from: Scene; to: Scene; d: string; state: 'done' | 'live' | 'out' }[] = [];
  for (const s of geo.scenes) {
    for (const n of s.next) {
      const t = geo.scenes.find((x) => x.id === n);
      if (!t) continue;
      // toothless → fourth-mask only when the Cat is out of the run; toothless → cat only when in
      const out = !sceneInPlay(s) || !sceneInPlay(t) || (s.id === 'toothless' && t.id === 'fourth-mask' && g.catVariant);
      const done = sceneStatus(s) === 'done' && (sceneStatus(t) === 'done' || sceneStatus(t) === 'active');
      edges.push({ from: s, to: t, d: edgePath(geo.pos.get(s.id)!, geo.pos.get(t.id)!, vertical), state: out ? 'out' : done ? 'done' : 'live' });
    }
  }

  const select = (id: string | null) => setUi({ mapSelected: id });

  return (
    <div class="flow">
      <div class="mapvp" ref={pz.ref} onClick={(e) => (e.target as HTMLElement).classList.contains('mapvp') && select(null)}>
        <div class="flow__stage" style={{ width: `${geo.width}px`, height: `${geo.height}px`, transform: `translate(${pz.view.x}px, ${pz.view.y}px) scale(${pz.view.k})` }}>
          {bands.map(({ a, minX, maxX, minY, maxY }) => (
            <div
              key={a.id}
              class="flow__band hue"
              style={{
                '--c': hueVar(a.hue),
                left: `${vertical ? minX - 30 : minX}px`,
                top: `${vertical ? minY : 6}px`,
                width: `${vertical ? geo.width - minX + 30 - 10 : maxX - minX}px`,
                height: `${vertical ? maxY - minY : geo.height - 12}px`,
              } as never}
            >
              <span class="flow__bandlabel">
                <span class="swatch" />
                {a.num}: {a.title}
              </span>
            </div>
          ))}
          <svg class="flow__edges" width={geo.width} height={geo.height} aria-hidden="true">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--line-2)" />
              </marker>
              <marker id="arrow-done" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--gold)" />
              </marker>
            </defs>
            {edges.map((e) => (
              <path
                key={`${e.from.id}-${e.to.id}`}
                d={e.d}
                class={cx('flow__edge', `flow__edge--${e.state}`)}
                marker-end={e.state === 'done' ? 'url(#arrow-done)' : 'url(#arrow)'}
              />
            ))}
          </svg>
          {geo.scenes.map((s) => {
            const p = geo.pos.get(s.id)!;
            const st = sceneStatus(s);
            const act = ent<Act>('act', s.act);
            const out = !sceneInPlay(s);
            return (
              <button
                key={s.id}
                type="button"
                class={cx('fnode hue', `fnode--${st}`, out && 'is-out', s.optional && 'is-opt', ui.mapSelected === s.id && 'is-sel')}
                style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${NODE_W}px`, height: `${NODE_H}px`, '--c': hueVar(act?.hue) } as never}
                onClick={() => select(s.id)}
                onDblClick={() => goScene(s.id)}
                title={`${s.slate} ${s.title}: ${s.logline}`}
              >
                <span class="fnode__top">
                  <span class="fnode__slate num">{s.slate}</span>
                  <span class="fnode__kind">{KIND_LABEL[s.kind]}</span>
                  {st === 'active' && <span class="rec" />}
                  {st === 'done' && <Icon name="check" size={13} class="fnode__ok" />}
                </span>
                <span class="fnode__title">{s.title}</span>
                {(s.branch || s.optional) && (
                  <span class="fnode__tag">{s.branch ? (s.branch === 'plane' ? 'Plane route' : 'Boat route') : s.expandedOnly ? 'Expanded build' : 'Optional room'}</span>
                )}
              </button>
            );
          })}
        </div>
        <ZoomControls
          zoomBy={pz.zoomBy}
          onFit={fit}
          extra={
            <>
              <button type="button" class="btn btn--icon btn--sm" onClick={() => pz.setView(centerOn(g.scene))} aria-label="Center on the current scene" title="Center on the current scene">
                <Icon name="crosshair" />
              </button>
              <button
                type="button"
                class="btn btn--icon btn--sm"
                onClick={() => setUi({ mapVertical: !vertical })}
                aria-label={vertical ? 'Lay out left to right' : 'Lay out top to bottom'}
                title={vertical ? 'Lay out left to right' : 'Lay out top to bottom'}
              >
                <Icon name={vertical ? 'columns-3' : 'rows-3'} />
              </button>
            </>
          }
        />
        <div class="maplegend nopan">
          <span><i class="lg lg--done" /> done</span>
          <span><i class="lg lg--active" /> now playing</span>
          <span><i class="lg lg--up" /> upcoming</span>
          <span><i class="lg lg--out" /> optional or skipped</span>
          <span class="muted">Drag to pan, scroll to zoom, double-click to play</span>
        </div>
        {selected && <FlowCard scene={selected} onClose={() => select(null)} />}
      </div>
    </div>
  );
}

function FlowCard({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const act = ent<Act>('act', scene.act);
  const isCurrent = game().scene === scene.id;
  const must = sceneMust(scene);
  return (
    <aside class="mapcard hue nopan" style={{ '--c': hueVar(act?.hue) } as never} aria-label={scene.title}>
      <div class="mapcard__head">
        <span class="mapcard__slate num">{scene.slate}</span>
        <div class="grow">
          <div class="eyebrow">
            {act?.num}: {act?.title}
          </div>
          <h3 class="mapcard__title">{scene.title}</h3>
        </div>
        <button type="button" class="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <div class="slug">{scene.slug}</div>
      <Rich text={scene.logline} class="mapcard__log" />
      {must.length > 0 && (
        <div class="must">
          <div class="must__label">
            <Icon name="flag-triangle-right" size={13} /> Must happen
          </div>
          <RichList items={must.slice(0, 3)} />
        </div>
      )}
      {scene.cast?.length ? (
        <div class="chips">
          {scene.cast.slice(0, 8).map((c) => (
            <Ref key={c} type="npc" id={c} chip />
          ))}
        </div>
      ) : null}
      <div class="row">
        {isCurrent ? (
          <Badge tone="rec">Now playing</Badge>
        ) : (
          <button type="button" class="btn btn--sm btn--primary" onClick={() => goScene(scene.id)}>
            <Icon name="play" /> Play
          </button>
        )}
        <button type="button" class="btn btn--sm" onClick={() => setUi({ view: 'story', focusScene: scene.id })}>
          <Icon name="scroll-text" /> Script
        </button>
        <button type="button" class="btn btn--sm btn--ghost" onClick={() => openDrawer('scene', scene.id)}>
          <Icon name="info" /> Details
        </button>
      </div>
    </aside>
  );
}

// ─── WEB ──────────────────────────────────────────────────────────────────

interface GNode {
  key: string;
  type: EntityType;
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
}

interface GEdge {
  a: string;
  b: string;
  kind: 'rel' | 'film' | 'cast' | 'holds';
  label: string;
}

const WEB_TYPES: { id: EntityType; label: string; shape: string }[] = [
  { id: 'pc', label: 'Players', shape: 'circle-lg' },
  { id: 'npc', label: 'Characters', shape: 'circle' },
  { id: 'film', label: 'Films', shape: 'square' },
  { id: 'item', label: 'Key items', shape: 'diamond' },
  { id: 'scene', label: 'Scenes', shape: 'pill' },
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function buildGraph(types: string[]) {
  const nodes = new Map<string, GNode>();
  const add = (type: EntityType, id: string) => {
    const key = `${type}:${id}`;
    if (!types.includes(type) || nodes.has(key) || !ent(type, id)) return;
    nodes.set(key, { key, type, id, label: nameOf(type, id), x: 0, y: 0, vx: 0, vy: 0, deg: 0 });
  };
  for (const p of all<PC>('pc')) add('pc', p.id);
  for (const n of all<NPC>('npc')) add('npc', n.id);
  for (const f of all<Film>('film')) add('film', f.id);
  const keyItems = all<Item>('item').filter((i) => ['mask', 'key', 'hazard'].includes(i.kind) || i.id === 'donuts' || i.id === 'dr-pepper');
  for (const i of keyItems) add('item', i.id);
  for (const s of all<Scene>('scene')) add('scene', s.id);

  const edges: GEdge[] = [];
  const link = (a: string, b: string, kind: GEdge['kind'], label: string) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    edges.push({ a, b, kind, label });
  };
  for (const r of RELATIONS) link(r.a, r.b, 'rel', r.label);
  for (const n of all<NPC>('npc')) if (n.film) link(`npc:${n.id}`, `film:${n.film}`, 'film', 'from');
  for (const p of all<PC>('pc')) for (const f of p.films ?? []) link(`pc:${p.id}`, `film:${f}`, 'film', 'inspired by');
  for (const i of keyItems) {
    for (const f of i.films ?? []) link(`item:${i.id}`, `film:${f}`, 'film', 'from');
    if (i.holder && i.holder !== 'party') link(`item:${i.id}`, `${ent('pc', i.holder) ? 'pc' : 'npc'}:${i.holder}`, 'holds', i.state === 'missing' ? 'secretly has' : 'held by');
  }
  for (const s of all<Scene>('scene')) {
    for (const c of s.cast ?? []) link(`scene:${s.id}`, `npc:${c}`, 'cast', 'appears in');
    for (const f of s.films ?? []) link(`scene:${s.id}`, `film:${f}`, 'film', 'references');
  }
  for (const e of edges) {
    nodes.get(e.a)!.deg++;
    nodes.get(e.b)!.deg++;
  }
  return { nodes: [...nodes.values()], edges };
}

function simulate(nodes: GNode[], edges: GEdge[], w: number, h: number) {
  const idx = new Map(nodes.map((n, i) => [n.key, i]));
  const cx = w / 2;
  const cy = h / 2;
  nodes.forEach((n) => {
    const a = hash(n.key) * Math.PI * 2;
    const r = (n.type === 'pc' ? 0.12 : n.type === 'film' ? 0.42 : n.type === 'scene' ? 0.36 : 0.3) * Math.min(w, h) * (0.6 + hash(n.key + 'r') * 0.8);
    n.x = cx + Math.cos(a) * r;
    n.y = cy + Math.sin(a) * r;
    n.vx = n.vy = 0;
  });
  const N = 420;
  const springLen = (e: GEdge) => (e.kind === 'rel' ? 90 : e.kind === 'film' ? 105 : 120);
  for (let it = 0; it < N; it++) {
    const alpha = 1 - it / N;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (hash(a.key + b.key) - 0.5) * 2;
          dy = (hash(b.key + a.key) - 0.5) * 2;
          d2 = dx * dx + dy * dy;
        }
        if (d2 > 160000) continue;
        const f = (5200 / d2) * alpha;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = nodes[idx.get(e.a)!];
      const b = nodes[idx.get(e.b)!];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - springLen(e)) * 0.02 * alpha;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.006 * alpha;
      n.vy += (cy - n.y) * 0.006 * alpha;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x = clamp(n.x + n.vx, 30, w - 30);
      n.y = clamp(n.y + n.vy, 30, h - 30);
    }
  }
}

function WebGraph() {
  const ui = getUi();
  const types = ui.webFilter;
  const W = 1600;
  const H = 1100;
  const graph = useMemo(() => {
    const g = buildGraph(types);
    simulate(g.nodes, g.edges, W, H);
    return g;
  }, [types.join(','), getDataVersion()]);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const focus = sel ?? hover;
  // "On the web" from a drawer: select that node once the graph includes it
  useEffect(() => {
    if (ui.webFocus && graph.nodes.some((n) => n.key === ui.webFocus)) {
      setSel(ui.webFocus);
      setUi({ webFocus: null });
    }
  }, [ui.webFocus, graph]);
  const neighbors = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const e of graph.edges) {
      if (e.a === focus) s.add(e.b);
      if (e.b === focus) s.add(e.a);
    }
    return s;
  }, [focus, graph]);
  const q = query.trim().toLowerCase();
  const matches = q ? new Set(graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.key)) : null;

  const pz = usePanZoom(() => ({ x: 0, y: 0, k: 0.6 }));
  const fit = () => {
    const vw = pz.ref.current?.clientWidth ?? 1000;
    const vh = pz.ref.current?.clientHeight ?? 600;
    const xs = graph.nodes.map((n) => n.x);
    const ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 40;
    const maxY = Math.max(...ys) + 50;
    const k = clamp(Math.min(vw / (maxX - minX), (vh - 40) / (maxY - minY)), 0.25, 1.8);
    pz.setView({ k, x: (vw - (maxX + minX) * k) / 2, y: (vh - 40 - (maxY + minY) * k) / 2 });
  };
  useLayoutEffect(fit, [graph]);

  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
  const selNode = sel ? byKey.get(sel) : undefined;
  const showLabel = (n: GNode) =>
    pz.view.k > 1.1 || n.type === 'pc' || n.type === 'film' ? n.deg > 0 || n.type === 'pc' : n.deg >= 4 || (neighbors?.has(n.key) ?? false) || (matches?.has(n.key) ?? false);

  const toggleType = (t: EntityType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    if (next.length) setUi({ webFilter: next });
  };

  return (
    <div class="web">
      <div class="webbar nopan">
        <div class="chips" role="group" aria-label="Show">
          {WEB_TYPES.map((t) => (
            <button key={t.id} type="button" class={cx('toggle-chip', types.includes(t.id) && 'is-on')} aria-pressed={types.includes(t.id)} onClick={() => toggleType(t.id)}>
              <span class={cx('webkey', `webkey--${t.shape}`)} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
        <label class="searchfield websearch">
          <Icon name="search" size={15} />
          <input class="input input--sm" placeholder="Highlight a name" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="Highlight a name" />
        </label>
      </div>
      <div class="mapvp" ref={pz.ref} onClick={(e) => (e.target as Element).tagName === 'svg' && setSel(null)}>
        <svg class="web__svg" width={W} height={H} style={{ transform: `translate(${pz.view.x}px, ${pz.view.y}px) scale(${pz.view.k})` }} role="img" aria-label="Connections between characters, films, items and scenes">
          <defs>
            <clipPath id="wface" clipPathUnits="objectBoundingBox">
              <circle cx="0.5" cy="0.5" r="0.5" />
            </clipPath>
          </defs>
          <g class="web__edges">
            {graph.edges.map((e) => {
              const a = byKey.get(e.a)!;
              const b = byKey.get(e.b)!;
              const on = neighbors ? neighbors.has(e.a) && neighbors.has(e.b) && (e.a === focus || e.b === focus) : false;
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  class={cx('wedge', `wedge--${e.kind}`, on && 'is-on', neighbors && !on && 'is-dim')}
                />
              );
            })}
          </g>
          <g class="web__nodes">
            {graph.nodes.map((n) => {
              const dim = (neighbors && !neighbors.has(n.key)) || (matches && !matches.has(n.key));
              const e = ent(n.type, n.id) as { hue?: PC['hue']; status?: string; favorite?: boolean; state?: string; act?: string } | undefined;
              const face = n.type === 'pc' || n.type === 'npc' || n.type === 'item' ? portraitOf(n.type, n.id) : undefined;
              const r = n.type === 'pc' ? (face ? 19 : 15) : n.type === 'npc' ? (face ? 11 + Math.min(5, n.deg) : 6 + Math.min(6, n.deg)) : face ? 11 : 8;
              const hueC = n.type === 'pc' ? hueVar(e?.hue) : n.type === 'scene' ? hueVar(ent<Act>('act', e?.act ?? '')?.hue) : undefined;
              const struck = n.type === 'npc' && (e?.status === 'defeated' || e?.status === 'dead');
              return (
                <g
                  key={n.key}
                  class={cx('wnode', `wnode--${n.type}`, dim && 'is-dim', focus === n.key && 'is-focus', struck && 'is-struck', n.type === 'film' && e?.favorite && 'is-fav')}
                  transform={`translate(${n.x},${n.y})`}
                  style={hueC ? ({ '--c': hueC } as never) : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label} (${n.type})`}
                  onMouseEnter={() => setHover(n.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.key)}
                  onBlur={() => setHover(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSel(sel === n.key ? null : n.key);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') openDrawer(n.type, n.id);
                  }}
                  onDblClick={() => openDrawer(n.type, n.id)}
                >
                  <circle r={Math.max(14, r + 6)} class="wnode__hit" />
                  {face ? (
                    <>
                      <image href={face} x={-r} y={-r} width={r * 2} height={r * 2} clip-path="url(#wface)" preserveAspectRatio="xMidYMid slice" class="wnode__img" />
                      <circle r={r} class="wnode__shape wnode__ring" />
                    </>
                  ) : n.type === 'film' ? (
                    <rect x={-8} y={-8} width={16} height={16} rx={3} class="wnode__shape" />
                  ) : n.type === 'item' ? (
                    <rect x={-6.5} y={-6.5} width={13} height={13} rx={2} transform="rotate(45)" class="wnode__shape" />
                  ) : n.type === 'scene' ? (
                    <rect x={-15} y={-8} width={30} height={16} rx={8} class="wnode__shape" />
                  ) : (
                    <circle r={r} class="wnode__shape" />
                  )}
                  {n.type === 'scene' && (
                    <text class="wnode__slate" text-anchor="middle" dy="3.5">
                      {(e as unknown as Scene)?.slate}
                    </text>
                  )}
                  {showLabel(n) && (
                    <text class="wnode__label" text-anchor="middle" y={r + 14}>
                      {n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <ZoomControls zoomBy={pz.zoomBy} onFit={fit} />
        <div class="maplegend nopan">
          {WEB_TYPES.filter((t) => types.includes(t.id)).map((t) => (
            <span key={t.id}>
              <span class={cx('webkey', `webkey--${t.shape}`)} aria-hidden="true" /> {t.label}
            </span>
          ))}
          <span>
            <span class="webkey webkey--rel" aria-hidden="true" /> story link
          </span>
          <span class="muted">Hover to trace, click to pin, double-click for details</span>
        </div>
        {selNode && <WebCard node={selNode} edges={graph.edges} byKey={byKey} onClose={() => setSel(null)} />}
        {!selNode && hover && byKey.get(hover) && <WebTip node={byKey.get(hover)!} edges={graph.edges} />}
      </div>
    </div>
  );
}

function connectionsOf(node: GNode, edges: GEdge[]) {
  return edges
    .filter((e) => e.a === node.key || e.b === node.key)
    .map((e) => {
      const other = e.a === node.key ? e.b : e.a;
      const [type, id] = other.split(':') as [EntityType, string];
      const outgoing = e.a === node.key;
      return { type, id, label: e.label, kind: e.kind, outgoing };
    })
    .sort((a, b) => (a.kind === 'rel' ? -1 : 0) - (b.kind === 'rel' ? -1 : 0));
}

function WebTip({ node, edges }: { node: GNode; edges: GEdge[] }) {
  const n = connectionsOf(node, edges).length;
  return (
    <div class="webtip nopan" role="status">
      <strong>{node.label}</strong>
      <span class="muted">
        {' '}
        · {n} connection{n === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function WebCard({ node, edges, onClose }: { node: GNode; edges: GEdge[]; byKey: Map<string, GNode>; onClose: () => void }) {
  const conns = connectionsOf(node, edges);
  const e = ent(node.type, node.id);
  return (
    <aside class="mapcard nopan" aria-label={node.label}>
      <div class="mapcard__head">
        <span class="mapcard__icon">
          <Icon name={iconOf(node.type, e)} size={18} />
        </span>
        <div class="grow">
          <div class="eyebrow">{WEB_TYPES.find((t) => t.id === node.type)?.label.replace(/s$/, '')}</div>
          <h3 class="mapcard__title">{node.label}</h3>
        </div>
        <button type="button" class="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <div class="webconns">
        <div class="label">
          <Icon name="network" size={13} /> {conns.length} connection{conns.length === 1 ? '' : 's'}
        </div>
        <ul>
          {conns.map((c) => (
            <li key={`${c.type}:${c.id}`} class={cx('webconn', c.kind === 'rel' && 'webconn--rel')}>
              <span class="webconn__label">{c.kind === 'rel' ? (c.outgoing ? c.label : `← ${c.label}`) : c.label}</span>
              <Ref type={c.type} id={c.id} noDot />
            </li>
          ))}
        </ul>
      </div>
      <button type="button" class="btn btn--sm" onClick={() => openDrawer(node.type, node.id)}>
        <Icon name="info" /> Open details
      </button>
    </aside>
  );
}

// ─── TIMELINE (pacing) ────────────────────────────────────────────────────

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function sectionActual(scenes: string[]) {
  return scenes.reduce((a, s) => a + timeSpent(s), 0) / 60000;
}

function PacingChart({ table }: { table: boolean }) {
  const g = game();
  useTick(5000, g.timer.running);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const rows = PACING.filter((p) => p.scenes.some((id) => sceneInPlay(ent<Scene>('scene', id)!))).map((p) => {
    const actual = sectionActual(p.scenes);
    const current = p.scenes.includes(g.scene);
    const firstAct = ent<Act>('act', ent<Scene>('scene', p.scenes[0])!.act);
    return { ...p, actual, current, act: firstAct };
  });
  const maxX = Math.max(30, ...rows.map((r) => Math.max(r.min[1], r.actual))) * 1.08;
  const LABEL = Math.min(230, Math.max(130, width * 0.28));
  const RIGHT = 56;
  const plotW = Math.max(120, width - LABEL - RIGHT);
  const ROW = 40;
  const TOP = 26;
  const H = TOP + rows.length * ROW + 10;
  const x = (m: number) => LABEL + (m / maxX) * plotW;
  const step = maxX > 90 ? 30 : 15;
  const ticks: number[] = [];
  for (let t = 0; t <= maxX; t += step) ticks.push(t);

  if (table) {
    return (
      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.label}
                  {r.current && <span class="muted"> · now</span>}
                </td>
                <td class="num">
                  {r.min[0]}–{r.min[1]} min
                </td>
                <td class="num">{r.actual ? `${Math.round(r.actual)} min` : '—'}</td>
                <td>{r.actual > r.min[1] ? `Over by ${Math.round(r.actual - r.min[1])} min` : r.actual ? 'On pace' : 'Not started'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div class="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label="Target and actual minutes for each part of the night">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={H - 6} class="chart__grid" />
            <text x={x(t)} y={TOP - 12} class="chart__tick" text-anchor="middle">
              {t === 0 ? '0' : t % 60 === 0 ? `${t / 60}h` : `${t}m`}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * ROW;
          const over = r.actual > r.min[1];
          const actualW = Math.max(0, x(r.actual) - x(0));
          return (
            <g
              key={r.id}
              class={cx('prow', r.current && 'is-current', hover === i && 'is-hover')}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${r.label}: target ${r.min[0]} to ${r.min[1]} minutes, actual ${Math.round(r.actual)} minutes`}
            >
              <rect x={0} y={y} width={width} height={ROW} class="prow__hit" />
              <text x={0} y={y + ROW / 2 + 4} class={cx('chart__label', r.current && 'is-strong')}>
                {r.current ? '● ' : ''}
                {r.label.length > 30 && width < 560 ? r.label.slice(0, 28) + '…' : r.label}
              </text>
              <rect x={x(r.min[0])} y={y + ROW / 2 - 8} width={x(r.min[1]) - x(r.min[0])} height={16} rx={4} class="prow__target" />
              {r.actual > 0 && (
                <path
                  d={`M${x(0)},${y + ROW / 2 - 3} h${Math.max(0, actualW - 3)} a3,3 0 0 1 3,3 a3,3 0 0 1 -3,3 h${-Math.max(0, actualW - 3)} z`}
                  class={cx('prow__actual', over && 'is-over')}
                />
              )}
              <text x={Math.max(x(r.min[1]), x(r.actual)) + 8} y={y + ROW / 2 + 4} class="chart__value">
                {r.actual > 0 ? `${Math.round(r.actual)}m${over ? ` · +${Math.round(r.actual - r.min[1])}` : ''}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && rows[hover] && (
        <div class="charttip" style={{ top: `${TOP + hover * ROW + ROW}px`, left: `${Math.min(width - 260, LABEL)}px` }}>
          <div class="charttip__v num">
            {rows[hover].actual ? `${Math.round(rows[hover].actual)} min` : 'Not started'}
          </div>
          <div class="charttip__k">
            {rows[hover].label} · target {rows[hover].min[0]}–{rows[hover].min[1]} min
          </div>
          <div class="charttip__k">{rows[hover].scenes.map((s) => ent<Scene>('scene', s)?.title).join(', ')}</div>
        </div>
      )}
      <div class="chart__legend">
        <span>
          <i class="key key--target" /> Target range
        </span>
        <span>
          <i class="key key--actual" /> Time spent (session timer)
        </span>
        <span>
          <i class="key key--over" /> Over target
        </span>
      </div>
    </div>
  );
}

function ClockChart() {
  const g = game();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = CLOCK_RHYTHM;
  const order = all<Scene>('scene').map((s) => s.id);
  const curIdx = order.indexOf(g.scene);
  // where the current scene sits among the checkpoints
  let here = 0;
  pts.forEach((p, i) => {
    if (order.indexOf(p.at) <= curIdx) here = i;
  });
  const H = 220;
  const L = 40;
  const R = 20;
  const T = 16;
  const B = 44;
  const plotW = Math.max(200, width - L - R);
  const x = (i: number) => L + (i / (pts.length - 1)) * plotW;
  const y = (h: number) => T + (1 - h / 36) * (H - T - B);
  const band =
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.hours[1])}`).join(' ') +
    ' ' +
    [...pts].reverse().map((p, j) => `L${x(pts.length - 1 - j)},${y(p.hours[0])}`).join(' ') +
    ' Z';
  const mid = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y((p.hours[0] + p.hours[1]) / 2)}`).join(' ');
  return (
    <div class="chart" ref={ref}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Suggested hours left on the wedding clock at each checkpoint, with the current clock"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const px = e.clientX - r.left;
          setHover(clamp(Math.round(((px - L) / plotW) * (pts.length - 1)), 0, pts.length - 1));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 12, 24, 36].map((h) => (
          <g key={h}>
            <line x1={L} x2={L + plotW} y1={y(h)} y2={y(h)} class="chart__grid" />
            <text x={L - 8} y={y(h) + 4} class="chart__tick" text-anchor="end">
              {h}h
            </text>
          </g>
        ))}
        <path d={band} class="clock__band" />
        <path d={mid} class="clock__line" />
        {pts.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - B + 18} class="chart__tick" text-anchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>
            {width < 620 ? `${i + 1}` : p.label}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} class="chart__cross" />}
        <circle cx={x(here)} cy={y(g.clock)} r={6} class="clock__now" />
        <text x={x(here) + (here === pts.length - 1 ? -10 : 10)} y={y(g.clock) - 10} class="chart__value is-strong" text-anchor={here === pts.length - 1 ? 'end' : 'start'}>
          Now {Math.round(g.clock * 10) / 10}h
        </text>
      </svg>
      {hover != null && (
        <div class="charttip" style={{ top: '20px', left: `${clamp(x(hover) + 12, 0, width - 230)}px` }}>
          <div class="charttip__v num">
            {pts[hover].hours[0] === pts[hover].hours[1] ? `${pts[hover].hours[0]}h` : `${pts[hover].hours[0]}–${pts[hover].hours[1]}h`}
          </div>
          <div class="charttip__k">{pts[hover].label}</div>
        </div>
      )}
      <div class="chart__legend">
        <span>
          <i class="key key--band" /> Suggested hours left
        </span>
        <span>
          <i class="key key--now" /> Wedding clock now
        </span>
        {width < 620 && <span class="muted">{pts.map((p, i) => `${i + 1} ${p.label}`).join(' · ')}</span>}
      </div>
    </div>
  );
}

function Timeline() {
  const g = game();
  useTick(1000, g.timer.running);
  const [table, setTable] = useState(false);
  const rows = PACING.filter((p) => p.scenes.some((id) => sceneInPlay(ent<Scene>('scene', id)!)));
  const target = rows.reduce((a, r) => [a[0] + r.min[0], a[1] + r.min[1]], [0, 0]);
  const elapsed = totalSpent() / 60000;
  const curRow = rows.findIndex((r) => r.scenes.includes(g.scene));
  const remaining = rows.slice(Math.max(0, curRow)).reduce((a, r, i) => {
    const mid = (r.min[0] + r.min[1]) / 2;
    if (i === 0) return a + Math.max(0, mid - sectionActual(r.scenes));
    return a + mid;
  }, 0);
  const done = all<Scene>('scene').filter((s) => sceneInPlay(s) && s.status === 'done').length;
  const total = all<Scene>('scene').filter(sceneInPlay).length;
  return (
    <div class="timeline">
      <div class="tiles">
        <div class="tile">
          <div class="tile__label">Session so far</div>
          <div class="tile__value">{fmtDuration(totalSpent())}</div>
          <div class="tile__sub">{g.timer.running ? 'Timer running' : 'Timer paused'}</div>
        </div>
        <div class="tile">
          <div class="tile__label">Projected length</div>
          <div class="tile__value">{fmtH(elapsed + remaining)}</div>
          <div class="tile__sub">
            Target {fmtH(target[0])} to {fmtH(target[1])}
          </div>
        </div>
        <div class="tile">
          <div class="tile__label">Scenes done</div>
          <div class="tile__value">
            {done}
            <span class="tile__of">/{total}</span>
          </div>
          <div class="tile__sub">On this route and version</div>
        </div>
        <div class="tile">
          <div class="tile__label">Wedding clock</div>
          <div class="tile__value">{Math.round(g.clock * 10) / 10}h</div>
          <div class="tile__sub">In-story hours left</div>
        </div>
      </div>
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">
            <Icon name="chart-gantt" size={15} /> Pacing: target vs. time spent
          </span>
          <div class="seg seg--sm">
            <button type="button" aria-pressed={!table} onClick={() => setTable(false)}>
              Chart
            </button>
            <button type="button" aria-pressed={table} onClick={() => setTable(true)}>
              Table
            </button>
          </div>
        </div>
        <PacingChart table={table} />
        {!g.timer.running && elapsed === 0 && (
          <div class="callout" style={{ marginTop: '10px' }}>
            <Icon name="timer" size={16} />
            <span>Start the session timer (the clock in the top bar or the Run screen) and time spent fills in per section.</span>
          </div>
        )}
      </section>
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">
            <Icon name="alarm-clock" size={15} /> Wedding clock: the suggested rhythm
          </span>
        </div>
        <ClockChart />
      </section>
    </div>
  );
}

const fmtH = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

// ─── view ─────────────────────────────────────────────────────────────────

export function MapView() {
  const ui = getUi();
  const modes = [
    { id: 'flow', label: 'Story flow', icon: 'workflow' },
    { id: 'web', label: 'Connections', icon: 'chart-network' },
    { id: 'timeline', label: 'Pacing', icon: 'chart-gantt' },
  ] as const;
  return (
    <div class={cx('view map', `map--${ui.mapMode}`)}>
      <div class="map__bar">
        <div class="seg" role="tablist" aria-label="Map mode">
          {modes.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={ui.mapMode === m.id} aria-pressed={ui.mapMode === m.id} onClick={() => setUi({ mapMode: m.id })}>
              <Icon name={m.icon} /> {m.label}
            </button>
          ))}
        </div>
        <p class="map__hint muted">
          {ui.mapMode === 'flow' && 'Every scene and branch in story order. Optional rooms and the other route stay visible, dimmed.'}
          {ui.mapMode === 'web' && 'Who is connected to whom: characters, the films they come from, key items and scenes.'}
          {ui.mapMode === 'timeline' && 'Where the night stands against the 4 to 6 hour plan and the wedding clock.'}
        </p>
      </div>
      {ui.mapMode === 'flow' && <FlowMap />}
      {ui.mapMode === 'web' && <WebGraph />}
      {ui.mapMode === 'timeline' && <Timeline />}
    </div>
  );
}
