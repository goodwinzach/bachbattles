// The body of a scene, shared by the Run screen and the Script view, plus per-scene widgets.

import { useState } from 'preact/hooks';
import type { Act, Clue, Effect, Item, NPC, PC, Scene } from '../data/types';
import { STAT_ABBR, type Stat } from '../data/types';
import {
  applyAllEffects,
  applyEffect,
  effectKey,
  goScene,
  revive,
  rollMedusa,
  setClue,
  setCostello,
  setCatVariant,
  setMask,
  setPcStatus,
  setRoute,
} from '../state/actions';
import { dialogueOf, isUnmasked, KIND_LABEL, nameOf, sceneFoes, sceneMust, shielded } from '../state/derive';
import { all, ent, game, getUi, openDrawer, openModal } from '../state/store';
import { SIN_ROOMS } from '../data/scenes';
import { NpcStatusControl } from './controls';
import { DmNote, ItemRow, Secret } from './detail';
import { DialogueOptions } from './dialogue';
import { Icon } from './icons';
import { Face } from './profile';
import { Badge, Expander, cx } from './kit';
import { Ref, Rich, RichList, RichParas, CheckChip } from './rich';

// ─── pieces ───────────────────────────────────────────────────────────────

export function ReadAloud({ paras }: { paras?: string[] }) {
  if (!paras?.length) return null;
  return (
    <div class="script">
      <div class="script__label">
        <Icon name="megaphone" size={13} /> Read aloud
      </div>
      <RichParas paras={paras} />
    </div>
  );
}

export function MustHappen({ scene }: { scene: Scene }) {
  const items = sceneMust(scene);
  if (!items.length) return null;
  return (
    <div class="must">
      <div class="must__label">
        <Icon name="flag-triangle-right" size={13} /> Must happen
        {scene.variantMust && (
          <button type="button" class="must__variant" onClick={() => openModal({ kind: 'settings' })} title="Change the studio gauntlet version">
            {game().catVariant ? 'Expanded build' : 'Outline version'}
          </button>
        )}
      </div>
      <RichList items={items} />
    </div>
  );
}

function CastList({ scene }: { scene: Scene }) {
  const ids = scene.cast ?? [];
  if (!ids.length) return null;
  return (
    <div class="castlist">
      {ids.map((id) => {
        const n = ent<NPC>('npc', id);
        if (!n) return null;
        const line = scene.lines?.find((l) => l.by === id)?.text ?? n.lines?.[0];
        return (
          <div key={id} class="castcard">
            <Face type="npc" id={id} size={40} />
            <div class="castcard__main">
              <div class="castcard__top">
                <Ref type="npc" id={id} noDot />
                <NpcStatusControl npc={n} size="sm" />
              </div>
              <Rich text={n.role} class="castcard__role" />
              {n.stat && !n.stat.invincible && (
                <div class="castcard__stat num">
                  AC {n.stat.ac} · HP {n.hp ?? n.stat.hp}/{n.stat.hp}
                  {n.stat.attacks[0]?.bonus != null && ` · ${n.stat.attacks[0].name} +${n.stat.attacks[0].bonus} ${n.stat.attacks[0].dmg ?? ''}`}
                </div>
              )}
              {n.stat?.invincible && <div class="castcard__stat">Invincible</div>}
              {line && <div class="castcard__line">“{line}”</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Who can talk in this scene: its characters, then anyone fought here, if they have dialogue options. */
function talkersOf(scene: Scene): NPC[] {
  const ids = [...new Set([...(scene.cast ?? []), ...sceneFoes(scene)])];
  return ids.map((id) => ent<NPC>('npc', id)).filter((n): n is NPC => !!n && dialogueOf(n).length > 0);
}

/** Dialogue options for everyone in the scene: pick a face, then a situation, then a line. */
function TalkPanel({ npcs }: { npcs: NPC[] }) {
  const [sel, setSel] = useState(npcs[0]?.id);
  const cur = npcs.find((n) => n.id === sel) ?? npcs[0];
  if (!cur) return null;
  return (
    <div class="talk">
      {npcs.length > 1 && (
        <div class="talk__who" role="tablist" aria-label="Who is talking">
          {npcs.map((n) => (
            <button key={n.id} type="button" role="tab" aria-selected={n.id === cur.id} class="talk__pick" onClick={() => setSel(n.id)}>
              <Face type="npc" id={n.id} size={28} />
              <span class="talk__name">{nameOf('npc', n.id)}</span>
            </button>
          ))}
        </div>
      )}
      <div class="talk__head">
        <Face type="npc" id={cur.id} size={40} />
        <div class="talk__headtext">
          <Ref type="npc" id={cur.id} noDot />
          {cur.traits?.length ? <div class="talk__traits">{cur.traits.slice(0, 4).join(' · ')}</div> : null}
        </div>
      </div>
      <DialogueOptions key={cur.id} npc={cur} layout="tabs" />
    </div>
  );
}

function RollsTable({ scene }: { scene: Scene }) {
  if (!scene.rolls?.length) return null;
  return (
    <div class="rolls">
      {scene.rolls.map((r, i) => (
        <div key={i} class="rolls__row">
          <CheckChip stat={r.stat} dc={r.dc} inverted={r.inverted} />
          <div class="rolls__text">
            <Rich text={r.label} />
            {r.note && <Rich text={r.note} class="rolls__note" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinesList({ scene }: { scene: Scene }) {
  if (!scene.lines?.length) return null;
  return (
    <ul class="lines">
      {scene.lines.map((l, i) => {
        const by = ent<NPC>('npc', l.by) ?? ent<PC>('pc', l.by);
        return (
          <li key={i} class="line line--by">
            <span class="line__by">{by ? <Ref type={ent('npc', l.by) ? 'npc' : 'pc'} id={l.by} noDot /> : l.by}</span>
            <span class="line__text">“{l.text}”</span>
            {l.note && <span class="line__note">{l.note}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Failsafes({ scene }: { scene: Scene }) {
  if (!scene.failsafes?.length) return null;
  return (
    <div class="ifs">
      {scene.failsafes.map((f, i) => (
        <div key={i} class="ifs__row">
          <div class="ifs__when">
            <span class="ifs__k">If</span> <Rich text={f.when} />
          </div>
          <div class="ifs__then">
            <Icon name="arrow-right" size={14} />
            <Rich text={f.then} />
          </div>
        </div>
      ))}
    </div>
  );
}

function effectOffered(ef: Effect): boolean {
  if (!ef.only) return true;
  return (ef.only === 'expanded') === game().catVariant;
}

function Effects({ scene }: { scene: Scene }) {
  const g = game();
  const list = (scene.effects ?? []).map((ef, i) => ({ ef, i })).filter(({ ef }) => effectOffered(ef));
  if (!list.length) return null;
  const pending = list.filter(({ i }) => !g.applied[effectKey(scene.id, i)]).length;
  return (
    <div class="effects">
      {list.map(({ ef, i }) => {
        const done = !!g.applied[effectKey(scene.id, i)];
        return (
          <div key={i} class={cx('effect', done && 'is-done')}>
            <Icon name={done ? 'circle-check' : 'circle-dashed'} size={16} />
            <span class="grow">{ef.label}</span>
            <button type="button" class="btn btn--xs" onClick={() => applyEffect(scene.id, i)} title={done ? 'Apply again' : 'Apply this to the game state'}>
              {done ? 'Again' : 'Apply'}
            </button>
          </div>
        );
      })}
      {pending > 1 && (
        <button type="button" class="btn btn--sm btn--outline" onClick={() => applyAllEffects(scene.id)}>
          <Icon name="check-check" /> Apply all {pending}
        </button>
      )}
    </div>
  );
}

// ─── scene widgets ────────────────────────────────────────────────────────

function CostelloWidget() {
  const g = game();
  const facts = all<Clue>('clue').filter((c) => c.group === 'costello');
  const riddle = facts.find((f) => f.id === 'fact-riddle');
  const mustSay = g.costelloAsked >= 2 && riddle && !riddle.revealed;
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="orbit" size={16} />
        <span class="widget__title">Three questions</span>
        <span class="qpips" role="group" aria-label="Questions asked">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" class={cx('qpip', g.costelloAsked >= n && 'is-on')} aria-pressed={g.costelloAsked >= n} onClick={() => setCostello(g.costelloAsked >= n ? n - 1 : n)}>
              Q{n}
            </button>
          ))}
        </span>
      </div>
      {mustSay && (
        <div class="callout callout--gold">
          <Icon name="triangle-alert" size={16} />
          <span>
            The third answer <strong>must</strong> end with: “Out of the closet without a face.”
          </span>
        </div>
      )}
      <div class="facts4">
        {facts.map((f, i) => (
          <button key={f.id} type="button" class={cx('fact', f.revealed && 'is-on')} aria-pressed={f.revealed} onClick={() => setClue(f.id, !f.revealed)}>
            <span class="fact__n num">{i + 1}</span>
            <Rich text={f.text} />
            <Icon name={f.revealed ? 'eye' : 'eye-off'} size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

function RouteWidget() {
  const g = game();
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="git-branch" size={16} />
        <span class="widget__title">Which way?</span>
        {g.route && <Badge tone="gold">{g.route === 'plane' ? 'By plane' : 'By boat'}</Badge>}
      </div>
      <div class="choice">
        <button type="button" class={cx('choice__opt', g.route === 'plane' && 'is-on')} onClick={() => { setRoute('plane'); goScene('airfield'); }}>
          <Icon name="route" size={18} />
          <span>
            <strong>Plane</strong>
            <span>The Airfield → Odysseus</span>
          </span>
        </button>
        <button type="button" class={cx('choice__opt', g.route === 'boat' && 'is-on')} onClick={() => { setRoute('boat'); goScene('docks'); }}>
          <Icon name="sailboat" size={18} />
          <span>
            <strong>Boat</strong>
            <span>The Docks with Odysseus</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function BillWidget() {
  const gold = ent<Item>('item', 'gold');
  const have = gold?.qty ?? 0;
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="coins" size={16} />
        <span class="widget__title">The bill</span>
      </div>
      <div class="bill">
        <div>
          <div class="eyebrow">Michael wants</div>
          <div class="bill__n num">500</div>
        </div>
        <div>
          <div class="eyebrow">Party has</div>
          <div class={cx('bill__n num', have < 500 && 'bad')}>{have}</div>
        </div>
        <div>
          <div class="eyebrow">Short by</div>
          <div class="bill__n num">{Math.max(0, 500 - have)}</div>
        </div>
      </div>
    </div>
  );
}

function MedusaWidget() {
  const pcs = all<PC>('pc');
  const flynn = pcs.find((p) => p.id === 'flynn')!;
  const groomsmen = pcs.filter((p) => p.id !== 'flynn');
  const exposed = groomsmen.filter((p) => p.status === 'alive');
  const unmasked = isUnmasked(flynn);
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="eye" size={16} />
        <span class="widget__title">Medusa</span>
        <span class="muted">Inverted Perception: 10 or lower is safe</span>
      </div>
      <div class={cx('callout', unmasked ? 'callout--bad' : 'callout--good')}>
        <Icon name={unmasked ? 'triangle-alert' : 'venetian-mask'} size={16} />
        <span>{unmasked ? 'Flynn is NOT wearing a mask. He is not immune to the gaze right now.' : 'Flynn is masked and immune to the gaze.'}</span>
      </div>
      <div class="eyebrow">Who opens the box? (turns to stone)</div>
      <div class="chips">
        {groomsmen.map((p) => (
          <button key={p.id} type="button" class={cx('toggle-chip', p.status === 'stone' && 'is-on')} aria-pressed={p.status === 'stone'} onClick={() => setPcStatus(p.id, p.status === 'stone' ? 'alive' : 'stone')}>
            <Face type="pc" id={p.id} size={20} /> {p.name}
          </button>
        ))}
      </div>
      <button type="button" class="btn btn--primary" disabled={!exposed.length} onClick={() => rollMedusa(exposed.map((p) => p.id))}>
        <Icon name="dices" /> Roll the gaze for {exposed.length} groomsm{exposed.length === 1 ? 'an' : 'en'}
      </button>
    </div>
  );
}

function SinsWidget({ scene }: { scene: Scene }) {
  const g = game();
  const rooms = SIN_ROOMS.map((id) => ent<Scene>('scene', id)!);
  const prideDone = rooms[0].status === 'done' || g.sinOrder.includes('pride');
  const unvisited = rooms.filter((r) => r.id !== 'pride' && r.id !== 'gluttony' && r.status !== 'done' && r.status !== 'skipped' && r.id !== g.scene);
  const pickRandom = () => {
    if (!prideDone && g.scene !== 'pride') return goScene('pride');
    const pool = [...unvisited, rooms[6]];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    goScene(pick.id);
  };
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="door-open" size={16} />
        <span class="widget__title">The seven buildings</span>
        <span class="muted">Pride first. Gluttony ends it.</span>
      </div>
      <div class="sins" role="group" aria-label="Sin buildings">
        {rooms.map((r, i) => {
          const st = g.scene === r.id ? 'active' : r.status;
          const angle = -90 + (i - 3) * 26;
          return (
            <button
              key={r.id}
              type="button"
              class={cx('sin', `sin--${st}`, r.id === 'pride' && 'sin--first', r.id === 'gluttony' && 'sin--last')}
              style={{ '--a': `${angle}deg` } as never}
              onClick={() => goScene(r.id)}
              title={`${r.title}: ${r.logline}`}
            >
              <span class="sin__name">{r.title}</span>
              <span class="sin__st">{st === 'active' ? 'Here' : st === 'done' ? 'Done' : st === 'skipped' ? 'Skipped' : r.id === 'pride' ? 'First' : r.id === 'gluttony' ? 'Food' : ''}</span>
            </button>
          );
        })}
        <div class="sins__center">
          <Icon name="package" size={18} />
          <span>John Doe</span>
        </div>
      </div>
      <div class="row" style={{ justifyContent: 'center' }}>
        <button type="button" class="btn" onClick={pickRandom}>
          <Icon name="dices" /> {prideDone || g.scene === 'pride' ? 'Roll for the next building' : 'Enter the first building (Pride)'}
        </button>
      </div>
      {scene.id !== 'pride' && !prideDone && <div class="muted">Pride has not been played yet. It is always first, whatever they choose.</div>}
    </div>
  );
}

function KingpinWidget() {
  const flynn = ent<PC>('pc', 'flynn')!;
  const hostile = flynn.mask === 'spider-mask';
  return (
    <div class="widget">
      <div class={cx('callout', hostile ? 'callout--bad' : 'callout--good')}>
        <Icon name={hostile ? 'flame' : 'circle-check'} size={16} />
        <span>
          {hostile ? (
            <>
              <strong>
                <Ref type="npc" id="kingpin" noDot /> is furious.
              </strong>{' '}
              <Ref type="pc" id="flynn" noDot /> is wearing the <Ref type="item" id="spider-mask" />. “Spider-Man.”
            </>
          ) : (
            <>
              <strong>
                <Ref type="npc" id="kingpin" noDot /> does not care.
              </strong>{' '}
              <Ref type="pc" id="flynn" noDot /> is {flynn.mask === 'none' ? 'unmasked' : !flynn.mask ? 'bare-faced' : `wearing the ${ent<Item>('item', flynn.mask)?.name ?? 'mask'}`}.
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function VariantWidget() {
  const g = game();
  return (
    <div class="widget widget--slim">
      <Icon name={g.catVariant ? 'cat' : 'flame'} size={16} />
      <span class="grow">
        Studio gauntlet: <strong>{g.catVariant ? 'expanded build' : 'outline version'}</strong>
        {g.catVariant ? '. The Cat in the Hat does the wipe.' : '. Toothless does the wipe.'}
      </span>
      <button type="button" class="btn btn--xs" onClick={() => setCatVariant(!g.catVariant)}>
        Switch
      </button>
    </div>
  );
}

function UnmaskWidget() {
  const flynn = ent<PC>('pc', 'flynn')!;
  const lou = ent<NPC>('npc', 'lou')!;
  const text = ent<Clue>('clue', 'amy-text')!;
  const unmasked = isUnmasked(flynn);
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="drama" size={16} />
        <span class="widget__title">The finale switches</span>
      </div>
      <div class="finale">
        <button type="button" class={cx('finale__step', text.revealed && 'is-on')} onClick={() => setClue('amy-text', !text.revealed)}>
          <Icon name="smartphone" size={18} />
          <span>
            <strong>Louise's text</strong>
            <span>{text.revealed ? 'Sent' : 'Send after Flynn struggles a bit'}</span>
          </span>
        </button>
        <button type="button" class={cx('finale__step', unmasked && 'is-on')} onClick={() => setMask(unmasked ? 'spider-mask' : 'none')}>
          <Icon name="scan-face" size={18} />
          <span>
            <strong>Flynn unmasks</strong>
            <span>{unmasked ? 'Charisma +100' : 'Reveals +100 Charisma'}</span>
          </span>
        </button>
        <button type="button" class={cx('finale__step', lou.phase === 1 && 'is-on')} onClick={() => openModal({ kind: 'confirm', title: lou.phase === 1 ? 'Lou puts the mask back on?' : 'Lou takes off the V mask?', body: lou.phase === 1 ? 'Back to masked stats (AC 15, HP 24).' : 'Switch to unmasked stats: AC 12, HP 14, unarmed +2 1d4. He is Close enough to grapple.', confirm: 'Switch', onConfirm: () => import('../state/actions').then((a) => a.setNpcPhase('lou', lou.phase === 1 ? 0 : 1)) })}>
          <Icon name="drama" size={18} />
          <span>
            <strong>Lou unmasks</strong>
            <span>{lou.phase === 1 ? 'Unmasked: AC 12, HP 14' : 'Masked: AC 15, keeps distance'}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function BagelWidget({ shop }: { shop?: boolean }) {
  const ghosts = all<PC>('pc').filter((p) => p.status === 'ghost');
  const bagels = ent<Item>('item', 'bagels');
  const have = bagels && (bagels.state === 'held' || bagels.state === 'equipped') ? bagels.qty ?? 0 : 0;
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="bagel" size={16} />
        <span class="widget__title">{shop ? 'The bagel shop' : 'Bagels'}</span>
        <span class="muted">{shop ? 'Unlimited bagels. One improbable act per friend.' : `${have} bagel${have === 1 ? '' : 's'} on hand`}</span>
      </div>
      {ghosts.length === 0 ? (
        <div class="muted">Nobody is a ghost right now.</div>
      ) : (
        <div class="stack" style={{ '--gap': '8px' } as never}>
          {ghosts.map((p) => (
            <div key={p.id} class="ghostrow">
              <Face type="pc" id={p.id} size={30} />
              <span class="grow">
                <Ref type="pc" id={p.id} noDot /> <span class="muted">is a ghost</span>
              </span>
              <button type="button" class="btn btn--sm btn--good" disabled={!shop && have < 1} onClick={() => revive(p.id, !shop)} title="Only after a living player does something statistically improbable in real life">
                <Icon name="sparkles" /> Improbable act done: revive
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneWidget({ scene }: { scene: Scene }) {
  const parts = [];
  if (scene.id === 'costello') parts.push(<CostelloWidget key="c" />);
  if (scene.id === 'route-choice') parts.push(<RouteWidget key="r" />);
  if (scene.id === 'gentlemen') parts.push(<BillWidget key="b" />);
  if (scene.id === 'john-doe') parts.push(<MedusaWidget key="m" />);
  if (SIN_ROOMS.includes(scene.id)) parts.push(<SinsWidget key="s" scene={scene} />);
  if (scene.id === 'wrath') parts.push(<KingpinWidget key="k" />);
  if (scene.variantMust || scene.id === 'cat') parts.push(<VariantWidget key="v" />);
  if (scene.id === 'fourth-mask') parts.push(<UnmaskWidget key="u" />);
  if (scene.id === 'gluttony' || scene.id === 'cat' || scene.id === 'toothless' || scene.id === 'oh-dae-su') {
    if (all<PC>('pc').some((p) => p.status === 'ghost')) parts.push(<BagelWidget key="d" />);
  }
  if (scene.id === 'epilogue') parts.push(<BagelWidget key="ds" shop />);
  if (!parts.length) return null;
  return <div class="widgets">{parts}</div>;
}

// ─── the body ─────────────────────────────────────────────────────────────

export function SceneBody({ scene, prefix, compact }: { scene: Scene; prefix: string; compact?: boolean }) {
  const id = (k: string) => `${prefix}:${scene.id}:${k}`;
  const foes = sceneFoes(scene);
  const talkers = talkersOf(scene);
  const stats = scene.rolls?.map((r) => r.stat).filter((s): s is Stat => s !== 'any');
  return (
    <div class="scenebody">
      <Rich text={scene.logline} class="logline" />
      {(scene.objective || sceneMust(scene).length > 0) && (
        <div class="scenebody__top">
          {scene.objective && (
            <div class="objective">
              <div class="objective__label">
                <Icon name="target" size={13} /> Objective
              </div>
              <Rich text={scene.objective} />
            </div>
          )}
          <MustHappen scene={scene} />
        </div>
      )}
      {!compact && <SceneWidget scene={scene} />}
      <ReadAloud paras={scene.readAloud} />
      <div class="xps">
        {scene.beats?.length ? (
          <Expander id={id('beats')} title="Beats" icon="list" count={scene.beats.length} defaultOpen={false}>
            <dl class="beats">
              {scene.beats.map((b, i) => (
                <div key={i} class="beats__row">
                  <dt>{b.label}</dt>
                  <dd>
                    <Rich text={b.text} />
                  </dd>
                </div>
              ))}
            </dl>
          </Expander>
        ) : null}
        {scene.cast?.length ? (
          <Expander id={id('cast')} title="Characters" icon="drama" count={scene.cast.length} defaultOpen={!compact}>
            <CastList scene={scene} />
          </Expander>
        ) : null}
        {talkers.length ? (
          <Expander
            id={id('talk')}
            title="Dialogue options"
            icon="messages-square"
            count={talkers.length}
            defaultOpen={!compact && (scene.kind === 'social' || scene.kind === 'oracle')}
            hint={talkers.length > 1 ? `${talkers.length} characters` : nameOf('npc', talkers[0].id)}
          >
            <TalkPanel npcs={talkers} />
          </Expander>
        ) : null}
        {scene.rolls?.length ? (
          <Expander
            id={id('rolls')}
            title="Rolls & DCs"
            icon="dices"
            count={scene.rolls.length}
            defaultOpen={!compact}
            hint={stats?.length ? [...new Set(stats)].map((s) => STAT_ABBR[s]).join(' · ') : null}
          >
            <RollsTable scene={scene} />
          </Expander>
        ) : null}
        {scene.lines?.length ? (
          <Expander id={id('lines')} title="Lines" icon="message-square-quote" count={scene.lines.length}>
            <LinesList scene={scene} />
          </Expander>
        ) : null}
        {scene.failsafes?.length ? (
          <Expander id={id('ifs')} title="If they…" icon="git-branch" count={scene.failsafes.length}>
            <Failsafes scene={scene} />
          </Expander>
        ) : null}
        {scene.tips?.length ? (
          <Expander id={id('tips')} title="Ideas for the players" icon="lightbulb" count={scene.tips.length}>
            <RichList items={scene.tips} />
          </Expander>
        ) : null}
        {scene.notes?.length ? (
          <Expander id={id('notes')} title="DM notes" icon="notebook-pen" count={scene.notes.length} defaultOpen={!compact}>
            <RichList items={scene.notes} />
          </Expander>
        ) : null}
        {scene.secrets?.length ? (
          <Expander id={id('secrets')} title="Secrets" icon="lock" count={shielded() ? '•' : scene.secrets.length} tone="gold">
            <Secret>
              <RichList items={scene.secrets} />
            </Secret>
          </Expander>
        ) : null}
        {foes.length > 0 && compact ? (
          <Expander id={id('foes')} title="Encounters" icon="swords" count={scene.encounters?.length}>
            <EncounterList scene={scene} />
          </Expander>
        ) : null}
        {scene.loot?.length ? (
          <Expander id={id('loot')} title="Loot" icon="package" count={scene.loot.length}>
            <div class="stack" style={{ '--gap': '6px' } as never}>
              {scene.loot.map((lid) => {
                const it = ent<Item>('item', lid);
                return it ? <ItemRow key={lid} item={it} /> : null;
              })}
            </div>
          </Expander>
        ) : null}
        {scene.effects?.length ? (
          <Expander id={id('effects')} title="Apply to the game" icon="list-checks" count={scene.effects.filter(effectOffered).length} defaultOpen={!compact && getUi().view === 'run'}>
            <Effects scene={scene} />
          </Expander>
        ) : null}
        {scene.source ? (
          <Expander id={id('source')} title="Original outline" icon="scroll-text">
            <pre class="source">{scene.source}</pre>
          </Expander>
        ) : null}
      </div>
      <DmNote text={scene.dmNote} />
    </div>
  );
}

export function EncounterList({ scene }: { scene: Scene }) {
  const g = game();
  if (!scene.encounters?.length) return null;
  return (
    <div class="encounters">
      {scene.encounters.map((enc, i) => {
        const foes = enc.foes.map((f) => ent<NPC>('npc', f)).filter(Boolean) as NPC[];
        const down = foes.filter((f) => ['defeated', 'dead', 'fled', 'captured'].includes(f.status)).length;
        return (
          <div key={i} class="encounter">
            <div class="encounter__avatars">
              {foes.slice(0, 5).map((f) => (
                <button key={f.id} type="button" class="facebtn" onClick={() => openDrawer('npc', f.id)} aria-label={`${f.name}: profile`} title={f.name}>
                  <Face type="npc" id={f.id} size={34} />
                </button>
              ))}
            </div>
            <div class="encounter__main">
              <div class="encounter__label">{enc.label}</div>
              <div class="encounter__meta muted">
                {foes.length} {foes.length === 1 ? 'enemy' : 'enemies'}
                {enc.fighters && ` · ${enc.fighters.map((p) => ent<PC>('pc', p)?.name).join(', ')} only`}
                {down > 0 && ` · ${down} down`}
              </div>
            </div>
            <button type="button" class="btn btn--primary btn--sm" disabled={!!g.combat} onClick={() => openModal({ kind: 'encounter', scene: scene.id, index: i })}>
              <Icon name="swords" /> Start fight
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SceneMeta({ scene, act }: { scene: Scene; act?: Act }) {
  return (
    <div class="row scenemeta">
      <Badge tone="info" dot={false}>
        {KIND_LABEL[scene.kind]}
      </Badge>
      {scene.minutes && (
        <Badge tone="muted" dot={false}>
          <span class="num">
            {scene.minutes[0]}–{scene.minutes[1]} min
          </span>
        </Badge>
      )}
      {scene.optional && (
        <Badge tone="muted" dot={false}>
          Optional
        </Badge>
      )}
      {scene.expandedOnly && (
        <Badge tone="gold" dot={false}>
          Expanded build
        </Badge>
      )}
      {scene.branch && (
        <Badge tone="warn" dot={false}>
          {scene.branch === 'plane' ? 'Plane route' : 'Boat route'}
        </Badge>
      )}
      {scene.ref && <span class="scenemeta__ref muted">{scene.ref}</span>}
      {act && null}
    </div>
  );
}
