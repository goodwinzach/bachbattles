import { useEffect, useState } from 'preact/hooks';
import type { PC, Stat } from '../data/types';
import { STAT_ABBR, STAT_NAME, STATS } from '../data/types';
import { rollD20, rollFor, rollPlain } from '../state/actions';
import { statCalc } from '../state/derive';
import { signed, type RollResult } from '../state/dice';
import { all, clearLog, getData, getUi, setUi } from '../state/store';
import { Icon } from './icons';
import { Avatar, cx } from './kit';
import { getRoller, onRoller, setRollerOpen } from './rollbus';

export function RollResultView({ r, big }: { r: RollResult; big?: boolean }) {
  const outcome =
    r.success === true ? (r.inverted ? 'Safe' : 'Success') : r.success === false ? (r.inverted ? 'Stone' : 'Fail') : null;
  const tone = r.nat === 20 ? 'gold' : r.nat === 1 ? 'bad' : r.success === true ? 'good' : r.success === false ? 'bad' : r.tone ?? 'muted';
  return (
    <div class={cx('rollres', big && 'rollres--big', `t-${tone}`)} key={r.id}>
      <div class="rollres__total num">{r.total}</div>
      <div class="rollres__main">
        <div class="rollres__label">{r.label}</div>
        <div class="rollres__math num">
          {r.sides === 20 && r.dice.length > 1 ? (
            <>
              d20 {r.mode === 'adv' ? 'adv' : 'dis'} [{r.dice.map((d, i) => (
                <span key={i} class={d === r.kept ? 'kept' : 'dropped'}>
                  {i ? ', ' : ''}
                  {d}
                </span>
              ))}]
            </>
          ) : (
            <>
              {r.dice.length > 1 ? `${r.dice.length}d${r.sides}` : `d${r.sides}`} [{r.dice.join(', ')}]
            </>
          )}
          {r.parts?.map((p, i) => (
            <span key={i} title={p.label}>
              {' '}
              {signed(p.value)}
            </span>
          ))}
          {!r.parts && r.mod ? ` ${signed(r.mod)}` : ''}
          {r.dc != null && <span class="muted"> vs DC {r.dc}</span>}
        </div>
        {(outcome || r.nat) && (
          <div class="rollres__out">
            {r.nat === 20 && <span class="badge t-gold">Natural 20</span>}
            {r.nat === 1 && <span class="badge t-bad">Natural 1</span>}
            {outcome && <span class={cx('badge', `t-${r.success ? 'good' : 'bad'}`)}>{outcome}</span>}
          </div>
        )}
        {r.note && <div class="rollres__note">{r.note}</div>}
      </div>
    </div>
  );
}

export function DicePanel({ docked }: { docked?: boolean }) {
  const ui = getUi();
  const pcs = all<PC>('pc');
  // start from the latest preset: a check clicked while the tray was closed mounts it
  const init = getRoller().preset;
  const [who, setWho] = useState<string>(() => init.who ?? pcs[0].id);
  const [stat, setStat] = useState<Stat>(() => init.stat ?? 'cha');
  const [dc, setDc] = useState<string>(() => (init.dc != null ? String(init.dc) : ''));
  const [inverted, setInverted] = useState(() => !!init.inverted);
  const [expr, setExpr] = useState('2d6');
  const [, force] = useState(0);
  useEffect(
    () =>
      onRoller(() => {
        const { preset } = getRoller();
        if (preset.stat) setStat(preset.stat);
        if (preset.dc != null) setDc(String(preset.dc));
        setInverted(!!preset.inverted);
        if (preset.who) setWho(preset.who);
        force((n) => n + 1);
      }),
    [],
  );
  const pc = pcs.find((p) => p.id === who) ?? pcs[0];
  const calc = statCalc(pc, stat);
  const last = ui.lastRoll;
  const log = getData().log.filter((l) => l.kind === 'roll' && l.roll).slice(-8).reverse();
  const dcNum = dc.trim() ? parseInt(dc, 10) : undefined;
  const mode = ui.diceMode;
  return (
    <div class={cx('dice', docked && 'dice--docked')}>
      {last ? <RollResultView r={last} big /> : <div class="dice__empty muted">Roll something. Every DC in the script is clickable, too.</div>}
      <div class="dice__check">
        <div class="dice__who" role="group" aria-label="Who rolls">
          {pcs.map((p) => (
            <button key={p.id} type="button" class={cx('dice__pc', p.id === who && 'is-on')} aria-pressed={p.id === who} onClick={() => setWho(p.id)} title={p.name}>
              <Avatar icon={p.icon} hue={p.hue} size={28} ring={p.status === 'ghost' ? 'ghost' : undefined} />
              <span>{p.player}</span>
            </button>
          ))}
        </div>
        <div class="dice__stats" role="group" aria-label="Stat">
          {STATS.map((s) => {
            const c = statCalc(pc, s);
            return (
              <button key={s} type="button" class={cx('dice__stat', s === stat && 'is-on')} aria-pressed={s === stat} onClick={() => setStat(s)} title={STAT_NAME[s]}>
                <span>{STAT_ABBR[s]}</span>
                <span class="num">{signed(c.total)}</span>
              </button>
            );
          })}
        </div>
        <div class="dice__opts">
          <div class="seg seg--sm" role="group" aria-label="Advantage">
            {(['dis', 'normal', 'adv'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setUi({ diceMode: m })}>
                {m === 'dis' ? 'Disadv.' : m === 'adv' ? 'Advantage' : 'Normal'}
              </button>
            ))}
          </div>
          <label class="dice__dc">
            <span>DC</span>
            <input
              class="input input--sm num"
              inputMode="numeric"
              value={dc}
              placeholder="—"
              onInput={(e) => setDc((e.target as HTMLInputElement).value.replace(/[^0-9]/g, ''))}
              aria-label="Difficulty class"
            />
          </label>
          {stat === 'per' && (
            <label class="dice__inv" title="Medusa: 10 or lower is safe">
              <input type="checkbox" checked={inverted} onChange={(e) => setInverted((e.target as HTMLInputElement).checked)} /> Inverted
            </label>
          )}
        </div>
        <div class="dice__mods muted">
          {calc.override ? (
            <span class="gold">{calc.override}</span>
          ) : (
            <>
              {pc.name} {STAT_ABBR[stat]}: base {signed(calc.base)}
              {calc.parts.map((p) => ` ${signed(p.value)} ${p.label}`).join('')} = <strong class="num">{signed(calc.total)}</strong>
            </>
          )}
        </div>
        <button type="button" class="btn btn--primary btn--lg dice__go" onClick={() => rollFor(pc.id, stat, { dc: dcNum, inverted: inverted && stat === 'per', mode })}>
          <Icon name="dices" size={18} /> Roll {pc.player}'s {STAT_NAME[stat]}
        </button>
      </div>
      <div class="dice__quick" role="group" aria-label="Quick dice">
        {[4, 6, 8, 10, 12, 20, 100].map((s) => (
          <button key={s} type="button" class="dice__die" onClick={() => (s === 20 ? rollD20(mode, 0, 'd20') : rollPlain(`1d${s}`))}>
            d{s}
          </button>
        ))}
        <form
          class="dice__expr"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rollPlain(expr)) setExpr('2d6');
          }}
        >
          <input class="input input--sm mono" value={expr} onInput={(e) => setExpr((e.target as HTMLInputElement).value)} aria-label="Dice expression" />
          <button type="submit" class="btn btn--sm">
            Roll
          </button>
        </form>
      </div>
      {log.length > 0 && (
        <div class="dice__log">
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <span class="eyebrow">Recent rolls</span>
            <button type="button" class="btn btn--xs btn--ghost" onClick={clearLog}>
              Clear log
            </button>
          </div>
          <ul>
            {log.map((l) => (
              <li key={l.id} class="dice__logrow">
                <span class={cx('num dice__logtotal', l.roll!.nat === 20 && 'gold', l.roll!.nat === 1 && 'bad')}>{l.roll!.total}</span>
                <span class="grow">{l.roll!.label}</span>
                {l.roll!.success != null && <span class={cx('dice__logok', l.roll!.success ? 'good' : 'bad')}>{l.roll!.success ? '✓' : '✕'}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DiceTray({ hidden }: { hidden?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => onRoller(() => force((n) => n + 1)), []);
  const { open } = getRoller();
  const last = getUi().lastRoll;
  if (hidden && !open) return null;
  return (
    <>
      <button type="button" class={cx('dicefab', open && 'is-on')} onClick={() => setRollerOpen(!open)} aria-expanded={open} aria-label="Dice tray (D)" title="Dice tray (D)">
        <Icon name={open ? 'x' : 'dices'} size={22} />
        {!open && last && <span class="dicefab__last num">{last.total}</span>}
      </button>
      {open && (
        <div class="dicetray" role="dialog" aria-label="Dice tray">
          <div class="dicetray__head">
            <span class="eyebrow">Dice tray</span>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" onClick={() => setRollerOpen(false)} aria-label="Close dice tray">
              <Icon name="x" />
            </button>
          </div>
          <DicePanel />
        </div>
      )}
    </>
  );
}
