// RULES: the rules reference and DM craft, plus quick references generated from the campaign.

import { useState } from 'preact/hooks';
import { RULE_GROUPS } from '../../data/rules';
import type { Act, NPC, PC, Rule, Scene } from '../../data/types';
import { STAT_ABBR, STATS } from '../../data/types';
import { abilitiesOf, entityText, npcStat, RECHARGE_LABEL, sceneInPlay, shielded, statCalc } from '../../state/derive';
import { signed } from '../../state/dice';
import { all, ent, getUi, openDrawer, setUi } from '../../state/store';
import { RuleTable, Secret } from '../detail';
import { setBulk } from '../hooks';
import { Icon } from '../icons';
import { Avatar, Expander, cx, hueVar } from '../kit';
import { CheckChip, Ref, Rich, RichList, RichParas } from '../rich';

function RuleBody({ rule }: { rule: Rule }) {
  const body = (
    <div class="stack" style={{ '--gap': '12px' } as never}>
      <RichParas paras={rule.body} class="prose" />
      <RichList items={rule.list} />
      {rule.table && <RuleTable table={rule.table} />}
      {rule.dmNote && <div class="dmnote">{rule.dmNote}</div>}
    </div>
  );
  return rule.secret ? <Secret>{body}</Secret> : body;
}

function CheatSheet() {
  const scenes = all<Scene>('scene').filter((s) => s.rolls?.length);
  return (
    <div class="tablewrap">
      <table class="table cheat">
        <thead>
          <tr>
            <th>Scene</th>
            <th>Rolls (click to roll)</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((s) => (
            <tr key={s.id} class={cx(!sceneInPlay(s) && 'is-out')}>
              <td>
                <button type="button" class="linkish" onClick={() => openDrawer('scene', s.id)}>
                  <span class="num muted">{s.slate}</span> {s.title}
                </button>
              </td>
              <td>
                <div class="cheat__rolls">
                  {s.rolls!.map((r, i) => (
                    <span key={i} class="cheat__roll">
                      <CheckChip stat={r.stat} dc={r.dc} inverted={r.inverted} />
                      <span class="cheat__label">
                        <Rich text={r.label} />
                      </span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BossOrder() {
  const scenes = all<Scene>('scene').filter((s) => s.encounters?.length && !s.optional);
  return (
    <ol class="bossorder">
      {scenes.map((s) => {
        const act = ent<Act>('act', s.act);
        return (
          <li key={s.id} class={cx('bossorder__row hue', !sceneInPlay(s) && 'is-out')} style={{ '--c': hueVar(act?.hue) } as never}>
            <span class="bossorder__slate num">{s.slate}</span>
            <div class="grow">
              <div class="bossorder__name">
                {s.encounters!.map((e) => e.label).join(' · ')}
              </div>
              <div class="muted bossorder__meta">
                {s.encounters!
                  .flatMap((e) => e.foes)
                  .slice(0, 4)
                  .map((f) => {
                    const n = ent<NPC>('npc', f);
                    const st = n ? npcStat(n) : undefined;
                    return n ? `${n.name} ${st?.invincible ? '(invincible)' : `AC ${st?.ac} HP ${st?.hp}`}` : '';
                  })
                  .join(' · ')}
              </div>
            </div>
            <button type="button" class="btn btn--xs btn--ghost" onClick={() => openDrawer('scene', s.id)}>
              Open
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function PartyCard() {
  const pcs = all<PC>('pc');
  return (
    <div class="tablewrap">
      <table class="table partytable">
        <thead>
          <tr>
            <th>Player</th>
            {STATS.map((s) => (
              <th key={s} class="num">
                {STAT_ABBR[s]}
              </th>
            ))}
            <th>Abilities</th>
          </tr>
        </thead>
        <tbody>
          {pcs.map((p) => (
            <tr key={p.id}>
              <td>
                <span class="row row--nowrap" style={{ gap: '8px' }}>
                  <Avatar icon={p.icon} hue={p.hue} size={24} />
                  <Ref type="pc" id={p.id} noDot />
                </span>
              </td>
              {STATS.map((s) => {
                const c = statCalc(p, s);
                const d = c.total - c.base;
                const why = [`Base ${signed(c.base)}`, ...c.parts.map((x) => `${x.label} ${signed(x.value)}`), c.override ?? ''].filter(Boolean).join('\n');
                return (
                  <td key={s} class="num" title={why}>
                    {signed(c.total)}
                    {d !== 0 && !c.override && (
                      <span class={cx('pt__delta', d < 0 ? 'bad' : 'good')}>
                        <Icon name={d < 0 ? 'chevron-down' : 'chevron-up'} size={10} />
                        {Math.abs(d)}
                      </span>
                    )}
                  </td>
                );
              })}
              <td>
                {abilitiesOf(p.id)
                  .filter((a) => !(a.secret && !a.revealed && shielded()))
                  .map((a, i) => (
                    <span key={a.id}>
                      {i ? ', ' : ''}
                      <Ref type="ability" id={a.id} noDot />
                      {a.max ? <span class="muted"> ({a.max} {RECHARGE_LABEL[a.recharge]})</span> : null}
                    </span>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RulesView() {
  const ui = getUi();
  const [q, setQ] = useState('');
  const rules = all<Rule>('rule');
  const query = q.trim().toLowerCase();
  const visible = (r: Rule) => !query || (r.title + ' ' + entityText(r)).toLowerCase().includes(query);
  const groups = RULE_GROUPS.filter((g) => ui.rulesGroup === 'all' || ui.rulesGroup === g.id);
  const extra = ui.rulesGroup === 'all' || ui.rulesGroup === 'quick';
  return (
    <div class="view rules">
      <aside class="rules__nav">
        <label class="searchfield">
          <Icon name="search" size={16} />
          <input class="input" placeholder="Search the rules" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search the rules" />
        </label>
        <nav class="rules__groups" aria-label="Rule sections">
          <button type="button" class={cx('rules__group', ui.rulesGroup === 'all' && 'is-on')} onClick={() => setUi({ rulesGroup: 'all' })}>
            Everything
          </button>
          <button type="button" class={cx('rules__group', ui.rulesGroup === 'quick' && 'is-on')} onClick={() => setUi({ rulesGroup: 'quick' })}>
            Quick reference
          </button>
          {RULE_GROUPS.map((g) => (
            <button key={g.id} type="button" class={cx('rules__group', ui.rulesGroup === g.id && 'is-on')} onClick={() => setUi({ rulesGroup: g.id })}>
              {g.id === 'secrets' && <Icon name="lock" size={13} />}
              {g.title}
            </button>
          ))}
        </nav>
        <div class="row">
          <button type="button" class="btn btn--xs btn--ghost" onClick={() => setBulk('rules', true)}>
            <Icon name="chevrons-up-down" /> Expand all
          </button>
          <button type="button" class="btn btn--xs btn--ghost" onClick={() => setBulk('rules', false)}>
            <Icon name="chevrons-down-up" /> Collapse all
          </button>
        </div>
      </aside>
      <div class="rules__body">
        {extra && !query && (
          <section class="rules__sec">
            <header class="rules__head">
              <h2 class="rules__h">Quick reference</h2>
              <p class="muted">Built from the campaign itself, so edits show up here too.</p>
            </header>
            <Expander id="rules:quick:party" title="The party at a glance" icon="users" variant="box" defaultOpen hint="Live stats: masks and conditions included">
              <PartyCard />
            </Expander>
            <Expander id="rules:quick:cheat" title="Roll cheat sheet by scene" icon="dices" variant="box">
              <CheatSheet />
            </Expander>
            <Expander id="rules:quick:boss" title="Fights in order" icon="swords" variant="box">
              <BossOrder />
            </Expander>
          </section>
        )}
        {ui.rulesGroup !== 'quick' &&
          groups.map((g) => {
            const list = rules.filter((r) => r.group === g.id && visible(r));
            if (!list.length) return null;
            return (
              <section key={g.id} class="rules__sec" id={`rules-${g.id}`}>
                <header class="rules__head">
                  <h2 class="rules__h">
                    {g.id === 'secrets' && <Icon name="lock" size={18} />}
                    {g.title}
                  </h2>
                  <p class="muted">{g.blurb}</p>
                </header>
                {list.map((r) => (
                  <Expander
                    key={r.id}
                    id={`rules:${r.id}`}
                    variant="box"
                    tone={r.secret ? 'gold' : undefined}
                    defaultOpen={g.id === 'core' || !!query}
                    title={
                      <span class="rule__title">
                        {r.secret && shielded() ? 'DM secret' : r.title}
                        {!(r.secret && shielded()) && (
                          <span class="rule__sum">
                            <Rich text={r.summary} />
                          </span>
                        )}
                      </span>
                    }
                    right={
                      ui.edit ? (
                        <button type="button" class="btn btn--xs btn--ghost btn--icon" onClick={() => openDrawer('rule', r.id, 'edit')} aria-label={`Edit ${r.title}`} title="Edit this rule">
                          <Icon name="pencil" />
                        </button>
                      ) : undefined
                    }
                  >
                    <RuleBody rule={r} />
                  </Expander>
                ))}
              </section>
            );
          })}
      </div>
    </div>
  );
}
