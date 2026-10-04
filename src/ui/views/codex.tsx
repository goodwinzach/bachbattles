// CODEX: every player, character, item, ability, clue, condition and film as cards.

import { useMemo, useState } from 'preact/hooks';
import type { Ability, Clue, Condition, EntityType, Film, Item, ItemState, NPC, PC, Scene } from '../../data/types';
import { adjustHp, adjustQty, revive, toggleEffect } from '../../state/actions';
import {
  abilitiesOf,
  acCalc,
  backlinks,
  entityText,
  holderName,
  ITEM_KIND_LABEL,
  itemsHeldBy,
  npcStat,
  portraitOf,
  scenesFor,
  shielded,
  SIDE_LABEL,
  sourcesOf,
} from '../../state/derive';
import { signed } from '../../state/dice';
import { all, ent, getDataVersion, getUi, openDrawer, setUi } from '../../state/store';
import {
  ClueControl,
  ConditionControl,
  HolderControl,
  ItemStateControl,
  NpcStatusControl,
  PcStatusControl,
} from '../controls';
import { AbilityCard, DmNote, ItemRow, MaskPicker, StatBlockView, StatGrid } from '../detail';
import { createCustomItem, createCustomNpc } from '../editor';
import { Icon } from '../icons';
import { Face } from '../profile';
import { Badge, Empty, Expander, HpBar, Pips, Stepper, cx } from '../kit';
import { Ref, Rich, RichList } from '../rich';

type Tab = 'party' | 'cast' | 'bestiary' | 'items' | 'abilities' | 'clues' | 'conditions' | 'films';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'party', label: 'Party', icon: 'users' },
  { id: 'cast', label: 'Characters', icon: 'drama' },
  { id: 'bestiary', label: 'Bestiary', icon: 'swords' },
  { id: 'items', label: 'Items', icon: 'package' },
  { id: 'abilities', label: 'Abilities', icon: 'sparkles' },
  { id: 'clues', label: 'Clues', icon: 'lightbulb' },
  { id: 'conditions', label: 'Conditions', icon: 'activity' },
  { id: 'films', label: 'Films', icon: 'film' },
];

function matches(q: string, ...texts: string[]) {
  if (!q) return true;
  const hay = texts.join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

// ─── cards ────────────────────────────────────────────────────────────────

function PcCard({ pc }: { pc: PC }) {
  const abs = abilitiesOf(pc.id);
  const items = itemsHeldBy(pc.id);
  const bagels = ent<Item>('item', 'bagels');
  const conds = all<Condition>('condition').filter((c) => c.scope === 'pc');
  return (
    <article class={cx('card card--pc hue', `card--${pc.status}`)} style={{ '--c': `var(--c-${pc.hue})` } as never}>
      <header class="card__head">
        <button type="button" class="facebtn" onClick={() => openDrawer('pc', pc.id)} aria-label={`${pc.name}: profile`}>
          <Face type="pc" id={pc.id} size={64} />
        </button>
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('pc', pc.id)}>
            {pc.name}
          </button>
          <div class="card__sub">
            {pc.title} · {pc.player}
          </div>
        </div>
        <PcStatusControl pc={pc} />
      </header>
      <Rich text={pc.tagline} class="card__lead" />
      <div class="card__vitals">
        <HpBar hp={pc.hp} max={pc.hpMax} ghost={pc.status === 'ghost'} />
        <span class="num card__hp">
          {pc.hp}/{pc.hpMax}
        </span>
        <Stepper value={pc.hp} label={`${pc.name} HP`} onDelta={(d) => adjustHp(pc.id, d)} steps={[1, 5]} render={() => 'HP'} />
        <span class="card__ac num" title="Armor Class">
          <Icon name="shield" size={13} /> {acCalc(pc).total}
        </span>
      </div>
      <StatGrid pc={pc} />
      {pc.id === 'flynn' && <MaskPicker pc={pc} />}
      {pc.status === 'ghost' && bagels && (bagels.qty ?? 0) > 0 && bagels.state === 'held' && (
        <button type="button" class="btn btn--sm btn--good" onClick={() => revive(pc.id, true)}>
          <Icon name="bagel" /> Revive with a bagel
        </button>
      )}
      <Expander id={`codex:${pc.id}:abs`} title="Abilities" icon="sparkles" count={abs.length} variant="plain" defaultOpen>
        <div class="stack" style={{ '--gap': '6px' } as never}>
          {abs.map((a) => (
            <AbilityCard key={a.id} ab={a} compact />
          ))}
        </div>
      </Expander>
      <Expander id={`codex:${pc.id}:fx`} title="Effects" icon="activity" count={pc.effects.length || undefined} variant="plain">
        <div class="chips">
          {conds.map((c) => {
            const on = pc.effects.includes(c.id);
            return (
              <button key={c.id} type="button" class={cx('toggle-chip', on && 'is-on')} aria-pressed={on} onClick={() => toggleEffect(pc.id, c.id)} title={c.summary}>
                <Icon name={c.icon} size={13} />
                {c.name}
              </button>
            );
          })}
        </div>
      </Expander>
      <Expander id={`codex:${pc.id}:inv`} title="Carrying" icon="package" count={items.length} variant="plain">
        {items.length ? (
          <div class="stack" style={{ '--gap': '6px' } as never}>
            {items.map((i) => (
              <ItemRow key={i.id} item={i} showHolder={false} />
            ))}
          </div>
        ) : (
          <span class="muted">Nothing yet.</span>
        )}
      </Expander>
      <DmNote text={pc.dmNote} />
    </article>
  );
}

function NpcCard({ npc, bestiary }: { npc: NPC; bestiary?: boolean }) {
  const stat = npcStat(npc);
  const scenes = scenesFor('npc', npc.id);
  const film = sourcesOf('npc', npc.id, true)[0];
  return (
    <article class={cx('card card--npc', `card--side-${npc.side}`, ['defeated', 'dead', 'fled'].includes(npc.status) && 'is-done')}>
      <header class="card__head">
        <button type="button" class="facebtn" onClick={() => openDrawer('npc', npc.id)} aria-label={`${npc.name}: profile`}>
          <Face type="npc" id={npc.id} size={52} />
        </button>
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('npc', npc.id)}>
            {npc.name}
          </button>
          <div class="card__sub">
            {SIDE_LABEL[npc.side]}
            {film && <> · {film.title}</>}
            {npc.aka && <> · {npc.aka}</>}
          </div>
        </div>
        <NpcStatusControl npc={npc} />
      </header>
      <Rich text={npc.role} class="card__lead" />
      {scenes.length > 0 && (
        <div class="card__scenes">
          {scenes.map((s) => (
            <button key={s.id} type="button" class="slatechip" onClick={() => openDrawer('scene', s.id)} title={s.title}>
              {s.slate}
            </button>
          ))}
        </div>
      )}
      {bestiary && stat ? (
        <StatBlockView npc={npc} />
      ) : stat ? (
        <div class="card__statline num">
          <Icon name="shield" size={12} /> {stat.invincible ? '∞' : stat.ac} · <Icon name="heart-pulse" size={12} />{' '}
          {stat.invincible ? '∞' : `${npc.hp ?? stat.hp}/${stat.hp}`}
          {stat.attacks[0]?.bonus != null && (
            <span>
              {' '}
              · {stat.attacks[0].name} {signed(stat.attacks[0].bonus!)} {stat.attacks[0].dmg}
            </span>
          )}
        </div>
      ) : null}
      {(npc.personality || npc.play || npc.lines?.length) && !bestiary ? (
        <Expander id={`codex:${npc.id}:more`} title="Play them" icon="drama" variant="plain">
          <div class="stack" style={{ '--gap': '8px' } as never}>
            {npc.personality && <Rich text={npc.personality} class="card__text" />}
            {npc.play && <Rich text={npc.play} class="card__text" />}
            {npc.lines?.length ? (
              <ul class="lines">
                {npc.lines.slice(0, 3).map((l, i) => (
                  <li key={i} class="line">
                    <Icon name="quote" size={14} />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Expander>
      ) : null}
      <DmNote text={npc.dmNote} />
    </article>
  );
}

function ItemCard({ item }: { item: Item }) {
  const hidden = item.secret && !item.revealed && shielded();
  const users = all<Ability>('ability').filter((a) => a.requires === item.id);
  return (
    <article class={cx('card card--item', `card--state-${item.state}`)}>
      <header class="card__head">
        {!hidden && portraitOf('item', item.id) ? (
          <Face type="item" id={item.id} size={44} />
        ) : (
          <span class="card__icon">
            <Icon name={hidden ? 'lock' : item.icon} size={20} />
          </span>
        )}
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('item', item.id)}>
            {hidden ? item.alias ?? 'Secret item' : item.name}
          </button>
          <div class="card__sub">
            {ITEM_KIND_LABEL[item.kind]}
            {item.dmg && <span class="num"> · {item.dmg}</span>}
            {item.range && item.kind === 'weapon' && <> · {item.range}</>}
            {item.acBonus ? <> · +{item.acBonus} AC</> : null}
          </div>
        </div>
        <ItemStateControl item={item} />
      </header>
      <div class="card__holder">
        <Icon name="user" size={13} />
        {getUi().edit ? <HolderControl item={item} /> : <span class="grow">{item.holder ? holderName(item.holder) : 'Nobody'}</span>}
      </div>
      {!hidden && <Rich text={item.effect} class="card__lead" />}
      {(item.qty != null || item.ammoMax != null) && (
        <div class="row">
          {item.qty != null && <Stepper value={item.qty} label={`${item.name} count`} onDelta={(d) => adjustQty(item.id, d)} steps={item.id === 'gold' ? [1, 50] : [1]} />}
          {item.ammoMax != null && (
            <span class="row" style={{ gap: '6px' }}>
              <Pips max={item.ammoMax} used={item.ammoMax - (item.ammo ?? 0)} label="shot" onUse={() => adjustQty(item.id, -1, 'ammo')} onRestore={() => adjustQty(item.id, 1, 'ammo')} />
              <span class="muted num">
                {item.ammo}/{item.ammoMax} shots
              </span>
            </span>
          )}
        </div>
      )}
      {users.length > 0 && !hidden && (
        <div class="chips">
          {users.map((a) => (
            <Ref key={a.id} type="ability" id={a.id} chip />
          ))}
        </div>
      )}
      {!hidden && item.notes?.length ? (
        <Expander id={`codex:${item.id}:notes`} title="Notes" icon="sticky-note" count={item.notes.length} variant="plain">
          <RichList items={item.notes} />
        </Expander>
      ) : null}
      <DmNote text={item.dmNote} />
    </article>
  );
}

function ClueCard({ clue }: { clue: Clue }) {
  const hidden = clue.secret && !clue.revealed && shielded();
  return (
    <article class={cx('card card--clue', clue.revealed && 'is-on')}>
      <header class="card__head">
        <span class="card__icon">
          <Icon name={clue.revealed ? 'lightbulb' : 'eye-off'} size={20} />
        </span>
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('clue', clue.id)}>
            {clue.name}
          </button>
          <div class="card__sub">
            {clue.group === 'costello' ? "Costello's answers" : 'Story clue'} · <Ref type="scene" id={clue.source} noDot />
          </div>
        </div>
        <ClueControl clue={clue} force />
      </header>
      {hidden ? <div class="muted">Hidden by the spoiler shield.</div> : <Rich text={clue.text} class="card__lead" />}
    </article>
  );
}

function ConditionCard({ cond }: { cond: Condition }) {
  const pcs = all<PC>('pc');
  return (
    <article class={cx('card card--cond', cond.active && 'is-on')}>
      <header class="card__head">
        <span class="card__icon">
          <Icon name={cond.icon} size={20} />
        </span>
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('condition', cond.id)}>
            {cond.name}
          </button>
          <div class="card__sub">{cond.scope === 'party' ? 'Whole party' : 'Per player'}</div>
        </div>
        {cond.scope === 'party' && <ConditionControl cond={cond} force />}
      </header>
      <Rich text={cond.summary} class="card__lead" />
      {cond.mods && (
        <div class="row">
          {Object.entries(cond.mods).map(([s, v]) => (
            <Badge key={s} tone={(v ?? 0) < 0 ? 'bad' : 'good'} dot={false}>
              {s.toUpperCase()} {signed(v ?? 0)}
            </Badge>
          ))}
        </div>
      )}
      {cond.scope === 'pc' && (
        <div class="chips">
          {pcs.map((p) => {
            const on = p.effects.includes(cond.id);
            return (
              <button key={p.id} type="button" class={cx('toggle-chip', on && 'is-on')} aria-pressed={on} onClick={() => toggleEffect(p.id, cond.id)}>
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function FilmCard({ film }: { film: Film }) {
  const hits = backlinks('film', film.id);
  return (
    <article class={cx('card card--film', !hits.length && 'is-unused')}>
      <header class="card__head">
        <span class="card__icon">
          <Icon name="film" size={20} />
        </span>
        <div class="card__titles">
          <button type="button" class="card__name" onClick={() => openDrawer('film', film.id)}>
            {film.title}
          </button>
          <div class="card__sub">{film.favorite ? "Flynn's favorite" : 'Also referenced'}</div>
        </div>
        {film.favorite && (
          <Badge tone="gold" dot={false}>
            <Icon name="star" size={11} /> Fav
          </Badge>
        )}
      </header>
      {film.note && <Rich text={film.note} class="card__lead" />}
      {hits.length ? (
        <div class="chips">
          {hits.slice(0, 8).map((h) => (
            <Ref key={`${h.type}:${h.id}`} type={h.type} id={h.id} chip />
          ))}
        </div>
      ) : (
        <div class="muted card__text">Not used yet: free for an improvised cameo.</div>
      )}
    </article>
  );
}

// ─── view ─────────────────────────────────────────────────────────────────

const ITEM_FILTERS: { id: string; label: string; states?: ItemState[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'party', label: 'With the party', states: ['held', 'equipped'] },
  { id: 'enemy', label: 'Enemy has it', states: ['enemy'] },
  { id: 'missing', label: 'Missing or lost', states: ['missing', 'lost'] },
  { id: 'unclaimed', label: 'Unclaimed', states: ['unclaimed'] },
  { id: 'gone', label: 'Used or destroyed', states: ['spent', 'destroyed'] },
];

export function CodexView() {
  const ui = getUi();
  const tab = (TABS.some((t) => t.id === ui.codexTab) ? ui.codexTab : 'party') as Tab;
  const [q, setQ] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [group, setGroup] = useState<'holder' | 'kind' | 'none'>('holder');
  const [side, setSide] = useState('all');
  const v = getDataVersion();

  const counts = useMemo(
    () => ({
      party: all('pc').length,
      cast: all('npc').length,
      bestiary: all<NPC>('npc').filter((n) => n.stat && (n.side === 'foe' || n.side === 'boss')).length,
      items: all('item').length,
      abilities: all('ability').length,
      clues: all('clue').length,
      conditions: all('condition').length,
      films: all('film').length,
    }),
    [v],
  );

  const search = (type: EntityType, e: { id: string }) => matches(q, entityText(e as never), type);

  let body;
  if (tab === 'party') {
    const pcs = all<PC>('pc').filter((p) => search('pc', p));
    body = (
      <div class="cgrid cgrid--wide">
        {pcs.map((p) => (
          <PcCard key={p.id} pc={p} />
        ))}
      </div>
    );
  } else if (tab === 'cast' || tab === 'bestiary') {
    const order = all<Scene>('scene');
    const firstScene = (n: NPC) => {
      const i = order.findIndex((s) => (s.cast ?? []).includes(n.id) || (s.encounters ?? []).some((e) => e.foes.includes(n.id)));
      return i < 0 ? 999 : i;
    };
    let npcs = all<NPC>('npc').filter((n) => search('npc', n));
    if (tab === 'bestiary') npcs = npcs.filter((n) => n.stat && (n.side === 'foe' || n.side === 'boss'));
    if (tab === 'cast' && side !== 'all') npcs = npcs.filter((n) => (side === 'foes' ? n.side === 'foe' || n.side === 'boss' : n.side === side));
    npcs = [...npcs].sort((a, b) => firstScene(a) - firstScene(b));
    body = npcs.length ? (
      <div class={cx('cgrid', tab === 'bestiary' && 'cgrid--wide')}>
        {npcs.map((n) => (
          <NpcCard key={n.id} npc={n} bestiary={tab === 'bestiary'} />
        ))}
      </div>
    ) : (
      <Empty icon="drama" title="No characters match." />
    );
  } else if (tab === 'items') {
    const f = ITEM_FILTERS.find((x) => x.id === itemFilter)!;
    const items = all<Item>('item').filter((i) => search('item', i) && (!f.states || f.states.includes(i.state)));
    const groups = new Map<string, Item[]>();
    for (const i of items) {
      const k = group === 'holder' ? holderName(i.holder) : group === 'kind' ? ITEM_KIND_LABEL[i.kind] : 'All items';
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    const order = (k: string) => (k === 'The party' ? 0 : all<PC>('pc').some((p) => p.name === k) ? 1 : k === 'Nobody' ? 3 : 2);
    const keys = [...groups.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    body = items.length ? (
      <div class="cgroups">
        {keys.map((k) => (
          <section key={k} class="cgroup">
            {group !== 'none' && (
              <h2 class="cgroup__h">
                {k} <span class="muted num">{groups.get(k)!.length}</span>
              </h2>
            )}
            <div class="cgrid">
              {groups.get(k)!.map((i) => (
                <ItemCard key={i.id} item={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    ) : (
      <Empty icon="package" title="No items match." />
    );
  } else if (tab === 'abilities') {
    const pcs = all<PC>('pc');
    body = (
      <div class="cgroups">
        {pcs.map((p) => {
          const abs = all<Ability>('ability').filter((a) => a.owner === p.id && search('ability', a));
          if (!abs.length) return null;
          return (
            <section key={p.id} class="cgroup">
              <h2 class="cgroup__h">
                <Face type="pc" id={p.id} size={28} /> <Ref type="pc" id={p.id} noDot />
              </h2>
              <div class="cgrid">
                {abs.map((a) => {
                  const hidden = a.secret && !a.revealed && shielded();
                  const where = hidden ? [] : scenesFor('ability', a.id);
                  return (
                    <article key={a.id} class="card card--ability">
                      <AbilityCard ab={a} />
                      {!hidden && (a.requires || where.length > 0) && (
                        <div class="card__foot">
                          {a.requires && (
                            <span>
                              Needs <Ref type="item" id={a.requires} />
                            </span>
                          )}
                          {where.length > 0 && (
                            <span class="card__scenes">
                              {where.map((s) => (
                                <button key={s.id} type="button" class="slatechip" onClick={() => openDrawer('scene', s.id)} title={s.title}>
                                  {s.slate}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  } else if (tab === 'clues') {
    const clues = all<Clue>('clue').filter((c) => search('clue', c));
    body = (
      <div class="cgrid">
        {clues.map((c) => (
          <ClueCard key={c.id} clue={c} />
        ))}
      </div>
    );
  } else if (tab === 'conditions') {
    body = (
      <div class="cgrid">
        {all<Condition>('condition')
          .filter((c) => search('condition', c))
          .map((c) => (
            <ConditionCard key={c.id} cond={c} />
          ))}
      </div>
    );
  } else {
    const films = all<Film>('film').filter((f) => search('film', f));
    body = (
      <div class="cgrid">
        {films.map((f) => (
          <FilmCard key={f.id} film={f} />
        ))}
      </div>
    );
  }

  return (
    <div class="view codex">
      <div class="codex__bar">
        <div class="seg codex__tabs" role="tablist" aria-label="Codex sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setUi({ codexTab: t.id })}>
              <Icon name={t.icon} /> {t.label} <span class="seg__count num">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="codex__tools">
        <label class="searchfield codex__search">
          <Icon name="search" size={16} />
          <input class="input" placeholder={`Search ${TABS.find((t) => t.id === tab)!.label.toLowerCase()}`} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search the codex" />
        </label>
        {tab === 'items' && (
          <>
            <select class="select codex__select" value={itemFilter} onChange={(e) => setItemFilter((e.target as HTMLSelectElement).value)} aria-label="Filter items by state">
              {ITEM_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <div class="seg seg--sm" role="group" aria-label="Group items">
              {(['holder', 'kind', 'none'] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {g === 'holder' ? 'By owner' : g === 'kind' ? 'By kind' : 'No groups'}
                </button>
              ))}
            </div>
          </>
        )}
        {tab === 'cast' && (
          <select class="select codex__select" value={side} onChange={(e) => setSide((e.target as HTMLSelectElement).value)} aria-label="Filter characters">
            <option value="all">Everyone</option>
            <option value="ally">Allies</option>
            <option value="neutral">Neutral</option>
            <option value="foes">Foes and bosses</option>
            <option value="oracle">Oracles</option>
          </select>
        )}
        <span class="spacer" />
        {tab === 'items' && (
          <button
            type="button"
            class="btn btn--sm"
            onClick={() => {
              const id = createCustomItem();
              openDrawer('item', id, 'edit');
            }}
          >
            <Icon name="plus" /> New item
          </button>
        )}
        {tab === 'cast' && (
          <button
            type="button"
            class="btn btn--sm"
            onClick={() => {
              const id = createCustomNpc();
              openDrawer('npc', id, 'edit');
            }}
          >
            <Icon name="plus" /> New character
          </button>
        )}
      </div>
      {body}
    </div>
  );
}
