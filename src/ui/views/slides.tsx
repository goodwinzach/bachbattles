// SLIDES: a deck generated live from the campaign data. "Table" hides every secret so it can go
// on a TV for the players; "DM" shows secrets, stat blocks and speaker notes.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Ability, Act, Clue, Film, Location, NPC, PC, Scene } from '../../data/types';
import { STAT_ABBR, STATS } from '../../data/types';
import { goScene } from '../../state/actions';
import { abilitiesOf, abilityStatus, KIND_LABEL, npcStat, portraitOf, sceneInPlay, sceneMust, shielded, sourcesOf, strip } from '../../state/derive';
import { signed } from '../../state/dice';
import { all, ent, game, getDataVersion, getUi, setUi } from '../../state/store';
import { isTyping } from '../hooks';
import { Icon } from '../icons';
import { cx, hueVar } from '../kit';
import { Rich, RichList } from '../rich';

type SlideKind = 'title' | 'rules' | 'cast' | 'act' | 'place' | 'scene' | 'boss' | 'enter' | 'riddle' | 'reveal' | 'credits';

interface Slide {
  key: string;
  kind: SlideKind;
  title: string;
  scene?: string;
  act?: string;
  dmOnly?: boolean;
  render: (dm: boolean) => ComponentChildren;
  notes?: (dm: boolean) => ComponentChildren;
}

// ─── slide bodies ─────────────────────────────────────────────────────────

function TitleSlide() {
  const pcs = all<PC>('pc');
  return (
    <div class="sl sl--title">
      <div class="sl__ring" aria-hidden="true" />
      <div class="sl__eyebrow">A bachelor-party one-shot</div>
      <h1 class="sl__mark">One Ring to Rule Flynn</h1>
      <div class="sl__cast">
        {pcs.map((p) => (
          <span key={p.id} class="sl__castname hue" style={{ '--c': hueVar(p.hue) } as never}>
            <span class="sl__dot" />
            {p.name}
          </span>
        ))}
      </div>
      <div class="sl__credit">Dungeon Master: Nathan · Running time 4 to 6 hours</div>
    </div>
  );
}

function RulesSlide({ which }: { which: 'roll' | 'death' }) {
  if (which === 'roll') {
    return (
      <div class="sl sl--rules">
        <div class="sl__eyebrow">How this works</div>
        <h2 class="sl__h">Roll a d20. Add a stat. Beat the number.</h2>
        <div class="sl__stats">
          {['Strength', 'Agility', 'Charisma', 'Perception', 'Intelligence'].map((s) => (
            <span key={s} class="sl__stat">
              {s}
            </span>
          ))}
        </div>
        <div class="sl__dcs">
          {[
            [8, 'Easy'],
            [10, 'Standard'],
            [12, 'Tricky'],
            [15, 'Hard'],
            [18, 'Very hard'],
            ['20+', 'Ridiculous'],
          ].map(([n, l]) => (
            <div key={String(n)} class="sl__dc">
              <span class="sl__dcn">{n}</span>
              <span class="sl__dcl">{l}</span>
            </div>
          ))}
        </div>
        <ul class="sl__bullets">
          <li>Advantage: roll two d20s, keep the higher. Disadvantage: keep the lower.</li>
          <li>Natural 20: it works, plus a bonus. Natural 1: it fails, plus a complication.</li>
          <li>Fights: one move and one action per turn. Ranges are Close, Nearby and Far Away.</li>
        </ul>
      </div>
    );
  }
  return (
    <div class="sl sl--rules">
      <div class="sl__eyebrow">House rules</div>
      <h2 class="sl__h">If you die, you keep playing.</h2>
      <div class="sl__two">
        <div class="sl__card">
          <div class="sl__cardicon">
            <Icon name="ghost" size={34} />
          </div>
          <h3>You become a ghost</h3>
          <p>You look completely real. You can talk, move, lie, distract and scout. You can't be hurt, and you can't hit anything.</p>
        </div>
        <div class="sl__card">
          <div class="sl__cardicon">
            <Icon name="bagel" size={34} />
          </div>
          <h3>The Bagel Rule</h3>
          <p>A living friend eats a bagel and does something statistically improbable, in real life, in person. Then you come back.</p>
        </div>
      </div>
    </div>
  );
}

function CastSlide({ pc, dm }: { pc: PC; dm: boolean }) {
  const abs = abilitiesOf(pc.id).filter((a) => dm || !a.secret || a.revealed);
  return (
    <div class="sl sl--cast hue" style={{ '--c': hueVar(pc.hue) } as never}>
      <div class={cx('sl__portrait', portraitOf('pc', pc.id) && 'sl__portrait--img')}>
        {portraitOf('pc', pc.id) ? <img src={portraitOf('pc', pc.id)} alt="" /> : <Icon name={pc.icon} size={120} stroke={1.4} />}
      </div>
      <div class="sl__castbody">
        <div class="sl__eyebrow">Played by {pc.player}</div>
        <h2 class="sl__h sl__h--xl">{pc.name}</h2>
        <div class="sl__sub">{pc.title}</div>
        <p class="sl__tagline">{strip(pc.tagline)}</p>
        <div class="sl__statrow">
          {STATS.map((s) => (
            <div key={s} class="sl__statbox">
              <span class="sl__statk">{STAT_ABBR[s]}</span>
              <span class="sl__statv">{signed(pc.stats[s])}</span>
            </div>
          ))}
          <div class="sl__statbox">
            <span class="sl__statk">AC</span>
            <span class="sl__statv">{pc.ac}</span>
          </div>
          <div class="sl__statbox">
            <span class="sl__statk">HP</span>
            <span class="sl__statv">{pc.hpMax}</span>
          </div>
        </div>
        <ul class={cx('sl__abilities', abs.length > 3 && 'sl__abilities--grid')}>
          {abs.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong>
              {a.max ? <span class="sl__uses"> · {a.max} {a.recharge === 'campaign' ? 'per game' : a.recharge === 'scene' ? 'per scene' : 'per fight'}</span> : null}
              {a.secret && <span class="sl__secretflag"> · secret</span>}
              <span class="sl__absum">{strip(a.summary)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActSlide({ act }: { act: Act }) {
  return (
    <div class="sl sl--act hue" style={{ '--c': hueVar(act.hue) } as never}>
      <div class="sl__actnum">{act.num}</div>
      <h2 class="sl__acttitle">{act.title}</h2>
      <p class="sl__acttag">{act.tagline}</p>
    </div>
  );
}

/** The establishing shot when the story moves somewhere new: the place, full screen. */
function PlaceSlide({ loc }: { loc: Location }) {
  const src = portraitOf('location', loc.id);
  return (
    <div class={cx('sl sl--place', !src && 'sl--place-none')}>
      {src ? <img class="sl__placeimg" src={src} alt="" /> : <Icon name={loc.icon} size={120} stroke={1.2} />}
      <div class="sl__placeshade" />
      <div class="sl__placetext">
        <div class="sl__eyebrow">
          {loc.kind} · {loc.where}
        </div>
        <h2 class="sl__placename">{loc.name}</h2>
      </div>
    </div>
  );
}

/** Split read-aloud text into slide-sized pages. */
function pages(paras: string[], budget = 640): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const p of paras) {
    const l = strip(p).length;
    if (cur.length && len + l > budget) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(p);
    len += l;
  }
  if (cur.length) out.push(cur);
  return out.length ? out : [[]];
}

/** A slide whose content would spill past the frame (a long page plus the DM's must-happen box) steps its text down. */
function useTight() {
  const ref = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !tight && el.scrollHeight > el.clientHeight + 1) setTight(true);
  }, [tight]);
  return [ref, tight] as const;
}

function SceneSlide({ scene, dm, text, page, of }: { scene: Scene; dm: boolean; text: string[]; page: number; of: number }) {
  const act = ent<Act>('act', scene.act);
  const long = text.map(strip).join(' ').length > 520;
  const [ref, tight] = useTight();
  return (
    <div ref={ref} class={cx('sl sl--scene hue', tight && 'sl--tight')} style={{ '--c': hueVar(act?.hue) } as never}>
      {scene.location && portraitOf('location', scene.location) && (
        <div class="sl__backdrop" style={{ backgroundImage: `url("${portraitOf('location', scene.location)}")` }} aria-hidden="true" />
      )}
      <div class="sl__clap" aria-hidden="true" />
      <div class="sl__slate">
        <span class="sl__slateno">{scene.slate}</span>
        <span class="sl__slatemeta">
          {act?.num} · {act?.title}
        </span>
      </div>
      <h2 class={cx('sl__h sl__h--scene', page > 0 && 'sl__h--cont')}>{scene.title}</h2>
      <div class="sl__slug">
        {scene.slug}
        {of > 1 && <span class="sl__page"> · {page + 1} of {of}</span>}
      </div>
      {text.length > 0 && (
        <div class={cx('sl__read', long && 'sl__read--long')}>
          {text.map((p, i) => (
            <p key={i}>
              <Rich text={p} />
            </p>
          ))}
        </div>
      )}
      {dm && page === of - 1 && sceneMust(scene).length > 0 && (
        <div class="sl__must">
          <Icon name="flag-triangle-right" size={18} />
          <RichList items={sceneMust(scene).slice(0, 2)} />
        </div>
      )}
    </div>
  );
}

/** A character's entrance: portrait, where they're from, and one line. Bosses get stats in the DM deck. */
function CharacterSlide({ npc, dm }: { npc: NPC; dm: boolean }) {
  const film = sourcesOf('npc', npc.id, !dm || shielded())[0];
  const stat = npcStat(npc);
  const line = npc.entrance ?? npc.lines?.find((l) => !l.trim().startsWith('('));
  const src = portraitOf('npc', npc.id);
  const boss = npc.side === 'boss';
  return (
    <div class={cx('sl sl--boss', !boss && 'sl--enter')}>
      <div class={cx('sl__bossicon', src && 'sl__bossicon--img')}>{src ? <img src={src} alt="" /> : <Icon name={npc.icon} size={110} stroke={1.3} />}</div>
      <div class="sl__bossbody">
        <div class="sl__eyebrow">{film ? `From ${film.title}` : boss ? 'Enter' : 'Meet'}</div>
        <h2 class="sl__h sl__h--xl">{npc.name}</h2>
        {line && <blockquote class="sl__quote">“{line}”</blockquote>}
        {dm && stat && (
          <div class="sl__bossstats">
            <span>AC {stat.invincible ? '∞' : stat.ac}</span>
            <span>HP {stat.invincible ? '∞' : stat.hp}</span>
            {stat.attacks
              .filter((a) => a.bonus != null)
              .slice(0, 2)
              .map((a) => (
                <span key={a.name}>
                  {a.name} {signed(a.bonus!)} {a.dmg}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RiddleSlide() {
  return (
    <div class="sl sl--riddle">
      <div class="sl__eyebrow">Costello says</div>
      <p class="sl__riddle">“Out of the closet without a face.”</p>
    </div>
  );
}

function RevealSlide() {
  return (
    <div class="sl sl--reveal">
      <div class="sl__eyebrow">Flynn takes off the mask</div>
      <p class="sl__revealbig">Your Charisma is now +100.</p>
    </div>
  );
}

function CreditsSlide() {
  const favs = all<Film>('film').filter((f) => f.favorite);
  return (
    <div class="sl sl--credits">
      <div class="sl__eyebrow">With thanks to Flynn's favorite movies</div>
      <div class="sl__roll">
        <div class="sl__rollinner">
          {favs.map((f) => (
            <div key={f.id} class="sl__rollrow">
              {f.title}
            </div>
          ))}
          <div class="sl__rollend">The groomsmen all died of alcohol poisoning the night of the wedding.</div>
        </div>
      </div>
    </div>
  );
}

// ─── deck ─────────────────────────────────────────────────────────────────

/** Who gets an entrance slide after each scene's read-aloud (bosses, plus the characters the table should meet). */
const ENTRANCES: Record<string, string[]> = {
  'green-dragon': ['norton', 'antinous'],
  gentlemen: ['michael-pearson'],
  'louise-call': ['louise'],
  costello: ['costello'],
  airfield: ['tyler'],
  docks: ['tyler'],
  voyage: ['odysseus'],
  'john-doe': ['john-doe', 'medusa'],
  pride: ['david-frame'],
  greed: ['ted-terger'],
  envy: ['truman'],
  wrath: ['kingpin'],
  sloth: ['cypher'],
  gluttony: ['baron'],
  fielder: ['nathan-fielder'],
  'oh-dae-su': ['oh-dae-su'],
  toothless: ['toothless'],
  cat: ['cat'],
  'fourth-mask': ['lou'],
};

function sceneNotes(scene: Scene, dm: boolean) {
  if (!dm) return <p class="muted">Switch to the DM deck to see notes for this slide.</p>;
  return (
    <div class="stack" style={{ '--gap': '8px' } as never}>
      <Rich text={scene.logline} />
      {scene.notes?.length ? <RichList items={scene.notes.slice(0, 4)} /> : null}
      {scene.rolls?.length ? (
        <div class="muted">
          Rolls: {scene.rolls.map((r) => `${r.stat === 'any' ? 'any' : STAT_ABBR[r.stat]} ${r.dc}`).join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function buildDeck(dm: boolean): Slide[] {
  const deck: Slide[] = [];
  deck.push({ key: 'title', kind: 'title', title: 'One Ring to Rule Flynn', render: () => <TitleSlide /> });
  deck.push({ key: 'rules-roll', kind: 'rules', title: 'How this works', render: () => <RulesSlide which="roll" /> });
  deck.push({ key: 'rules-death', kind: 'rules', title: 'If you die', render: () => <RulesSlide which="death" /> });
  for (const p of all<PC>('pc')) {
    deck.push({
      key: `cast-${p.id}`,
      kind: 'cast',
      title: p.name,
      render: (d) => <CastSlide pc={p} dm={d} />,
      notes: (d) => (d ? <Rich text={p.play} /> : null),
    });
  }
  const acts = all<Act>('act');
  const unmasked = ent<Ability>('ability', 'unmasked');
  let here = '';
  for (const a of acts) {
    const scenes = all<Scene>('scene').filter((s) => s.act === a.id && sceneInPlay(s));
    if (!scenes.length) continue;
    deck.push({ key: `act-${a.id}`, kind: 'act', title: `${a.num}: ${a.title}`, act: a.id, scene: scenes[0].id, render: () => <ActSlide act={a} /> });
    for (const s of scenes) {
      // an establishing shot whenever the story arrives somewhere new
      const loc = s.location ? ent<Location>('location', s.location) : undefined;
      if (loc && loc.id !== here) {
        here = loc.id;
        deck.push({
          key: `place-${s.id}`,
          kind: 'place',
          title: loc.name,
          scene: s.id,
          act: a.id,
          render: () => <PlaceSlide loc={loc} />,
          notes: (d) => (d && loc.describe?.length ? <RichList items={loc.describe} /> : null),
        });
      }
      const pg = pages(s.readAloud ?? []);
      pg.forEach((text, i) =>
        deck.push({
          key: `scene-${s.id}-${i}`,
          kind: 'scene',
          title: i ? `${s.title} (cont.)` : s.title,
          scene: s.id,
          act: a.id,
          render: (d) => <SceneSlide scene={s} dm={d} text={text} page={i} of={pg.length} />,
          notes: (d) => sceneNotes(s, d),
        }),
      );
      for (const id of ENTRANCES[s.id] ?? []) {
        const npc = ent<NPC>('npc', id);
        const key = `enter-${id}`;
        if (!npc || deck.some((x) => x.key === key)) continue;
        deck.push({
          key,
          kind: npc.side === 'boss' ? 'boss' : 'enter',
          title: npc.name,
          scene: s.id,
          act: a.id,
          // a reveal (Medusa) stays off the TV until the DM marks them met
          dmOnly: npc.surprise && npc.status === 'unmet',
          render: (d) => <CharacterSlide npc={npc} dm={d} />,
          notes: (d) => (d ? <Rich text={npc.play ?? npc.role} /> : null),
        });
      }
      if (s.id === 'costello') {
        const riddle = ent<Clue>('clue', 'fact-riddle');
        deck.push({ key: 'riddle', kind: 'riddle', title: 'The riddle', scene: s.id, act: a.id, dmOnly: !riddle?.revealed, render: () => <RiddleSlide /> });
      }
      if (s.id === 'fourth-mask') {
        deck.push({ key: 'reveal', kind: 'reveal', title: '+100 Charisma', scene: s.id, act: a.id, dmOnly: !unmasked?.revealed, render: () => <RevealSlide /> });
      }
    }
  }
  deck.push({ key: 'credits', kind: 'credits', title: 'Credits', render: () => <CreditsSlide /> });
  return dm ? deck : deck.filter((s) => !s.dmOnly);
}

function useFit(ref: { current: HTMLElement | null }) {
  const [size, setSize] = useState({ w: 960, h: 540 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.min(r.width, (r.height * 16) / 9);
      setSize({ w, h: (w * 9) / 16 });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return size;
}

export function SlidesView() {
  const ui = getUi();
  const dm = ui.deck === 'dm';
  const deck = useMemo(() => buildDeck(dm), [dm, getDataVersion(), ui.shield]);
  const idx = Math.max(0, Math.min(deck.length - 1, ui.slide));
  const slide = deck[idx];
  const stageWrap = useRef<HTMLDivElement>(null);
  const size = useFit(stageWrap);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState(1);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(deck.length - 1, i));
    setDir(next >= idx ? 1 : -1);
    setUi({ slide: next });
  };
  const syncToScene = () => {
    const cur = game().scene;
    const i = deck.findIndex((s) => s.scene === cur && s.kind === 'scene');
    if (i >= 0) go(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || getUi().modal || getUi().palette || getUi().drawer) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        go(getUi().slide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        go(getUi().slide - 1);
      } else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(deck.length - 1);
      else if (e.key === 'f' || e.key === 'F') toggleFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck.length, idx]);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    filmRef.current?.querySelector('.is-on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [idx]);

  // swipe
  const touch = useRef<{ x: number; y: number } | null>(null);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      /* fullscreen is optional */
    }
  };

  const sceneOfSlide = slide?.scene ? ent<Scene>('scene', slide.scene) : undefined;

  return (
    <div class={cx('view slides', full && 'is-full', ui.presenter && 'has-notes')} ref={rootRef}>
      <div class="slides__bar">
        <div class="seg" role="group" aria-label="Deck">
          <button type="button" aria-pressed={!dm} onClick={() => setUi({ deck: 'table', slide: 0 })} title="Spoiler-free: safe to put on a TV for the players">
            <Icon name="users" /> Table deck
          </button>
          <button type="button" aria-pressed={dm} onClick={() => setUi({ deck: 'dm', slide: 0 })} title="Shows secrets, stats and must-happens">
            <Icon name="lock" /> DM deck
          </button>
        </div>
        <span class="slides__count num">
          {idx + 1} / {deck.length}
        </span>
        <span class="spacer" />
        <button type="button" class="btn btn--sm" onClick={syncToScene} title="Jump to the slide for the scene you are running">
          <Icon name="crosshair" /> Current scene
        </button>
        <button type="button" class={cx('btn btn--sm', ui.presenter && 'is-on')} aria-pressed={ui.presenter} onClick={() => setUi({ presenter: !ui.presenter })}>
          <Icon name="sticky-note" /> Notes
        </button>
        <button type="button" class="btn btn--sm" onClick={toggleFull} title="Fullscreen (F)">
          <Icon name={full ? 'minimize' : 'maximize'} /> {full ? 'Exit' : 'Present'}
        </button>
      </div>
      <div class="slides__main">
        <div
          class="slides__stagewrap"
          ref={stageWrap}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const t = touch.current;
            if (!t) return;
            const dx = e.changedTouches[0].clientX - t.x;
            const dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1));
            touch.current = null;
          }}
        >
          <div class="stage" style={{ width: `${size.w}px`, height: `${size.h}px` }} aria-roledescription="slide" aria-label={`${slide?.title} (${idx + 1} of ${deck.length})`}>
            <div class={cx('stage__slide', dir > 0 ? 'from-right' : 'from-left')} key={`${slide?.key}-${dm}`}>
              {slide?.render(dm)}
            </div>
            {dm && slide?.dmOnly && (
              <div class="stage__flag">
                <Icon name="lock" size={14} /> DM only until revealed
              </div>
            )}
            <button type="button" class="stage__nav stage__nav--prev" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous slide">
              <Icon name="chevron-left" size={28} />
            </button>
            <button type="button" class="stage__nav stage__nav--next" onClick={() => go(idx + 1)} disabled={idx === deck.length - 1} aria-label="Next slide">
              <Icon name="chevron-right" size={28} />
            </button>
            <div class="stage__progress" aria-hidden="true">
              <div style={{ width: `${((idx + 1) / deck.length) * 100}%` }} />
            </div>
          </div>
        </div>
        {ui.presenter && (
          <aside class="slides__notes" aria-label="Speaker notes">
            <div class="eyebrow">Speaker notes</div>
            <h3 class="slides__notetitle">{slide?.title}</h3>
            {slide?.notes ? slide.notes(dm) : <p class="muted">No notes for this slide.</p>}
            {sceneOfSlide && (
              <div class="row">
                <button type="button" class="btn btn--sm" onClick={() => goScene(sceneOfSlide.id)} disabled={game().scene === sceneOfSlide.id}>
                  <Icon name="play" /> Make this the current scene
                </button>
                <span class="muted">{KIND_LABEL[sceneOfSlide.kind]}</span>
              </div>
            )}
            <div class="slides__next">
              <span class="eyebrow">Next</span> {deck[idx + 1]?.title ?? 'End of deck'}
            </div>
          </aside>
        )}
      </div>
      <div class="filmstrip" ref={filmRef} role="tablist" aria-label="Slides">
        {deck.map((s, i) => {
          const act = s.act ? ent<Act>('act', s.act) : undefined;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === idx}
              class={cx('frame hue', i === idx && 'is-on', s.dmOnly && 'is-secret', `frame--${s.kind}`)}
              style={{ '--c': hueVar(act?.hue) } as never}
              onClick={() => go(i)}
              title={s.title}
            >
              <span class="frame__n num">{i + 1}</span>
              <span class="frame__kind">{s.kind === 'scene' ? ent<Scene>('scene', s.scene!)?.slate : s.kind}</span>
              <span class="frame__title">{s.title}</span>
            </button>
          );
        })}
      </div>
      {!dm && <div class="slides__safe muted">Table deck: secrets, stats and DM notes stay hidden. Secret slides appear once you reveal them in play.</div>}
      {dm && abilityStatus(ent<Ability>('ability', 'unmasked')!).secret && <div class="slides__safe muted">DM deck: includes slides the players should not see yet.</div>}
    </div>
  );
}
