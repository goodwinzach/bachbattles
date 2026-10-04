// RUN: the DM screen for the live session.

import { useState } from 'preact/hooks';
import type { Ability, Act, Clue, Condition, Item, NPC, PC, Scene } from '../../data/types';
import {
  addCombatant,
  adjustHp,
  adjustNpcHp,
  combatStep,
  completeAndNext,
  endCombat,
  goScene,
  removeCombatant,
  resetTimer,
  revive,
  rollAttack,
  setCondition,
  setInit,
  setClue,
  toggleTimer,
  useAbility,
} from '../../state/actions';
import {
  abilitiesOf,
  abilityStatus,
  acCalc,
  fmtDuration,
  KIND_LABEL,
  neighbors,
  npcMaxHp,
  npcStat,
  sceneInPlay,
  sceneStatus,
  shielded,
  spine,
  timeSpent,
  totalSpent,
} from '../../state/derive';
import { signed } from '../../state/dice';
import { all, ent, game, getUi, openDrawer, setGame } from '../../state/store';
import { NpcStatusControl, PcStatusControl } from '../controls';
import { DicePanel } from '../dice';
import { ItemRow, MaskPicker, StatGrid } from '../detail';
import { useMedia, useTick } from '../hooks';
import { Icon } from '../icons';
import { Face } from '../profile';
import { CommitInput, Expander, HpBar, Pips, cx, hueVar } from '../kit';
import { Ref, Rich } from '../rich';
import { EncounterList, SceneBody, SceneMeta } from '../scene';

// ─── scene monitor ────────────────────────────────────────────────────────

function Slate({ scene, act }: { scene: Scene; act?: Act }) {
  const g = game();
  useTick(1000, g.timer.running);
  const spent = timeSpent(scene.id);
  const target = scene.minutes;
  const over = target && spent / 60000 > target[1];
  const { prev, next } = neighbors(scene.id);
  const list = all<Scene>('scene');
  return (
    <div class="slate">
      <div class="slate__clapper" aria-hidden="true" />
      <div class="slate__grid">
        <div class="slate__cell">
          <span class="slate__k">Scene</span>
          <span class="slate__v num">{scene.slate}</span>
        </div>
        <button type="button" class="slate__cell slate__cell--act" onClick={() => act && openDrawer('act', act.id)}>
          <span class="slate__k">{act?.num}</span>
          <span class="slate__v slate__v--sm">{act?.title}</span>
        </button>
        <div class="slate__cell">
          <span class="slate__k">Type</span>
          <span class="slate__v slate__v--sm">{KIND_LABEL[scene.kind]}</span>
        </div>
        <div class={cx('slate__cell', over && 'slate__cell--over')} title="Time on this scene vs. the target">
          <span class="slate__k">On scene</span>
          <span class="slate__v slate__v--sm num">
            {fmtDuration(spent)}
            {target && <span class="slate__of"> / {target[1]}m</span>}
          </span>
        </div>
        <div class="slate__cell slate__cell--rec">
          <span class={cx('rec', !g.timer.running && 'rec--off')} />
          <span class="slate__k">{g.timer.running ? 'Rolling' : 'Paused'}</span>
          <button type="button" class="btn btn--xs" onClick={toggleTimer} title="Session timer">
            <Icon name={g.timer.running ? 'pause' : 'play'} />
          </button>
        </div>
      </div>
      <div class="slate__title">
        <h1 class="slate__h display">{scene.title}</h1>
        <div class="slug">{scene.slug}</div>
        <SceneMeta scene={scene} />
      </div>
      <div class="slate__nav">
        <button type="button" class="btn btn--ghost" disabled={!prev} onClick={() => prev && goScene(prev.id)} title={prev ? `Back to ${prev.title}` : undefined}>
          <Icon name="chevron-left" /> <span class="slate__navlabel">Back</span>
        </button>
        <select class="select slate__pick" value={scene.id} onChange={(e) => goScene((e.target as HTMLSelectElement).value)} aria-label="Jump to scene">
          {all<Act>('act').map((a) => (
            <optgroup key={a.id} label={`${a.num}: ${a.title}`}>
              {list
                .filter((s) => s.act === a.id)
                .map((s) => (
                  <option key={s.id} value={s.id} disabled={!sceneInPlay(s) && s.id !== scene.id}>
                    {s.slate} · {s.title}
                    {sceneStatus(s) === 'done' ? ' ✓' : ''}
                    {!sceneInPlay(s) ? ' (not in this run)' : ''}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button type="button" class="btn btn--primary" onClick={completeAndNext} title={next ? `Mark this scene done and go to ${next.title} ( ] )` : 'Mark this scene done'}>
          <span class="slate__navlabel">{next ? 'Done, next' : 'Finish'}</span> <Icon name={next ? 'skip-forward' : 'check'} />
        </button>
      </div>
      {next && <div class="slate__next muted">Next: <Ref type="scene" id={next.id} /></div>}
    </div>
  );
}

function Monitor({ scene }: { scene: Scene }) {
  const act = ent<Act>('act', scene.act);
  return (
    <section class="monitor hue" style={{ '--c': hueVar(act?.hue) } as never} aria-label="Now playing">
      <Slate scene={scene} act={act} />
      <div class="monitor__body">
        <SceneBody scene={scene} prefix="run" />
      </div>
    </section>
  );
}

// ─── combat ───────────────────────────────────────────────────────────────

function DamageBox({ onApply, label }: { onApply: (n: number) => void; label: string }) {
  const [v, setV] = useState('');
  const n = parseInt(v, 10);
  return (
    <span class="dmgbox" role="group" aria-label={label}>
      <input class="input input--sm num" inputMode="numeric" placeholder="0" value={v} onInput={(e) => setV((e.target as HTMLInputElement).value.replace(/[^0-9]/g, ''))} aria-label={`${label} amount`} />
      <button type="button" class="btn btn--xs btn--danger" disabled={!n} onClick={() => { onApply(-n); setV(''); }} title="Damage">
        <Icon name="minus" />
      </button>
      <button type="button" class="btn btn--xs btn--good" disabled={!n} onClick={() => { onApply(n); setV(''); }} title="Heal">
        <Icon name="plus" />
      </button>
    </span>
  );
}

function CombatRow({ c, active, index }: { c: { key: string; type: 'pc' | 'npc'; id: string; init: number }; active: boolean; index: number }) {
  const [target, setTarget] = useState('');
  if (c.type === 'pc') {
    const pc = ent<PC>('pc', c.id);
    if (!pc) return null;
    const ac = acCalc(pc).total;
    const fightAbs = abilitiesOf(pc.id).filter((a) => a.max && (a.recharge === 'fight' || a.recharge === 'scene' || a.recharge === 'campaign'));
    return (
      <li class={cx('crow', active && 'is-active', pc.status !== 'alive' && `crow--${pc.status}`)}>
        <input class="crow__init input input--sm num" value={c.init} inputMode="numeric" aria-label={`${pc.name} initiative`} onChange={(e) => setInit(c.key, parseInt((e.target as HTMLInputElement).value, 10) || 0)} />
        <Face type="pc" id={pc.id} size={36} />
        <div class="crow__main">
          <div class="crow__top">
            <button type="button" class="crow__name" onClick={() => openDrawer('pc', pc.id)}>
              {pc.name}
            </button>
            <PcStatusControl pc={pc} size="sm" force />
            <span class="crow__ac num" title="Armor Class">
              <Icon name="shield" size={12} /> {ac}
            </span>
          </div>
          <div class="crow__hp">
            <HpBar hp={pc.hp} max={pc.hpMax} ghost={pc.status === 'ghost'} thin />
            <span class="num">
              {pc.hp}/{pc.hpMax}
            </span>
            <DamageBox label={`${pc.name} HP`} onApply={(n) => adjustHp(pc.id, n)} />
          </div>
          {fightAbs.length > 0 && (
            <div class="crow__abs">
              {fightAbs.map((a) => (
                <span key={a.id} class="crow__ab">
                  <button type="button" class="crow__abname" onClick={() => openDrawer('ability', a.id)}>
                    {a.name}
                  </button>
                  <Pips max={a.max!} used={a.used} label={a.name} onUse={() => useAbility(a.id, 1)} onRestore={() => useAbility(a.id, -1)} disabled={abilityStatus(a).status === 'disabled'} />
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" class="btn btn--ghost btn--icon btn--sm crow__x" onClick={() => removeCombatant(c.key)} aria-label={`Remove ${pc.name} from the fight`}>
          <Icon name="x" />
        </button>
      </li>
    );
  }
  const n = ent<NPC>('npc', c.id);
  if (!n) return null;
  return <NpcCombatRow c={c} n={n} active={active} target={target} setTarget={setTarget} index={index} />;
}

function NpcCombatRow({ c, n, active, target, setTarget, index }: { c: { key: string; init: number }; n: NPC; active: boolean; target: string; setTarget: (v: string) => void; index: number }) {
  const [hit, setHit] = useState<{ pc: string; dmg: number } | null>(null);
  const stat = npcStat(n);
  const max = npcMaxHp(n);
  const hp = n.hp ?? max ?? 0;
  const out = ['defeated', 'dead', 'fled', 'captured', 'stone'].includes(n.status);
  const targets = all<PC>('pc').filter((p) => p.status === 'alive' || p.status === 'ghost');
  const tgt = targets.find((p) => p.id === target);
  return (
    <li class={cx('crow crow--npc', active && 'is-active', out && 'is-out')}>
      <input class="crow__init input input--sm num" value={c.init} inputMode="numeric" aria-label={`${n.name} initiative`} onChange={(e) => setInit(c.key, parseInt((e.target as HTMLInputElement).value, 10) || 0)} />
      <Face type="npc" id={n.id} size={36} />
      <div class="crow__main">
        <div class="crow__top">
          <button type="button" class="crow__name" onClick={() => openDrawer('npc', n.id)}>
            {n.name}
          </button>
          <NpcStatusControl npc={n} size="sm" force />
          <span class="crow__ac num" title="Armor Class">
            <Icon name="shield" size={12} /> {stat?.invincible ? '∞' : stat?.ac ?? '—'}
          </span>
        </div>
        {stat?.invincible ? (
          <div class="crow__inv">
            <Icon name="sparkles" size={13} /> Invincible: every hit gets a cartoon reaction instead of damage.
          </div>
        ) : max != null ? (
          <div class="crow__hp">
            <HpBar hp={hp} max={max} thin />
            <span class="num">
              {hp}/{max}
            </span>
            <DamageBox label={`${n.name} HP`} onApply={(d) => adjustNpcHp(n.id, d)} />
          </div>
        ) : null}
        {stat && !out && (
          <div class="crow__atks">
            <select class="select select--sm crow__target" value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)} aria-label="Target">
              <option value="">Target…</option>
              {targets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (AC {acCalc(p).total})
                </option>
              ))}
            </select>
            {stat.attacks.map((a, i) =>
              a.bonus != null ? (
                <button
                  key={i}
                  type="button"
                  class="btn btn--xs"
                  onClick={() => {
                    const r = rollAttack(n.id, i, tgt ? acCalc(tgt).total : undefined) as (ReturnType<typeof rollAttack> & { damage?: number }) | null;
                    setHit(r && tgt && r.success && r.damage ? { pc: tgt.id, dmg: r.damage } : null);
                  }}
                  title={`${a.name}: ${signed(a.bonus)} to hit, ${a.dmg ?? 'no damage'}`}
                >
                  <Icon name="dices" /> {a.name}
                </button>
              ) : null,
            )}
          </div>
        )}
        {hit && (
          <div class="crow__hit">
            <span>
              Hit for <strong class="num">{hit.dmg}</strong> on {ent<PC>('pc', hit.pc)?.name}
            </span>
            <button
              type="button"
              class="btn btn--xs btn--danger"
              onClick={() => {
                adjustHp(hit.pc, -hit.dmg);
                setHit(null);
              }}
            >
              Apply damage
            </button>
            <button type="button" class="btn btn--xs btn--ghost" onClick={() => setHit(null)}>
              Ignore
            </button>
          </div>
        )}
      </div>
      <button type="button" class="btn btn--ghost btn--icon btn--sm crow__x" onClick={() => removeCombatant(c.key)} aria-label={`Remove ${n.name} from the fight`}>
        <Icon name="x" />
      </button>
      <span class="sr-only">{index}</span>
    </li>
  );
}

function CombatTracker() {
  const c = game().combat!;
  const [adding, setAdding] = useState('');
  const inFight = new Set(c.list.map((x) => x.key));
  const addable = [
    ...all<PC>('pc').filter((p) => !inFight.has(`pc:${p.id}`)).map((p) => ({ v: `pc:${p.id}`, label: p.name })),
    ...all<NPC>('npc').filter((n) => n.stat && !inFight.has(`npc:${n.id}`)).map((n) => ({ v: `npc:${n.id}`, label: n.name })),
  ];
  const actor = c.list[c.turn];
  const actorName = actor ? (actor.type === 'pc' ? ent<PC>('pc', actor.id)?.name : ent<NPC>('npc', actor.id)?.name) : '';
  return (
    <section class="combat" aria-label="Combat tracker">
      <div class="combat__head">
        <div class="combat__title">
          <Icon name="swords" size={18} />
          <span class="display combat__label">{c.label}</span>
          <span class="combat__round num">Round {c.round}</span>
        </div>
        <div class="combat__now">
          <span class="eyebrow">Acting</span> <strong>{actorName}</strong>
        </div>
        <div class="row">
          <button type="button" class="btn btn--sm btn--ghost" onClick={() => combatStep(-1)}>
            <Icon name="chevron-left" /> Prev
          </button>
          <button type="button" class="btn btn--sm btn--primary" onClick={() => combatStep(1)}>
            Next turn <Icon name="chevron-right" />
          </button>
          <button type="button" class="btn btn--sm" onClick={endCombat} title="Ends the fight and refreshes once-per-fight abilities">
            <Icon name="flag" /> End fight
          </button>
        </div>
      </div>
      <ol class="combat__list">
        {c.list.map((x, i) => (
          <CombatRow key={x.key} c={x} active={i === c.turn} index={i} />
        ))}
      </ol>
      <div class="combat__foot">
        <select class="select select--sm" value={adding} onChange={(e) => setAdding((e.target as HTMLSelectElement).value)} aria-label="Add to the fight">
          <option value="">Add someone to the fight…</option>
          {addable.map((a) => (
            <option key={a.v} value={a.v}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          class="btn btn--sm"
          disabled={!adding}
          onClick={() => {
            const [t, id] = adding.split(':');
            addCombatant(t as 'pc' | 'npc', id);
            setAdding('');
          }}
        >
          <Icon name="plus" /> Add
        </button>
        <span class="spacer" />
        <span class="muted combat__tip">Initiative: d20 + Agility. Edit the numbers to use the players' real rolls.</span>
      </div>
    </section>
  );
}

// ─── party ────────────────────────────────────────────────────────────────

function PartyMember({ pc }: { pc: PC }) {
  const ac = acCalc(pc);
  const abs = abilitiesOf(pc.id).filter((a) => !(a.secret && !a.revealed && shielded()));
  const items = all<Item>('item').filter((i) => i.holder === pc.id && i.state !== 'spent' && i.state !== 'destroyed' && i.kind !== 'mask');
  const bagels = ent<Item>('item', 'bagels');
  const canRevive = pc.status === 'ghost' && bagels && (bagels.state === 'held' || bagels.state === 'equipped') && (bagels.qty ?? 0) > 0;
  return (
    <li class={cx('member hue', `member--${pc.status}`)} style={{ '--c': hueVar(pc.hue) } as never}>
      <div class="member__head">
        <Face type="pc" id={pc.id} size={44} />
        <div class="member__id">
          <button type="button" class="member__name" onClick={() => openDrawer('pc', pc.id)}>
            {pc.name}
          </button>
          <span class="member__player">{pc.player}</span>
        </div>
        <PcStatusControl pc={pc} size="sm" />
        <span class="member__ac num" title={ac.parts.map((p) => `${p.label} +${p.value}`).join('\n') || 'Armor Class'}>
          <Icon name="shield" size={12} />
          {ac.total}
        </span>
      </div>
      <div class="member__hp">
        <HpBar hp={pc.hp} max={pc.hpMax} ghost={pc.status === 'ghost'} />
        <span class="member__hpnum num">
          {pc.status === 'ghost' ? 'Ghost' : `${pc.hp}/${pc.hpMax}`}
        </span>
        <span class="member__hpbtns">
          <button type="button" class="hpbtn" onClick={() => adjustHp(pc.id, -5)} aria-label={`${pc.name} minus 5 HP`}>
            −5
          </button>
          <button type="button" class="hpbtn" onClick={() => adjustHp(pc.id, -1)} aria-label={`${pc.name} minus 1 HP`}>
            −1
          </button>
          <button type="button" class="hpbtn" onClick={() => adjustHp(pc.id, 1)} aria-label={`${pc.name} plus 1 HP`}>
            +1
          </button>
          <button type="button" class="hpbtn" onClick={() => adjustHp(pc.id, 5)} aria-label={`${pc.name} plus 5 HP`}>
            +5
          </button>
        </span>
      </div>
      <StatGrid pc={pc} compact />
      {pc.id === 'flynn' && <MaskPicker pc={pc} />}
      <div class="member__abs">
        {abs.map((a) => {
          const st = abilityStatus(a);
          if (!a.max) {
            return (
              <button key={a.id} type="button" class={cx('abtag', `abtag--${st.status}`)} onClick={() => openDrawer('ability', a.id)} title={st.why ?? a.summary}>
                {a.name}
              </button>
            );
          }
          return (
            <span key={a.id} class={cx('abtag abtag--uses', `abtag--${st.status}`)}>
              <button type="button" class="abtag__name" onClick={() => openDrawer('ability', a.id)} title={st.why}>
                {a.name}
              </button>
              <Pips max={a.max} used={a.used} label={a.name} disabled={st.status === 'disabled' || st.status === 'locked'} onUse={() => useAbility(a.id, 1)} onRestore={() => useAbility(a.id, -1)} />
            </span>
          );
        })}
      </div>
      {pc.effects.length > 0 && (
        <div class="member__effects">
          {pc.effects.map((e) => (
            <Ref key={e} type="condition" id={e} chip noDot />
          ))}
        </div>
      )}
      {canRevive && (
        <button type="button" class="btn btn--sm btn--good member__revive" onClick={() => revive(pc.id, true)} title="After a living player does something statistically improbable in real life">
          <Icon name="bagel" /> Revive with a bagel
        </button>
      )}
      {items.length > 0 && (
        <Expander id={`party:${pc.id}:items`} title="Carrying" icon="package" count={items.length} variant="plain">
          <div class="stack" style={{ '--gap': '4px' } as never}>
            {items.map((i) => (
              <ItemRow key={i.id} item={i} showHolder={false} />
            ))}
          </div>
        </Expander>
      )}
    </li>
  );
}

function Party() {
  const pcs = all<PC>('pc');
  const conds = all<Condition>('condition').filter((c) => c.scope === 'party');
  const ghosts = pcs.filter((p) => p.status === 'ghost').length;
  return (
    <section class="panel party" aria-label="Party">
      <div class="panel__head">
        <span class="panel__title">
          <Icon name="users" size={15} /> The party
        </span>
        <span class="panel__meta">
          {conds.map((c) => (
            <ConditionToggle key={c.id} cond={c} />
          ))}
          {ghosts > 0 && <span class="badge t-ghost">{ghosts} ghost{ghosts > 1 ? 's' : ''}</span>}
        </span>
      </div>
      <ul class="members">
        {pcs.map((p) => (
          <PartyMember key={p.id} pc={p} />
        ))}
      </ul>
    </section>
  );
}

function ConditionToggle({ cond }: { cond: Condition }) {
  const mods = Object.entries(cond.mods ?? {})
    .map(([s, v]) => `${s.toUpperCase()} ${signed(v ?? 0)}`)
    .join(', ');
  return (
    <button type="button" class={cx('condtag', cond.active && 'is-on')} aria-pressed={cond.active} onClick={() => setCondition(cond.id, !cond.active)} title={`${cond.name}: ${mods}. Click to turn ${cond.active ? 'off' : 'on'}.`}>
      <Icon name={cond.icon} size={13} />
      {cond.name}
      <span class="condtag__mods num">{mods}</span>
    </button>
  );
}

// ─── side panels ──────────────────────────────────────────────────────────

function SessionPanel() {
  const g = game();
  useTick(1000, g.timer.running);
  return (
    <section class="panel sessionpanel" aria-label="Session timer">
      <span class={cx('rec', !g.timer.running && 'rec--off')} />
      <div class="sessionpanel__text">
        <div class="eyebrow">Session</div>
        <div class="sessionpanel__time num">{fmtDuration(totalSpent())}</div>
      </div>
      <span class="spacer" />
      <button type="button" class="btn btn--sm" onClick={toggleTimer} title="Real time spent per scene feeds the pacing chart on the Map">
        <Icon name={g.timer.running ? 'pause' : 'play'} /> {g.timer.running ? 'Pause' : 'Start'}
      </button>
      <button type="button" class="btn btn--sm btn--ghost btn--icon" onClick={resetTimer} title="Reset the session timer" aria-label="Reset the session timer">
        <Icon name="timer-reset" />
      </button>
    </section>
  );
}

function Resources() {
  const gold = ent<Item>('item', 'gold')!;
  const bagels = ent<Item>('item', 'bagels')!;
  const pistols = all<Item>('item').filter((i) => i.ammoMax != null && (i.state === 'held' || i.state === 'equipped'));
  const keyItems = ['wedding-ring', 'v-mask', 'dr-pepper', 'staff'].map((id) => ent<Item>('item', id)!).filter(Boolean);
  return (
    <section class="panel" aria-label="Resources">
      <div class="panel__head">
        <span class="panel__title">
          <Icon name="package" size={15} /> Resources
        </span>
      </div>
      <div class="stack" style={{ '--gap': '6px' } as never}>
        <ItemRow item={gold} />
        <ItemRow item={bagels} />
        {pistols.map((p) => (
          <ItemRow key={p.id} item={p} />
        ))}
        {keyItems.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </div>
    </section>
  );
}

function ClueBoard() {
  const clues = all<Clue>('clue');
  const revealed = clues.filter((c) => c.revealed).length;
  return (
    <section class="panel" aria-label="Clues">
      <Expander id="run:clues" title={`Clue board · ${revealed}/${clues.length}`} icon="lightbulb" variant="plain" defaultOpen>
        <ul class="clues">
          {clues.map((c) => {
            const hidden = c.secret && !c.revealed && shielded();
            return (
              <li key={c.id} class={cx('clue', c.revealed && 'is-on')}>
                <button type="button" class="clue__toggle" aria-pressed={c.revealed} onClick={() => setClue(c.id, !c.revealed)} title={c.revealed ? 'Mark hidden' : 'Mark revealed'}>
                  <Icon name={c.revealed ? 'eye' : 'eye-off'} size={14} />
                </button>
                <div class="clue__main">
                  <button type="button" class="clue__name" onClick={() => openDrawer('clue', c.id)}>
                    {c.name}
                  </button>
                  {!hidden && <Rich text={c.text} class="clue__text" />}
                </div>
              </li>
            );
          })}
        </ul>
      </Expander>
    </section>
  );
}

function Notes() {
  const g = game();
  return (
    <section class="panel" aria-label="Session notes">
      <div class="panel__head">
        <span class="panel__title">
          <Icon name="notebook-pen" size={15} /> Session notes
        </span>
      </div>
      <CommitInput
        id="session-notes"
        multiline
        rows={5}
        value={g.notes}
        placeholder="Stupid things that happened tonight (great material for the bagel shop)."
        onCommit={(v) => setGame({ notes: v }, 'Session notes updated')}
      />
    </section>
  );
}

function StoryStrip() {
  const g = game();
  const acts = all<Act>('act');
  const scenes = all<Scene>('scene');
  return (
    <section class="strip" aria-label="Story so far">
      <div class="strip__scroll">
        {acts.map((a) => (
          <div key={a.id} class="strip__act hue" style={{ '--c': hueVar(a.hue) } as never}>
            <div class="strip__actname">{a.num}</div>
            <div class="strip__scenes">
              {scenes
                .filter((s) => s.act === a.id)
                .map((s) => {
                  const st = sceneStatus(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      class={cx('strip__s', `strip__s--${st}`, !sceneInPlay(s) && 'is-out', s.optional && 'is-opt')}
                      onClick={() => goScene(s.id)}
                      title={`${s.slate} ${s.title}${!sceneInPlay(s) ? ' (not in this run)' : ''}`}
                      aria-current={g.scene === s.id ? 'step' : undefined}
                    >
                      <span class="num">{s.slate}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <div class="strip__legend muted">
        <span><i class="lg lg--done" /> done</span>
        <span><i class="lg lg--active" /> now</span>
        <span><i class="lg lg--up" /> upcoming</span>
        <span><i class="lg lg--out" /> skipped</span>
        <span class="num">{spine().filter((s) => s.status === 'done').length}/{spine().length} scenes</span>
      </div>
    </section>
  );
}

export function RunView() {
  const g = game();
  const scene = ent<Scene>('scene', g.scene) ?? all<Scene>('scene')[0];
  const wide = useMedia('(min-width: 1180px)');
  void getUi();
  return (
    <div class="view run">
      <div class="run__main">
        <Monitor scene={scene} />
        {g.combat ? (
          <CombatTracker />
        ) : scene.encounters?.length ? (
          <section class="panel" aria-label="Encounters">
            <div class="panel__head">
              <span class="panel__title">
                <Icon name="swords" size={15} /> Fights in this scene
              </span>
            </div>
            <EncounterList scene={scene} />
          </section>
        ) : null}
        <StoryStrip />
      </div>
      <aside class="run__side">
        <SessionPanel />
        <Party />
        {wide && (
          <section class="panel" aria-label="Dice">
            <div class="panel__head">
              <span class="panel__title">
                <Icon name="dices" size={15} /> Dice
              </span>
            </div>
            <DicePanel docked />
          </section>
        )}
        <Resources />
        <ClueBoard />
        <Notes />
      </aside>
    </div>
  );
}

export type { Ability };
