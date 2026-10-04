// Character profiles, built around the portraits. One profile per player and character: it opens in
// the drawer from any mention, and as a full page in the Cast view. Both read live state, so status,
// HP, masks and edits show up here the moment they change anywhere else.

import { Fragment, type JSX } from 'preact';
import type { Condition, EntityType, Hue, Item, NPC, PC } from '../data/types';
import { adjustHp, revive, toggleEffect } from '../state/actions';
import {
  abilitiesOf,
  acCalc,
  FILM_KIND_LABEL,
  itemsHeldBy,
  npcMaxHp,
  npcStat,
  portraitOf,
  scenesFor,
  SIDE_LABEL,
  sourcesOf,
  wornMask,
  type Tone,
} from '../state/derive';
import { signed } from '../state/dice';
import { all, ent, openDrawer, openProfile } from '../state/store';
import { NpcStatusControl, PcStatusControl } from './controls';
import { AbilityCard, Connections, DmNote, ItemRow, MaskPicker, SceneChips, Secret, StatBlockView, StatGrid } from './detail';
import { Icon } from './icons';
import { Avatar, Expander, HpBar, Label, Stepper, cx, hueVar } from './kit';
import { iconOf, Ref, Rich, RichList } from './rich';

// ─── faces ────────────────────────────────────────────────────────────────

type FaceState = 'ghost' | 'stone' | 'down' | 'out' | undefined;

/** How a character's state should tint their portrait. */
export function faceState(type: EntityType, e: unknown): FaceState {
  if (type === 'pc') {
    const s = (e as PC).status;
    return s === 'alive' ? undefined : s === 'ghost' ? 'ghost' : s === 'stone' ? 'stone' : 'down';
  }
  if (type === 'npc') {
    const s = (e as NPC).status;
    return s === 'stone' ? 'stone' : s === 'defeated' || s === 'dead' || s === 'fled' || s === 'captured' ? 'out' : undefined;
  }
  return undefined;
}

/** A round portrait for a player, character or item, falling back to its icon. */
export function Face({ type, id, size = 34, title, ring }: { type: EntityType; id: string; size?: number; title?: string; ring?: Tone }) {
  const e = ent(type, id);
  if (!e) return null;
  const src = portraitOf(type, id);
  const hue = (e as { hue?: Hue }).hue;
  const st = faceState(type, e);
  if (!src) {
    const fallbackRing: Tone | undefined = ring ?? (st === 'ghost' ? 'ghost' : st === 'stone' ? 'stone' : st === 'down' ? 'warn' : undefined);
    return <Avatar icon={iconOf(type, e)} hue={hue} size={size} ring={fallbackRing} title={title} />;
  }
  return (
    <span
      class={cx('face', hue && 'hue', st && `face--${st}`, ring && `face--ring t-${ring}`)}
      style={{ width: `${size}px`, height: `${size}px`, '--c': hueVar(hue) } as JSX.CSSProperties}
      title={title}
    >
      <img src={src} alt="" decoding="async" draggable={false} />
    </span>
  );
}

/** "From Nightcrawler", "Inspired by Forrest Gump", or "Original". Each source opens its entry. */
export function Sources({ type, id }: { type: 'pc' | 'npc'; id: string }) {
  const films = sourcesOf(type, id);
  if (!films.length) {
    return (
      <div class="srcline">
        <Icon name="sparkle" size={13} />
        <span class="srcline__k">{type === 'pc' ? 'Original character' : 'Original to this campaign'}</span>
      </div>
    );
  }
  return (
    <div class="srcline">
      <span class="srcline__k">{type === 'pc' ? 'Inspired by' : 'From'}</span>
      {films.map((f) => (
        <button
          key={f.id}
          type="button"
          class="srcchip"
          onClick={(ev) => {
            ev.stopPropagation();
            openDrawer('film', f.id);
          }}
          title={`${FILM_KIND_LABEL[f.kind ?? 'film']}: ${f.title}`}
        >
          <Icon name={f.kind === 'series' ? 'tv' : f.kind === 'myth' ? 'scroll' : 'film'} size={13} />
          {f.title}
        </button>
      ))}
    </div>
  );
}

/** The first source's title, for compact places like gallery tiles. */
export function sourceTitle(type: 'pc' | 'npc', id: string): string {
  const f = sourcesOf(type, id)[0];
  return f ? f.title : 'Original';
}

// ─── hero ─────────────────────────────────────────────────────────────────

function NpcFacts({ npc }: { npc: NPC }) {
  const st = npcStat(npc);
  if (!st) return null;
  if (st.invincible) {
    return (
      <span class="qfact t-gold">
        <Icon name="shield-check" size={13} /> Invincible
      </span>
    );
  }
  const max = npcMaxHp(npc) ?? st.hp;
  const atk = st.attacks[0];
  return (
    <>
      <span class="qfact" title="Armor Class">
        <Icon name="shield" size={13} /> AC <strong class="num">{st.ac ?? '—'}</strong>
      </span>
      <span class="qfact" title="Hit points">
        <Icon name="heart-pulse" size={13} /> HP{' '}
        <strong class="num">
          {npc.hp ?? max}/{max}
        </strong>
      </span>
      {atk && (
        <span class="qfact" title="Main attack">
          <Icon name="swords" size={13} /> {atk.name}
          {atk.bonus != null && <strong class="num"> {signed(atk.bonus)}</strong>}
          {atk.dmg && <span class="num"> {atk.dmg}</span>}
        </span>
      )}
    </>
  );
}

export function ProfileHero({ type, id, mode }: { type: 'pc' | 'npc'; id: string; mode: 'drawer' | 'page' }) {
  const e = ent<PC | NPC>(type, id);
  if (!e) return null;
  const pc = type === 'pc' ? (e as PC) : undefined;
  const npc = type === 'npc' ? (e as NPC) : undefined;
  const src = portraitOf(type, id);
  const mask = wornMask(type, id);
  const maskSrc = mask ? portraitOf('item', mask.id) : undefined;
  const size = mode === 'page' ? 232 : 124;
  return (
    <header class={cx('phero', `phero--${mode}`, pc && 'hue')} style={pc ? ({ '--c': hueVar(pc.hue) } as JSX.CSSProperties) : undefined}>
      {src && <div class="phero__backdrop" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />}
      <div class="phero__face">
        <Face type={type} id={id} size={size} />
        {mask && (
          <button type="button" class="phero__mask" onClick={() => openDrawer('item', mask.id)} title={`Wearing the ${mask.name}`} aria-label={`Wearing the ${mask.name}`}>
            {maskSrc ? <img src={maskSrc} alt="" /> : <Icon name={mask.icon} size={18} />}
          </button>
        )}
      </div>
      <div class="phero__text">
        <div class="phero__eyebrow">
          {pc ? (
            <>
              Player · played by <strong>{pc.player}</strong>
            </>
          ) : (
            <>
              {SIDE_LABEL[npc!.side]}
              {npc!.minor ? ' · extra' : ''}
            </>
          )}
        </div>
        <h2 class="phero__name">{e.name}</h2>
        {(pc?.title || npc?.aka) && <div class="phero__aka">{pc ? pc.title : npc!.aka}</div>}
        <Sources type={type} id={id} />
        <Rich text={pc ? pc.tagline : npc!.role} class="phero__lead" />
        <div class="phero__facts">
          {pc ? <PcStatusControl pc={pc} /> : <NpcStatusControl npc={npc!} />}
          {npc && <NpcFacts npc={npc} />}
          {mode === 'drawer' ? (
            <button type="button" class="btn btn--sm phero__open" onClick={() => openProfile(type, id)}>
              <Icon name="maximize-2" /> Full profile
            </button>
          ) : (
            <button type="button" class="btn btn--sm phero__open" onClick={() => openDrawer(type, id, 'edit')}>
              <Icon name="pencil" /> Edit
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

/** Spoken lines in typewriter quotes; lines in parentheses are performance cues. */
export function Quotes({ lines }: { lines: string[] }) {
  return (
    <ul class="quotes">
      {lines.map((l, i) => {
        const t = l.trim();
        const cue = t.startsWith('(') && t.endsWith(')');
        return (
          <li key={i} class={cx('quote', cue && 'quote--cue')}>
            <Icon name={cue ? 'drama' : 'quote'} size={15} class="quote__mark" />
            <span class="quote__text">{cue ? t.slice(1, -1) : t}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Sec({ icon, title, children, class: cls }: { icon: string; title: string; children: JSX.Element | JSX.Element[] | null | (JSX.Element | null | false)[]; class?: string }) {
  return (
    <section class={cx('prof__sec', cls)}>
      <Label icon={icon}>{title}</Label>
      {children}
    </section>
  );
}

function Layout({ mode, hero, main, side }: { mode: 'drawer' | 'page'; hero: JSX.Element; main: (JSX.Element | null | false)[]; side: (JSX.Element | null | false)[] }) {
  if (mode === 'page') {
    return (
      <article class="prof prof--page">
        {hero}
        <div class="prof__cols">
          <div class="prof__main">{main}</div>
          <aside class="prof__side">{side}</aside>
        </div>
      </article>
    );
  }
  return (
    <div class="detail prof prof--drawer">
      {hero}
      {main}
      {side}
    </div>
  );
}

// ─── characters ───────────────────────────────────────────────────────────

export function NpcProfile({ npc, mode = 'drawer' }: { npc: NPC; mode?: 'drawer' | 'page' }) {
  const scenes = scenesFor('npc', npc.id);
  const items = itemsHeldBy(npc.id);
  const facts: [string, string | undefined][] = [
    ['Look', npc.look],
    ['Personality', npc.personality],
    ['Play it', npc.play],
    ['Wants', npc.wants],
  ];
  const important = npc.important?.length ? (
    <div class="callout callout--gold" key="important">
      <Icon name="triangle-alert" size={16} />
      <RichList items={npc.important} />
    </div>
  ) : null;
  const lines = npc.lines?.length ? (
    <Sec key="lines" icon="message-square-quote" title="Lines to use">
      <Quotes lines={npc.lines} />
    </Sec>
  ) : null;
  const play = facts.some(([, v]) => v) ? (
    <Sec key="play" icon="drama" title="Personality and how to play them">
      <dl class="facts">
        {facts.map(([k, v]) =>
          v ? (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>
                <Rich text={v} />
              </dd>
            </Fragment>
          ) : null,
        )}
      </dl>
    </Sec>
  ) : null;
  const knows = npc.knows?.length ? (
    <Sec key="knows" icon="lightbulb" title="What they know">
      <RichList items={npc.knows} />
    </Sec>
  ) : null;
  const stats = (
    <Sec key="stats" icon="swords" title="Stats">
      {npc.stat ? <StatBlockView npc={npc} /> : <p class="muted prof__none">No combat stats. Not meant to be fought.</p>}
    </Sec>
  );
  const appears = (
    <Sec key="appears" icon="clapperboard" title="Appears in">
      <SceneChips scenes={scenes} />
    </Sec>
  );
  const carrying = items.length ? (
    <Sec key="carrying" icon="package" title="Carrying">
      <div class="stack" style={{ '--gap': '6px' } as JSX.CSSProperties}>
        {items.map((i) => (
          <ItemRow key={i.id} item={i} showHolder={false} />
        ))}
      </div>
    </Sec>
  ) : null;
  const conns = <Connections key="conns" type="npc" id={npc.id} />;
  const note = <DmNote key="note" text={npc.dmNote} />;
  const hero = <ProfileHero type="npc" id={npc.id} mode={mode} />;
  return mode === 'page' ? (
    <Layout mode={mode} hero={hero} main={[important, lines, play, knows, stats]} side={[appears, conns, carrying, note]} />
  ) : (
    <Layout mode={mode} hero={hero} main={[important, lines, play, stats, knows]} side={[appears, conns, carrying, note]} />
  );
}

// ─── players ──────────────────────────────────────────────────────────────

export function PcProfile({ pc, mode = 'drawer' }: { pc: PC; mode?: 'drawer' | 'page' }) {
  const ac = acCalc(pc);
  const abilities = abilitiesOf(pc.id);
  const items = itemsHeldBy(pc.id);
  const pcConds = all<Condition>('condition').filter((c) => c.scope === 'pc');
  const partyConds = all<Condition>('condition').filter((c) => c.scope === 'party' && c.active);
  const donuts = ent<Item>('item', 'donuts');
  const vitals = (
    <div class="vitals" key="vitals">
      <div class="vitals__hp">
        <div class="row row--nowrap" style={{ gap: '10px' }}>
          <Icon name={pc.status === 'ghost' ? 'ghost' : 'heart-pulse'} size={16} />
          <HpBar hp={pc.hp} max={pc.hpMax} ghost={pc.status === 'ghost'} />
          <span class="num vitals__num">
            {pc.hp}/{pc.hpMax}
          </span>
        </div>
        <Stepper value={pc.hp} label={`${pc.name} HP`} onDelta={(d) => adjustHp(pc.id, d)} steps={[1, 5]} render={() => 'HP'} />
      </div>
      <div class="vitals__ac" title={ac.parts.map((p) => `${p.label} +${p.value}`).join('\n') || 'Armor Class'}>
        <Icon name="shield" size={16} />
        <span class="num">{ac.total}</span>
        <span class="vitals__k">AC</span>
      </div>
    </div>
  );
  const ghost =
    pc.status === 'ghost' ? (
      <div class="callout callout--ghost" key="ghost">
        <Icon name="ghost" size={18} />
        <div class="grow">
          <strong>{pc.name} is a ghost.</strong> Can talk, move, distract and roll CHA / PER / INT. Cannot be hurt or attack. <Ref type="rule" id="ghosts" label="Ghost rules" />
        </div>
        <button type="button" class="btn btn--sm btn--good" onClick={() => revive(pc.id, true)} disabled={!donuts || (donuts.qty ?? 0) < 1 || (donuts.state !== 'held' && donuts.state !== 'equipped')}>
          <Icon name="donut" /> Revive ({donuts?.state === 'held' ? donuts.qty ?? 0 : 0})
        </button>
      </div>
    ) : null;
  const stats = (
    <Sec key="stats" icon="dices" title="Stats (click to roll)">
      <StatGrid pc={pc} />
      {partyConds.length > 0 ? (
        <div class="statnote">
          {partyConds.map((c) => (
            <Ref key={c.id} type="condition" id={c.id} />
          ))}{' '}
          in effect.
        </div>
      ) : null}
    </Sec>
  );
  const mask =
    pc.id === 'flynn' ? (
      <Sec key="mask" icon="venetian-mask" title="Mask">
        <MaskPicker pc={pc} />
      </Sec>
    ) : null;
  const abil = (
    <Sec key="abil" icon="sparkles" title="Abilities">
      <div class="stack" style={{ '--gap': '8px' } as JSX.CSSProperties}>
        {abilities.map((a) => (
          <AbilityCard key={a.id} ab={a} />
        ))}
      </div>
    </Sec>
  );
  const effects = (
    <Sec key="effects" icon="activity" title={`Effects on ${pc.name}`}>
      <div class="chips">
        {pcConds.map((c) => {
          const on = pc.effects.includes(c.id);
          return (
            <button key={c.id} type="button" class={cx('toggle-chip', on && 'is-on')} aria-pressed={on} onClick={() => toggleEffect(pc.id, c.id)} title={c.summary}>
              <Icon name={c.icon} size={13} />
              {c.name}
            </button>
          );
        })}
      </div>
    </Sec>
  );
  const who = (
    <Sec key="who" icon="user" title="Who they are">
      <div class="prose">
        <Rich text={pc.bio} />
      </div>
      <div class="prose muted prof__play">
        <strong>How to play it:</strong> <Rich text={pc.play} />
      </div>
      {pc.notes ? <RichList items={pc.notes} /> : null}
    </Sec>
  );
  const secrets = pc.secrets?.length ? (
    <Secret key="secrets">
      <RichList items={pc.secrets} />
    </Secret>
  ) : null;
  const inventory = (
    <Expander key="inv" id={`pc:${pc.id}:inv`} title="Inventory" icon="package" count={items.length} defaultOpen variant="box">
      {items.length ? (
        <div class="stack" style={{ '--gap': '6px' } as JSX.CSSProperties}>
          {items.map((i) => (
            <ItemRow key={i.id} item={i} showHolder={false} />
          ))}
        </div>
      ) : (
        <span class="muted">Nothing yet. Give an item from its card or the Codex.</span>
      )}
    </Expander>
  );
  const conns = <Connections key="conns" type="pc" id={pc.id} />;
  const note = <DmNote key="note" text={pc.dmNote} />;
  const hero = <ProfileHero type="pc" id={pc.id} mode={mode} />;
  return mode === 'page' ? (
    <Layout mode={mode} hero={hero} main={[vitals, ghost, stats, mask, abil, effects]} side={[who, secrets, inventory, conns, note]} />
  ) : (
    <Layout mode={mode} hero={hero} main={[vitals, ghost, stats, mask, abil, effects, inventory]} side={[who, secrets, conns, note]} />
  );
}
