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
  reviveEveryone,
  rollMedusa,
  setClue,
  setCostello,
  takeOut,
  setItemHolder,
  setItemState,
  setCatVariant,
  setMask,
  setPcStatus,
  setRoute,
} from '../state/actions';
import { dialogueOf, isUnmasked, KIND_LABEL, nameOf, sceneFoes, sceneMust, shielded } from '../state/derive';
import { all, ent, game, getUi, openDrawer, openModal, setUi } from '../state/store';
import { SIN_ROOMS } from '../data/scenes';
import { NpcStatusControl } from './controls';
import { DmNote, ItemRow, Secret } from './detail';
import { DialogueOptions } from './dialogue';
import { LocationBanner } from './location';
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

/** The question that usually pulls each fact out of Costello, and his answer to it. */
const COSTELLO_ASKS: Record<string, string> = {
  'fact-thief': 'Who took the ring?',
  'fact-hollywood': 'Where is it?',
  'fact-death': 'Are we safe?',
  'fact-riddle': 'How do we get it back?',
};

function costelloAnswer(factId: string): string | undefined {
  const npc = ent<NPC>('npc', 'costello');
  const q = COSTELLO_ASKS[factId];
  return npc && q ? dialogueOf(npc).find((c) => c.cue === q)?.options[0] : undefined;
}

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
      {g.costelloAsked >= 3 && (
        <div class="callout">
          <Icon name="flag" size={16} />
          <span>That was three. Abbott and Costello are gone, and the party is standing in an empty field. Let them talk about plane or boat.</span>
        </div>
      )}
      <div class="facts4">
        {facts.map((f, i) => {
          const said = costelloAnswer(f.id);
          // the riddle is its own answer: no need to print it twice
          const answer = said && !f.text.toLowerCase().includes(said.toLowerCase().replace(/[.“”"]/g, '').trim()) ? said : undefined;
          return (
            <button key={f.id} type="button" class={cx('fact', f.revealed && 'is-on')} aria-pressed={f.revealed} onClick={() => setClue(f.id, !f.revealed)}>
              <span class="fact__n num">{i + 1}</span>
              <span class="fact__body">
                <Rich text={f.text} />
                {COSTELLO_ASKS[f.id] && <span class="fact__q">Asked “{COSTELLO_ASKS[f.id]}”</span>}
                {answer && <span class="fact__a">“{answer}”</span>}
              </span>
              <Icon name={f.revealed ? 'eye' : 'eye-off'} size={14} />
            </button>
          );
        })}
      </div>
      <p class="widget__foot">Only Flynn's questions count. More answers to pick from are under Talk.</p>
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
  const optional = rooms.filter((r) => r.id !== 'pride' && r.id !== 'gluttony');
  const unvisited = optional.filter((r) => r.status !== 'done' && r.status !== 'skipped' && r.id !== g.scene);
  const played = optional.length - unvisited.length - optional.filter((r) => r.status === 'skipped').length;
  const pickRandom = () => {
    if (!prideDone && g.scene !== 'pride') return goScene('pride');
    // Pride, then one to three more rooms, then Gluttony: the more rooms played, the likelier Gluttony comes up
    const gluttonyChance = played === 0 ? 0 : played === 1 ? 1 / 3 : played === 2 ? 2 / 3 : 1;
    if (!unvisited.length || Math.random() < gluttonyChance) return goScene('gluttony');
    goScene(unvisited[Math.floor(Math.random() * unvisited.length)].id);
  };
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="door-open" size={16} />
        <span class="widget__title">The seven buildings</span>
        <span class="muted">Pride first, then one to three more, then Gluttony.</span>
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

/** The voyage: share out everything the party has picked up so far. */
function GearWidget() {
  const pcs = all<PC>('pc');
  const ours = (i: Item) => i.holder === 'party' || pcs.some((p) => p.id === i.holder);
  const found = (i: Item) => i.state === 'unclaimed' && !!i.source && ent<Scene>('scene', i.source)?.status === 'done';
  const items = all<Item>('item').filter((i) => (i.kind === 'weapon' || i.kind === 'gear') && i.state !== 'destroyed' && i.state !== 'spent' && (ours(i) || found(i)));
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="package" size={16} />
        <span class="widget__title">Share out the gear</span>
        <span class="muted">{items.length ? `${items.length} weapons and gear picked up so far` : 'Nothing picked up yet'}</span>
      </div>
      {items.length ? (
        <ul class="gear">
          {items.map((i) => (
            <li key={i.id} class="gear__row">
              <Icon name={i.icon} size={15} class="gear__icon" />
              <span class="gear__name">
                <Ref type="item" id={i.id} noDot />
                <span class="muted num">
                  {[i.dmg, i.range, i.ammoMax != null ? `${i.ammo ?? 0}/${i.ammoMax} shots` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <select
                class="select select--sm"
                aria-label={`Who carries the ${i.name}`}
                value={ours(i) ? i.holder : ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  if (v) setItemHolder(i.id, v);
                  else setItemState(i.id, 'unclaimed', '');
                }}
              >
                <option value="">Left behind</option>
                <option value="party">The party</option>
                {pcs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : (
        <div class="muted">Weapons from the bar, the Gentlemen and the airfield show up here once those scenes are done.</div>
      )}
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
        <span class="muted">
          {shop ? 'Free everything bagels. One random, stupid act from Flynn, in real life, brings everyone back.' : `${have} bagel${have === 1 ? '' : 's'} on hand`}
        </span>
      </div>
      {ghosts.length === 0 ? (
        <div class="muted">Nobody is a ghost right now.</div>
      ) : (
        <div class="stack" style={{ '--gap': '8px' } as never}>
          {shop && ghosts.length > 1 && (
            <button type="button" class="btn btn--good" onClick={reviveEveryone} title="After Flynn does something random and stupid in real life">
              <Icon name="sparkles" /> Flynn did it: everyone is back
            </button>
          )}
          {ghosts.map((p) => (
            <div key={p.id} class="ghostrow">
              <Face type="pc" id={p.id} size={30} />
              <span class="grow">
                <Ref type="pc" id={p.id} noDot /> <span class="muted">is a ghost</span>
              </span>
              <button
                type="button"
                class="btn btn--sm btn--good"
                disabled={!shop && have < 1}
                onClick={() => revive(p.id, !shop)}
                title={shop ? 'After Flynn does something random and stupid in real life' : 'Only after a living player eats a bagel and does something statistically improbable in real life'}
              >
                <Icon name="sparkles" /> {!shop ? 'Improbable act done: revive' : ghosts.length > 1 ? 'Just this one' : 'Flynn did it: back to life'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The scripted deaths in the studio: who is still standing, and a one-tap way to take them out. */
function WipeWidget({ scene }: { scene: Scene }) {
  const g = game();
  const standing = all<PC>('pc').filter((p) => p.id !== 'flynn' && p.status !== 'ghost');
  const round = g.combat?.scene === scene.id ? g.combat.round : null;
  const guide =
    scene.id === 'oh-dae-su'
      ? 'Outline version: whatever the dice say, he takes one groomsman out in round 1 and another in round 2. After that he can be stopped.'
      : scene.id === 'toothless'
        ? 'Outline version: one groomsman falls each round until only Flynn is standing.'
        : 'Round 1: show he cannot be hurt, and take one out. Round 2: one or two more. Round 3: the rest. Round 4 only for comedy.';
  return (
    <div class="widget">
      <div class="widget__head">
        <Icon name="skull" size={16} />
        <span class="widget__title">{scene.id === 'oh-dae-su' ? 'Two have to fall' : 'The wipe'}</span>
        <span class="muted">{round ? `Round ${round}` : 'Start the fight to count rounds'}</span>
      </div>
      <p class="wipe__guide">{guide}</p>
      {standing.length ? (
        <div class="stack" style={{ '--gap': '8px' } as never}>
          {standing.map((p) => (
            <div key={p.id} class="ghostrow">
              <Face type="pc" id={p.id} size={30} />
              <span class="grow">
                <Ref type="pc" id={p.id} noDot /> <span class="muted">{p.status === 'down' ? 'knocked out' : `${p.hp}/${p.hpMax} HP`}</span>
              </span>
              <button type="button" class="btn btn--sm btn--danger" onClick={() => takeOut(p.id)} title="They fall, whatever the dice said, and keep playing as a ghost">
                <Icon name="skull" /> Takes them out
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div class="callout callout--gold">
          <Icon name="flag" size={16} />
          <span>
            Only Flynn is standing.{' '}
            {scene.id === 'toothless' ? 'He lands the last blow on the wounded dragon, or Lou yells "Cut!" and calls him off.' : scene.id === 'cat' ? 'The Cat bows, tidies his hat and leaves.' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** Inside the Volume nobody comes back: the studio is fake, and the improbable act needs the real world. */
function NoBagelsWidget() {
  return (
    <div class="widget widget--slim">
      <Icon name="bagel" size={16} />
      <span class="grow">
        No bagel revivals inside the Volume. Ghosts keep playing; the <Ref type="location" id="bagel-shop" noDot /> comes after the finale.
      </span>
    </div>
  );
}

export function SceneWidget({ scene }: { scene: Scene }) {
  const parts = [];
  if (scene.id === 'costello') parts.push(<CostelloWidget key="c" />);
  if (scene.id === 'route-choice') parts.push(<RouteWidget key="r" />);
  if (scene.id === 'voyage') parts.push(<GearWidget key="g" />);
  if (scene.id === 'gentlemen') parts.push(<BillWidget key="b" />);
  if (scene.id === 'john-doe') parts.push(<MedusaWidget key="m" />);
  if (SIN_ROOMS.includes(scene.id)) parts.push(<SinsWidget key="s" scene={scene} />);
  if (scene.id === 'wrath') parts.push(<KingpinWidget key="k" />);
  if (scene.variantMust || scene.id === 'cat') parts.push(<VariantWidget key="v" />);
  if (scene.id === 'fourth-mask') parts.push(<UnmaskWidget key="u" />);
  const ghosts = all<PC>('pc').some((p) => p.status === 'ghost');
  if ((scene.id === 'oh-dae-su' || scene.id === 'toothless') && !game().catVariant) parts.push(<WipeWidget key="w" scene={scene} />);
  if (scene.id === 'cat') parts.push(<WipeWidget key="w" scene={scene} />);
  if (scene.id === 'gluttony' && ghosts) parts.push(<BagelWidget key="d" />);
  if (scene.location === 'volume' && ghosts) parts.push(<NoBagelsWidget key="nb" />);
  if (scene.id === 'epilogue') parts.push(<BagelWidget key="ds" shop />);
  if (!parts.length) return null;
  return <div class="widgets">{parts}</div>;
}

// ─── the body ─────────────────────────────────────────────────────────────

export function SceneBody({ scene, prefix, compact }: { scene: Scene; prefix: string; compact?: boolean }) {
  const id = (k: string) => `${prefix}:${scene.id}:${k}`;
  const foes = sceneFoes(scene);
  const talkers = talkersOf(scene);
  const mapNotes = game().mapNotes.filter((n) => n.scene === scene.id && n.text.trim());
  const stats = scene.rolls?.map((r) => r.stat).filter((s): s is Stat => s !== 'any');
  return (
    <div class="scenebody">
      <LocationBanner scene={scene} compact={compact} />
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
        {mapNotes.length ? (
          <Expander id={id('mapnotes')} title="Your map notes" icon="sticky-note" count={mapNotes.length} defaultOpen>
            <div class="mapnotes">
              {mapNotes.map((n) => (
                <div key={n.id} class={cx('mapnotes__note', `mapnotes__note--${n.color}`)}>
                  <Rich text={n.text} />
                </div>
              ))}
              <button type="button" class="btn btn--xs btn--ghost mapnotes__edit" onClick={() => setUi({ view: 'map', mapMode: 'flow' })}>
                <Icon name="workflow" /> Edit on the story map
              </button>
            </div>
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
                {enc.rounds && ` · ${enc.rounds[0] === enc.rounds[1] ? enc.rounds[0] : `${enc.rounds[0]}–${enc.rounds[1]}`} round${enc.rounds[1] === 1 ? '' : 's'}`}
                {down > 0 && ` · ${down} down`}
              </div>
              {enc.ends && (
                <div class="encounter__ends">
                  <Icon name="flag" size={12} /> <Rich text={enc.ends} />
                </div>
              )}
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
