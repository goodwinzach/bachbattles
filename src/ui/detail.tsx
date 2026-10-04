// Entity detail panels: used in the side drawer, hover cards and codex.

import type { JSX } from 'preact';
import type { Ability, Act, Clue, Condition, EntityType, Film, Hue, Item, Location, NPC, PC, Rule, Scene } from '../data/types';
import { STAT_ABBR, STAT_NAME, STATS } from '../data/types';
import {
  adjustNpcHp,
  adjustQty,
  goScene,
  rollAttack,
  rollFor,
  rollSpiritual,
  setMask,
  setNpcPhase,
  toggleEffect,
  useAbility,
} from '../state/actions';
import {
  abilityStatus,
  allStats,
  backlinks,
  holderHidden,
  holderName,
  itemHolderName,
  holderType,
  isUnmasked,
  ITEM_KIND_LABEL,
  KIND_LABEL,
  npcMaxHp,
  npcStat,
  RECHARGE_LABEL,
  portraitOf,
  relationsOf,
  sceneMust,
  sourcesOf,
  shielded,
} from '../state/derive';
import { signed } from '../state/dice';
import { all, closeDrawer, ent, game, getUi, go, openDrawer, setUi } from '../state/store';
import {
  AbilityStateControl,
  ClueControl,
  ConditionControl,
  HolderControl,
  ItemStateControl,
  NpcStatusControl,
  PcStatusControl,
  SceneStatusControl,
} from './controls';
import { Icon } from './icons';
import { LocationDetail } from './location';
import { Face, NpcProfile, PcProfile } from './profile';
import { Avatar, Badge, Expander, HpBar, Label, Pips, Stepper, cx, hueVar } from './kit';
import { Ref, Rich, RichList, RichParas, iconOf } from './rich';

// ─── shared bits ──────────────────────────────────────────────────────────

export function Secret({ children, label = 'DM secret' }: { children: JSX.Element | JSX.Element[] | string; label?: string }) {
  const hidden = shielded();
  return (
    <div class={cx('secret', hidden && 'secret--hidden')}>
      <div class="secret__label">
        <Icon name={hidden ? 'eye-off' : 'lock'} size={13} />
        {label}
        {hidden && <span class="secret__hint">Spoiler shield is on</span>}
      </div>
      <div class="secret__body" aria-hidden={hidden}>
        {children}
      </div>
    </div>
  );
}

export function DmNote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div class="dmnote">
      <Icon name="notebook-pen" size={14} />
      <div>{text}</div>
    </div>
  );
}

export function StatGrid({ pc, compact }: { pc: PC; compact?: boolean }) {
  const stats = allStats(pc);
  return (
    <div class={cx('statgrid', compact && 'statgrid--compact')}>
      {STATS.map((s) => {
        const c = stats[s];
        const delta = c.total - c.base;
        const ghostBlocked = pc.status === 'ghost' && (s === 'str' || s === 'agi');
        const title = [
          `${STAT_NAME[s]}: ${signed(c.total)}`,
          `Base ${signed(c.base)}`,
          ...c.parts.map((p) => `${p.label} ${signed(p.value)}`),
          c.override ?? '',
          ghostBlocked ? 'Ghosts cannot make Strength or Agility rolls' : '',
          'Click to roll',
        ]
          .filter(Boolean)
          .join('\n');
        return (
          <button
            key={s}
            type="button"
            class={cx('stat', delta < 0 && 'stat--down', delta > 0 && 'stat--up', c.override && 'stat--wow', ghostBlocked && 'stat--blocked')}
            title={title}
            onClick={(e) => {
              e.stopPropagation();
              rollFor(pc.id, s);
            }}
          >
            <span class="stat__abbr">{STAT_ABBR[s]}</span>
            <span class="stat__val num">{signed(c.total)}</span>
            {!compact && delta !== 0 && !c.override && (
              <span class="stat__delta num">
                <Icon name={delta < 0 ? 'chevron-down' : 'chevron-up'} size={11} />
                {Math.abs(delta)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MaskPicker({ pc }: { pc: PC }) {
  if (pc.id !== 'flynn') return null;
  const masks = all<Item>('item').filter((i) => i.kind === 'mask');
  return (
    <div class="maskpick" role="group" aria-label="Flynn's mask">
      {masks.map((m) => {
        const usable = (m.state === 'held' || m.state === 'equipped') && m.holder === 'flynn';
        const on = pc.mask === m.id;
        const hidden = m.secret && !m.revealed && shielded();
        if (m.id === 'v-mask' && !usable) return null;
        return (
          <button
            key={m.id}
            type="button"
            class={cx('maskpick__btn', on && 'is-on')}
            disabled={!usable}
            aria-pressed={on}
            title={usable ? `Wear the ${m.name}` : `${m.name} is not available`}
            onClick={() => setMask(m.id)}
          >
            {!hidden && portraitOf('item', m.id) ? <Face type="item" id={m.id} size={22} /> : <Icon name={hidden ? 'lock' : m.icon} size={15} />}
            <span>{hidden ? 'Mask' : m.name.replace(/ (Mask|Cowl|Face Cover)$/, '')}</span>
          </button>
        );
      })}
      <button type="button" class={cx('maskpick__btn maskpick__btn--none', isUnmasked(pc) && 'is-on')} aria-pressed={isUnmasked(pc)} onClick={() => setMask('none')} title="Take the mask off">
        <Icon name="scan-face" size={15} />
        <span>No mask</span>
      </button>
    </div>
  );
}

export function AbilityCard({ ab, live = true, compact }: { ab: Ability; live?: boolean; compact?: boolean }) {
  const st = abilityStatus(ab);
  const hidden = st.secret && shielded();
  if (hidden) {
    return (
      <div class="abil abil--secret">
        <Icon name="lock" size={14} />
        <span>A secret ability (spoiler shield is on)</span>
      </div>
    );
  }
  return (
    <div class={cx('abil', `abil--${st.status}`)}>
      <div class="abil__top">
        <span class="abil__icon">
          <Icon name={ab.icon} size={15} />
        </span>
        <div class="abil__id">
          <button type="button" class="abil__name" onClick={() => openDrawer('ability', ab.id)}>
            {ab.name}
            {ab.secret && (
              <span class="abil__secret" title={ab.revealed ? 'Secret, revealed to the table' : 'Secret: players do not know yet'}>
                <Icon name={ab.revealed ? 'eye' : 'lock'} size={11} />
              </span>
            )}
          </button>
          <span class="abil__meta">{ab.max ? `${ab.max} ${RECHARGE_LABEL[ab.recharge]}` : RECHARGE_LABEL[ab.recharge]}</span>
        </div>
        <div class="abil__ctl">
          {ab.max ? (
            <Pips
              max={ab.max}
              used={ab.used}
              label={ab.name}
              disabled={!live || !ab.enabled}
              onUse={() => useAbility(ab.id, 1)}
              onRestore={() => useAbility(ab.id, -1)}
            />
          ) : null}
          <AbilityStateControl ab={ab} size="sm" />
        </div>
      </div>
      {!compact && <Rich text={ab.summary} class="abil__sum" />}
      {!compact && st.why && st.status === 'locked' && <div class="abil__why">{st.why}</div>}
    </div>
  );
}

export function ItemRow({ item, showHolder = true }: { item: Item; showHolder?: boolean }) {
  return (
    <div class="itemrow">
      <span class="itemrow__icon">
        <Icon name={item.secret && !item.revealed && shielded() ? 'lock' : item.icon} size={15} />
      </span>
      <div class="itemrow__main">
        <Ref type="item" id={item.id} noDot />
        <div class="itemrow__meta">
          {ITEM_KIND_LABEL[item.kind]}
          {item.dmg && <span class="num"> · {item.dmg}</span>}
          {item.range && item.kind === 'weapon' && <span> · {item.range}</span>}
          {item.acBonus ? <span> · +{item.acBonus} AC</span> : null}
          {showHolder && item.holder && <span> · {itemHolderName(item)}</span>}
        </div>
      </div>
      {item.qty != null && (
        <Stepper value={item.qty} label={`${item.name} count`} onDelta={(d) => adjustQty(item.id, d)} steps={item.id === 'gold' ? [1, 50] : [1]} />
      )}
      {item.ammoMax != null && (
        <span class="ammo" title="Shots left">
          <Pips max={item.ammoMax} used={item.ammoMax - (item.ammo ?? 0)} label="shot" onUse={() => adjustQty(item.id, -1, 'ammo')} onRestore={() => adjustQty(item.id, 1, 'ammo')} />
        </span>
      )}
      <ItemStateControl item={item} size="sm" />
    </div>
  );
}

export function StatBlockView({ npc, live = true }: { npc: NPC; live?: boolean }) {
  const stat = npcStat(npc);
  if (!stat) return null;
  const max = npcMaxHp(npc);
  const hp = npc.hp ?? max;
  return (
    <div class="statblock">
      <div class="statblock__head">
        <div class="statblock__ac" title="Armor Class">
          <Icon name="shield" size={14} />
          <span class="num">{stat.invincible ? '∞' : stat.ac ?? '—'}</span>
          <span class="statblock__k">AC</span>
        </div>
        <div class="statblock__hp">
          {stat.invincible ? (
            <span class="statblock__inv">
              <Icon name="sparkles" size={14} /> Invincible. No HP.
            </span>
          ) : max != null ? (
            <>
              <div class="row row--nowrap" style={{ gap: '8px' }}>
                <span class="statblock__k">HP</span>
                <HpBar hp={hp ?? 0} max={max} />
                <span class="num statblock__hpnum">
                  {hp}/{max}
                </span>
              </div>
              {live && <Stepper value={hp ?? 0} label={`${npc.name} HP`} onDelta={(d) => adjustNpcHp(npc.id, d)} steps={[1, 5]} render={() => 'HP'} />}
            </>
          ) : null}
        </div>
      </div>
      {npc.phases && (
        <div class="seg" role="group" aria-label="Stat phase">
          {npc.phases.map((p, i) => (
            <button key={i} type="button" aria-pressed={npc.phase === i} onClick={() => setNpcPhase(npc.id, i)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <ul class="attacks">
        {stat.attacks.map((a, i) => (
          <li key={i} class="attack">
            <div class="attack__main">
              <span class="attack__name">{a.name}</span>
              <span class="attack__nums num">
                {a.bonus != null && <span>{signed(a.bonus)} to hit</span>}
                {a.dmg && <span>{a.dmg}</span>}
                {a.range && <span>{a.range}</span>}
              </span>
              {a.note && <Rich text={a.note} class="attack__note" />}
            </div>
            {live && a.bonus != null && (
              <button type="button" class="btn btn--sm" onClick={() => rollAttack(npc.id, i)} title={`Roll ${a.name}`}>
                <Icon name="dices" /> Roll
              </button>
            )}
          </li>
        ))}
      </ul>
      {stat.specials?.length ? (
        <ul class="specials">
          {stat.specials.map((sp, i) => (
            <li key={i}>
              <span class="special__name">
                {sp.name}
                {sp.uses && <span class="special__uses">{sp.uses}</span>}
              </span>
              <Rich text={sp.text} />
            </li>
          ))}
        </ul>
      ) : null}
      {stat.behavior && (
        <div class="statblock__behavior">
          <Icon name="target" size={13} />
          <Rich text={stat.behavior} />
        </div>
      )}
    </div>
  );
}

function Head({ icon, hue, title, sub, right, ring, face }: { icon: string; hue?: Hue; title: string; sub?: JSX.Element | string; right?: JSX.Element | null; ring?: any; face?: { type: EntityType; id: string } }) {
  return (
    <div class="dhead">
      {face && portraitOf(face.type, face.id) ? <Face type={face.type} id={face.id} size={64} /> : <Avatar icon={icon} hue={hue} size={46} ring={ring} />}
      <div class="dhead__text">
        <h2 class="dhead__title">{title}</h2>
        {sub && <div class="dhead__sub">{sub}</div>}
      </div>
      {right && <div class="dhead__right">{right}</div>}
    </div>
  );
}

export function SceneChips({ scenes }: { scenes: Scene[] }) {
  if (!scenes.length) return <span class="muted">Not in any scene.</span>;
  return (
    <div class="chips">
      {scenes.map((s) => (
        <Ref key={s.id} type="scene" id={s.id} chip />
      ))}
    </div>
  );
}

// ─── per type ─────────────────────────────────────────────────────────────

/** Story relationships (the same links the connections web draws), with a jump to the web. */
export function Connections({ type, id }: { type: 'pc' | 'npc' | 'item'; id: string }) {
  const rels = relationsOf(type, id);
  if (!rels.length) return null;
  const showOnWeb = () => {
    const ui = getUi();
    const webFilter = ui.webFilter.includes(type) ? ui.webFilter : [...ui.webFilter, type];
    closeDrawer();
    setUi({ view: 'map', mapMode: 'web', webFilter, webFocus: `${type}:${id}` });
  };
  return (
    <Expander
      id={`${type}:${id}:rels`}
      title="Connections"
      icon="waypoints"
      count={rels.length}
      variant="box"
      defaultOpen
      right={
        <button type="button" class="btn btn--xs btn--ghost" onClick={showOnWeb} title="Open the connections web with this selected">
          <Icon name="chart-network" /> On the web
        </button>
      }
    >
      <ul class="rels">
        {rels.map((r, i) => (
          <li key={i} class={cx('rels__row', r.secret && 'rels__row--secret')}>
            <Icon name={r.dir === 'out' ? 'arrow-right' : 'arrow-left'} size={14} class="rels__dir" />
            <Ref type={r.type} id={r.id} chip />
            <span class="rels__label">{r.label}</span>
            {r.secret && (
              <span class="rels__secret" title="DM secret: hidden by the spoiler shield">
                <Icon name="lock" size={12} /> secret
              </span>
            )}
          </li>
        ))}
      </ul>
    </Expander>
  );
}

export function ItemDetail({ item }: { item: Item }) {
  const hidden = item.secret && !item.revealed && shielded();
  const users = all<Ability>('ability').filter((a) => a.requires === item.id);
  const source = item.source ? ent<Scene>('scene', item.source) : undefined;
  const ht = holderType(item.holder);
  return (
    <div class="detail stack" style={{ '--gap': '18px' } as never}>
      <Head
        icon={hidden ? 'lock' : item.icon}
        face={{ type: 'item', id: item.id }}
        title={hidden ? item.alias ?? 'Secret item' : item.name}
        sub={
          <>
            {ITEM_KIND_LABEL[item.kind]}
            {item.tier && <span> · {item.tier}</span>}
            {item.secret && !hidden && <span> · secret{item.alias ? ` (players know it as "${item.alias}")` : ''}</span>}
          </>
        }
        right={<ItemStateControl item={item} />}
      />
      <div class="kv">
        <div class="kv__row">
          <span class="kv__k">Who has it</span>
          <span class="kv__v">
            {item.holder ? holderHidden(item) ? 'Missing' : ht ? <Ref type={ht} id={item.holder} /> : holderName(item.holder) : 'Nobody'}
            <HolderControl item={item} />
          </span>
        </div>
        {item.dmg && (
          <div class="kv__row">
            <span class="kv__k">Damage</span>
            <span class="kv__v num">
              <Rich text={`{{${item.dmg}}}`} /> {item.range && <span class="muted">· {item.range}</span>}
            </span>
          </div>
        )}
        {item.acBonus ? (
          <div class="kv__row">
            <span class="kv__k">Armor</span>
            <span class="kv__v">+{item.acBonus} AC while held</span>
          </div>
        ) : null}
        {item.qty != null && (
          <div class="kv__row">
            <span class="kv__k">{item.id === 'gold' ? 'Gold' : 'Count'}</span>
            <span class="kv__v">
              <Stepper value={item.qty} label="Count" onDelta={(d) => adjustQty(item.id, d)} steps={item.id === 'gold' ? [1, 10, 50] : [1]} />
            </span>
          </div>
        )}
        {item.ammoMax != null && (
          <div class="kv__row">
            <span class="kv__k">Shots</span>
            <span class="kv__v">
              <Pips max={item.ammoMax} used={item.ammoMax - (item.ammo ?? 0)} label="shot" onUse={() => adjustQty(item.id, -1, 'ammo')} onRestore={() => adjustQty(item.id, 1, 'ammo')} />
              <span class="num muted">
                {item.ammo}/{item.ammoMax}
              </span>
            </span>
          </div>
        )}
        {source && (
          <div class="kv__row">
            <span class="kv__k">Found in</span>
            <span class="kv__v">
              <Ref type="scene" id={source.id} />
            </span>
          </div>
        )}
      </div>
      {hidden ? (
        <Secret>
          <span />
        </Secret>
      ) : (
        <div class="prose">
          <Rich text={item.effect} />
        </div>
      )}
      {!hidden && item.notes?.length ? <RichList items={item.notes} /> : null}
      {users.length > 0 && (
        <div>
          <Label icon="sparkles">Grants</Label>
          <div class="stack" style={{ '--gap': '8px' } as never}>
            {users.map((a) => (
              <AbilityCard key={a.id} ab={a} />
            ))}
          </div>
        </div>
      )}
      <Connections type="item" id={item.id} />
      <DmNote text={item.dmNote} />
    </div>
  );
}

export function AbilityDetail({ ab }: { ab: Ability }) {
  const owner = ent<PC>('pc', ab.owner);
  const st = abilityStatus(ab);
  const hidden = st.secret && shielded();
  return (
    <div class="detail stack" style={{ '--gap': '18px' } as never}>
      <Head
        icon={hidden ? 'lock' : ab.icon}
        hue={owner?.hue}
        title={hidden ? 'Secret ability' : ab.name}
        sub={
          <>
            {owner && <Ref type="pc" id={owner.id} />} · {ab.max ? `${ab.max} ${RECHARGE_LABEL[ab.recharge]}` : RECHARGE_LABEL[ab.recharge]}
            {ab.secret && <span> · {ab.revealed ? 'secret, revealed' : 'secret'}</span>}
          </>
        }
        right={<AbilityStateControl ab={ab} />}
      />
      {hidden ? (
        <Secret>
          <span />
        </Secret>
      ) : (
        <>
          {ab.max ? (
            <div class="uses">
              <Pips max={ab.max} used={ab.used} label={ab.name} disabled={!ab.enabled} onUse={() => useAbility(ab.id, 1)} onRestore={() => useAbility(ab.id, -1)} />
              <span class="num">
                {ab.max - ab.used} of {ab.max} left
              </span>
              <span class="spacer" />
              <button type="button" class="btn btn--sm" disabled={ab.used >= ab.max || !ab.enabled} onClick={() => useAbility(ab.id, 1)}>
                Use one
              </button>
              <button type="button" class="btn btn--sm btn--ghost" disabled={ab.used === 0} onClick={() => useAbility(ab.id, -1)}>
                Restore
              </button>
            </div>
          ) : null}
          {st.why && <div class="abil__why">{st.why}</div>}
          <div class="prose dlead">
            <Rich text={ab.summary} />
          </div>
          {ab.requires && (
            <div class="kv__row">
              <span class="kv__k">Requires</span>
              <Ref type="item" id={ab.requires} />
            </div>
          )}
          {ab.mechanics?.length ? (
            <Expander id={`ab:${ab.id}:mech`} title="How it works" icon="list-checks" defaultOpen variant="box">
              <RichList items={ab.mechanics} />
            </Expander>
          ) : null}
          {ab.table?.length ? (
            <div class="omen">
              <div class="row" style={{ justifyContent: 'space-between' }}>
                <Label icon="dices">Roll a d20, no modifier</Label>
                {ab.id === 'spiritual-moment' && (
                  <button type="button" class="btn btn--sm btn--primary" onClick={rollSpiritual} disabled={ab.used >= (ab.max ?? 0)}>
                    <Icon name="sparkles" /> Spiritual Moment
                  </button>
                )}
              </div>
              {ab.table.map((row) => (
                <div key={row.range} class={cx('omen__row', `t-${row.tone}`)}>
                  <div class="omen__range num">{row.range}</div>
                  <div class="omen__body">
                    <div class="omen__label">{row.label}</div>
                    <Rich text={row.text} />
                    {row.examples && (
                      <Expander id={`ab:${ab.id}:${row.range}`} title="Examples" variant="plain">
                        <RichList items={row.examples} />
                      </Expander>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {ab.examples?.length ? (
            <Expander id={`ab:${ab.id}:ex`} title="Examples" icon="lightbulb" count={ab.examples.length} variant="box">
              <RichList items={ab.examples} />
            </Expander>
          ) : null}
          {ab.limits?.length ? (
            <div class="callout callout--bad">
              <Icon name="octagon-alert" size={16} />
              <RichList items={ab.limits} />
            </div>
          ) : null}
        </>
      )}
      <DmNote text={ab.dmNote} />
    </div>
  );
}

export function SceneDetail({ scene }: { scene: Scene }) {
  const act = ent<Act>('act', scene.act);
  const isCurrent = game().scene === scene.id;
  return (
    <div class="detail stack" style={{ '--gap': '16px' } as never}>
      <div class="hue" style={{ '--c': hueVar(act?.hue) } as never}>
        <div class="slate-mini">
          <span class="slate-mini__no num">{scene.slate}</span>
          <span class="slate-mini__act">
            {act?.num} · {act?.title}
          </span>
        </div>
      </div>
      <Head icon="clapperboard" hue={act?.hue} title={scene.title} sub={<span class="mono">{scene.slug}</span>} right={<SceneStatusControl scene={scene} />} />
      <div class="row">
        <Badge tone="info" dot={false}>
          {KIND_LABEL[scene.kind]}
        </Badge>
        {scene.minutes && (
          <Badge tone="muted" dot={false}>
            {scene.minutes[0]}–{scene.minutes[1]} min
          </Badge>
        )}
        {scene.optional && (
          <Badge tone="muted" dot={false}>
            Optional
          </Badge>
        )}
        {scene.branch && (
          <Badge tone="warn" dot={false}>
            {scene.branch === 'plane' ? 'Plane route' : 'Boat route'}
          </Badge>
        )}
      </div>
      <Rich text={scene.logline} class="dlead" />
      {sceneMust(scene).length > 0 && (
        <div class="must">
          <div class="must__label">
            <Icon name="flag-triangle-right" size={13} /> Must happen
          </div>
          <RichList items={sceneMust(scene)} />
        </div>
      )}
      <div class="row">
        {!isCurrent && (
          <button type="button" class="btn btn--primary" onClick={() => goScene(scene.id)}>
            <Icon name="play" /> Play this scene
          </button>
        )}
        <button
          type="button"
          class="btn"
          onClick={() => {
            setUi({ view: 'story', drawer: null, focusScene: scene.id });
          }}
        >
          <Icon name="scroll-text" /> Open in the script
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => {
            setUi({ view: 'run', drawer: null });
            if (!isCurrent) goScene(scene.id);
          }}
        >
          <Icon name="clapperboard" /> Run it
        </button>
      </div>
      <DmNote text={scene.dmNote} />
    </div>
  );
}

export function ConditionDetail({ cond }: { cond: Condition }) {
  const affected = cond.scope === 'pc' ? all<PC>('pc').filter((p) => p.effects.includes(cond.id)) : [];
  return (
    <div class="detail stack" style={{ '--gap': '16px' } as never}>
      <Head icon={cond.icon} title={cond.name} sub={cond.scope === 'party' ? 'Affects the whole party' : 'Affects one player at a time'} right={cond.scope === 'party' ? <ConditionControl cond={cond} force /> : null} />
      <Rich text={cond.summary} class="dlead" />
      {cond.mods && (
        <div class="row">
          {Object.entries(cond.mods).map(([s, v]) => (
            <Badge key={s} tone={(v ?? 0) < 0 ? 'bad' : 'good'} dot={false}>
              {STAT_ABBR[s as keyof typeof STAT_ABBR]} {signed(v ?? 0)}
            </Badge>
          ))}
        </div>
      )}
      <div class="kv">
        {cond.starts && (
          <div class="kv__row">
            <span class="kv__k">Starts</span>
            <span class="kv__v">
              <Rich text={cond.starts} />
            </span>
          </div>
        )}
        {cond.ends && (
          <div class="kv__row">
            <span class="kv__k">Ends</span>
            <span class="kv__v">
              <Rich text={cond.ends} />
            </span>
          </div>
        )}
      </div>
      {cond.scope === 'pc' && (
        <div>
          <Label icon="users">Toggle per player</Label>
          <div class="chips">
            {all<PC>('pc').map((p) => {
              const on = p.effects.includes(cond.id);
              return (
                <button key={p.id} type="button" class={cx('toggle-chip', on && 'is-on')} aria-pressed={on} onClick={() => toggleEffect(p.id, cond.id)}>
                  {p.name}
                </button>
              );
            })}
          </div>
          {affected.length === 0 && <div class="muted" style={{ marginTop: '6px' }}>Nobody right now.</div>}
        </div>
      )}
      <DmNote text={cond.dmNote} />
    </div>
  );
}

export function ClueDetail({ clue }: { clue: Clue }) {
  const hidden = clue.secret && !clue.revealed && shielded();
  return (
    <div class="detail stack" style={{ '--gap': '16px' } as never}>
      <Head icon="lightbulb" title={clue.name} sub={clue.group === 'costello' ? "One of Costello's four answers" : 'Story clue'} right={<ClueControl clue={clue} force />} />
      {hidden ? (
        <Secret>
          <span />
        </Secret>
      ) : (
        <div class="prose dlead">
          <Rich text={clue.text} />
        </div>
      )}
      <div class="kv__row">
        <span class="kv__k">Comes from</span>
        <Ref type="scene" id={clue.source} />
      </div>
      <DmNote text={clue.dmNote} />
    </div>
  );
}

export function RuleDetail({ rule }: { rule: Rule }) {
  const body = (
    <div class="stack" style={{ '--gap': '12px' } as never}>
      <div class="prose dlead">
        <Rich text={rule.summary} />
      </div>
      <RichParas paras={rule.body} class="prose" />
      <RichList items={rule.list} />
      {rule.table && <RuleTable table={rule.table} />}
    </div>
  );
  return (
    <div class="detail stack" style={{ '--gap': '16px' } as never}>
      <Head icon={rule.secret ? 'lock' : 'book-open-text'} title={rule.secret && shielded() ? 'DM secret' : rule.title} sub="Rule" />
      {rule.secret ? <Secret>{body}</Secret> : body}
      <DmNote text={rule.dmNote} />
    </div>
  );
}

export function RuleTable({ table }: { table: { head: string[]; rows: string[][] } }) {
  return (
    <div class="tablewrap">
      <table class="table">
        <thead>
          <tr>
            {table.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>
                  <Rich text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilmDetail({ film }: { film: Film }) {
  const hits = backlinks('film', film.id);
  return (
    <div class="detail stack" style={{ '--gap': '16px' } as never}>
      <Head icon="film" title={film.title} sub={film.favorite ? "One of Flynn's favorite movies" : 'Referenced in the campaign'} />
      {film.note && <Rich text={film.note} class="dlead" />}
      <div>
        <Label icon="link">In this campaign</Label>
        {hits.length ? (
          <div class="chips">
            {hits.map((h) => (
              <Ref key={`${h.type}:${h.id}`} type={h.type} id={h.id} chip />
            ))}
          </div>
        ) : (
          <div class="muted">Not used yet. One of Flynn's favorites that is free for an improvised cameo.</div>
        )}
      </div>
    </div>
  );
}

export function ActDetail({ act }: { act: Act }) {
  const scenes = all<Scene>('scene').filter((s) => s.act === act.id);
  return (
    <div class="detail stack hue" style={{ '--gap': '16px', '--c': hueVar(act.hue) } as never}>
      <Head icon="film" hue={act.hue} title={`${act.num}: ${act.title}`} sub={act.tagline} />
      <Rich text={act.summary} class="dlead" />
      <SceneChips scenes={scenes} />
    </div>
  );
}

export function EntityDetail({ type, id }: { type: EntityType; id: string }) {
  const e = ent(type, id);
  if (!e) return <div class="muted">This entry no longer exists.</div>;
  switch (type) {
    case 'pc':
      return <PcProfile pc={e as PC} />;
    case 'npc':
      return <NpcProfile npc={e as NPC} />;
    case 'item':
      return <ItemDetail item={e as Item} />;
    case 'ability':
      return <AbilityDetail ab={e as Ability} />;
    case 'scene':
      return <SceneDetail scene={e as Scene} />;
    case 'condition':
      return <ConditionDetail cond={e as Condition} />;
    case 'clue':
      return <ClueDetail clue={e as Clue} />;
    case 'rule':
      return <RuleDetail rule={e as Rule} />;
    case 'film':
      return <FilmDetail film={e as Film} />;
    case 'act':
      return <ActDetail act={e as Act} />;
    case 'location':
      return <LocationDetail loc={e as Location} />;
  }
}

/** Compact hover card. */
export function PeekCard({ type, id }: { type: EntityType; id: string }) {
  const e = ent(type, id);
  if (!e) return null;
  const any = e as unknown as Record<string, unknown>;
  let body: JSX.Element | null = null;
  if (type === 'pc') {
    const pc = e as PC;
    body = (
      <>
        <div class="row row--nowrap" style={{ gap: '8px' }}>
          <HpBar hp={pc.hp} max={pc.hpMax} ghost={pc.status === 'ghost'} thin />
          <span class="num">{pc.hp}/{pc.hpMax}</span>
        </div>
        <StatGrid pc={pc} compact />
      </>
    );
  } else if (type === 'npc') {
    const n = e as NPC;
    const st = npcStat(n);
    body = (
      <>
        <Rich text={n.role} class="peek__text" />
        {st && (
          <div class="peek__stats num">
            AC {st.invincible ? '∞' : st.ac ?? '—'} · HP {st.invincible ? '∞' : `${n.hp ?? st.hp}/${st.hp}`}
            {st.attacks[0]?.bonus != null && ` · ${st.attacks[0].name} ${signed(st.attacks[0].bonus!)} ${st.attacks[0].dmg ?? ''}`}
          </div>
        )}
      </>
    );
  } else if (type === 'item') {
    const it = e as Item;
    const hidden = it.secret && !it.revealed && shielded();
    body = (
      <>
        {!hidden && <Rich text={it.effect} class="peek__text" />}
        <div class="peek__stats">{itemHolderName(it)}</div>
      </>
    );
  } else if (type === 'ability') {
    const ab = e as Ability;
    const hidden = abilityStatus(ab).secret && shielded();
    body = hidden ? <div class="muted">Secret</div> : <Rich text={ab.summary} class="peek__text" />;
  } else if (type === 'scene') {
    body = <Rich text={(e as Scene).logline} class="peek__text" />;
  } else if (typeof any.summary === 'string' || typeof any.text === 'string') {
    const hidden = (type === 'rule' && (e as Rule).secret && shielded()) || (type === 'clue' && (e as Clue).secret && !(e as Clue).revealed && shielded());
    body = hidden ? <div class="muted">DM secret</div> : <Rich text={(any.summary ?? any.text) as string} class="peek__text" />;
  } else if (type === 'film') {
    const n = backlinks('film', id).length;
    body = <div class="peek__text">{(e as Film).favorite ? "One of Flynn's favorites. " : ''}{n ? `${n} link${n > 1 ? 's' : ''} in the campaign.` : 'Not used yet.'}</div>;
  }
  const statusEl =
    type === 'item' ? <ItemStateControl item={e as Item} size="sm" /> :
    type === 'ability' ? <AbilityStateControl ab={e as Ability} size="sm" /> :
    type === 'pc' ? <PcStatusControl pc={e as PC} size="sm" /> :
    type === 'npc' ? <NpcStatusControl npc={e as NPC} size="sm" /> :
    type === 'clue' ? <ClueControl clue={e as Clue} size="sm" /> :
    type === 'condition' ? <ConditionControl cond={e as Condition} size="sm" /> :
    type === 'scene' ? <SceneStatusControl scene={e as Scene} size="sm" /> : null;
  const face = portraitOf(type, id);
  const film = type === 'npc' || type === 'pc' ? sourcesOf(type, id)[0] : undefined;
  return (
    <div class={cx('peek', face && 'peek--face')}>
      <div class="peek__head">
        {face ? <Face type={type} id={id} size={44} /> : <Icon name={iconOf(type, e)} size={15} />}
        <span class="peek__name">
          {(any.name ?? any.title) as string}
          {face && (type === 'npc' || type === 'pc') && <span class="peek__src">{film ? film.title : 'Original'}</span>}
        </span>
        {statusEl}
      </div>
      {body}
      <div class="peek__foot">Click for details{type === 'scene' ? '' : ' and editing'}</div>
    </div>
  );
}

export function goToScene(id: string) {
  setUi({ view: 'run' });
  goScene(id);
  go('run');
}
