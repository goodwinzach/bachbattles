// Edit forms. Every field writes into the entity's patch, so the change appears in every view.

import type { ComponentChildren } from 'preact';
import type { AnyEntity, Attack, EntityType, Film, NPC, StatBlock } from '../data/types';
import { DEFAULT_PORTRAIT, PORTRAITS } from '../data/portraits';
import { STAT_ABBR, STATS } from '../data/types';
import { TYPE_LABEL } from '../data/campaign';
import {
  FILM_KIND_LABEL,
  ITEM_KIND_LABEL,
  ITEM_STATES,
  KIND_LABEL,
  NPC_STATUSES,
  PC_STATUSES,
  RECHARGE_LABEL,
  SCENE_STATUSES,
  SIDE_LABEL,
  npcStat,
} from '../state/derive';
import { all, baseOf, confirmThen, ent, isCustom, isPatched, mutate, patch, resetEntity, closeDrawer } from '../state/store';
import { holderOptions } from './controls';
import { Icon } from './icons';
import { CommitInput, Expander, NumberInput, Switch, cx } from './kit';

type FieldKind = 'text' | 'area' | 'paras' | 'list' | 'number' | 'select' | 'toggle' | 'stats' | 'mods' | 'range2' | 'portrait';

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  when?: (e: any) => boolean;
}

const opt = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

const SCHEMAS: Record<EntityType, FieldDef[]> = {
  pc: [
    { key: 'name', label: 'Character name', kind: 'text' },
    { key: 'portrait', label: 'Portrait', kind: 'portrait', hint: 'Shows on their profile, the cast page, chips, slides and the connections web.' },
    { key: 'player', label: 'Played by', kind: 'text' },
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'select', options: PC_STATUSES.map((s) => ({ value: s.id, label: s.label })) },
    { key: 'hp', label: 'Current HP', kind: 'number', min: 0 },
    { key: 'hpMax', label: 'Max HP', kind: 'number', min: 1 },
    { key: 'ac', label: 'Armor Class', kind: 'number', min: 0 },
    { key: 'stats', label: 'Base stats (modifiers)', kind: 'stats', hint: 'Flynn\'s Charisma is the masked value.' },
    { key: 'tagline', label: 'Tagline', kind: 'area', rows: 2 },
    { key: 'bio', label: 'Who they are', kind: 'area' },
    { key: 'play', label: 'How to play them', kind: 'area' },
    { key: 'secrets', label: 'DM secrets (one per line)', kind: 'list' },
  ],
  npc: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'portrait', label: 'Portrait', kind: 'portrait', hint: 'Shows on their profile, the cast page, chips, slides and the connections web.' },
    { key: 'film', label: 'From (film or show)', kind: 'select' },
    { key: 'aka', label: 'Also known as', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'select', options: NPC_STATUSES.map((s) => ({ value: s.id, label: s.label })) },
    { key: 'side', label: 'Side', kind: 'select', options: opt(SIDE_LABEL) },
    { key: 'hp', label: 'Current HP', kind: 'number', min: 0, when: (e: NPC) => !!npcStat(e)?.hp },
    { key: 'role', label: 'Role', kind: 'area', rows: 2 },
    { key: 'look', label: 'Look', kind: 'area', rows: 2 },
    { key: 'personality', label: 'Personality', kind: 'area', rows: 2 },
    { key: 'play', label: 'How to play them', kind: 'area' },
    { key: 'wants', label: 'Wants', kind: 'area', rows: 2 },
    { key: 'knows', label: 'What they know (one per line)', kind: 'list' },
    { key: 'important', label: 'Important (one per line)', kind: 'list' },
    { key: 'lines', label: 'Lines (one per line)', kind: 'list' },
  ],
  item: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'alias', label: 'Name the players know (while secret)', kind: 'text', when: (e) => !!e.secret },
    { key: 'revealed', label: 'Revealed to the table', kind: 'toggle', when: (e) => !!e.secret },
    { key: 'state', label: 'State', kind: 'select', options: ITEM_STATES.map((s) => ({ value: s.id, label: s.label })) },
    { key: 'holder', label: 'Who has it', kind: 'select' },
    { key: 'kind', label: 'Kind', kind: 'select', options: opt(ITEM_KIND_LABEL) },
    { key: 'portrait', label: 'Picture', kind: 'portrait', when: (e) => e.kind === 'mask' || e.kind === 'hazard' },
    { key: 'qty', label: 'Count', kind: 'number', min: 0, when: (e) => e.qty != null },
    { key: 'ammo', label: 'Shots left', kind: 'number', min: 0, when: (e) => e.ammoMax != null },
    { key: 'dmg', label: 'Damage dice', kind: 'text', hint: 'e.g. 1d8' },
    { key: 'range', label: 'Range', kind: 'select', options: [{ value: '', label: '—' }, ...['Close', 'Nearby', 'Far Away'].map((v) => ({ value: v, label: v }))] },
    { key: 'acBonus', label: 'AC bonus while held', kind: 'number', min: 0 },
    { key: 'effect', label: 'What it does', kind: 'area' },
    { key: 'notes', label: 'Notes (one per line)', kind: 'list' },
  ],
  ability: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'enabled', label: 'Turned on', kind: 'toggle' },
    { key: 'revealed', label: 'Revealed to the table', kind: 'toggle', when: (e) => !!e.secret },
    { key: 'used', label: 'Uses spent', kind: 'number', min: 0, when: (e) => !!e.max },
    { key: 'max', label: 'Uses', kind: 'number', min: 0 },
    { key: 'recharge', label: 'Recharges', kind: 'select', options: opt(RECHARGE_LABEL) },
    { key: 'owner', label: 'Belongs to', kind: 'select' },
    { key: 'summary', label: 'Summary', kind: 'area' },
    { key: 'mechanics', label: 'How it works (one per line)', kind: 'list' },
    { key: 'limits', label: 'Limits (one per line)', kind: 'list' },
    { key: 'examples', label: 'Examples (one per line)', kind: 'list' },
  ],
  scene: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'slug', label: 'Slug line', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'select', options: SCENE_STATUSES.filter((s) => s.id !== 'active').map((s) => ({ value: s.id, label: s.label })) },
    { key: 'kind', label: 'Kind', kind: 'select', options: opt(KIND_LABEL) },
    { key: 'minutes', label: 'Target minutes', kind: 'range2' },
    { key: 'logline', label: 'Logline', kind: 'area', rows: 2 },
    { key: 'objective', label: 'Objective', kind: 'area', rows: 2 },
    { key: 'readAloud', label: 'Read aloud (blank line between paragraphs)', kind: 'paras', rows: 8 },
    { key: 'mustHappen', label: 'Must happen (one per line)', kind: 'list' },
    { key: 'notes', label: 'DM notes (one per line)', kind: 'list' },
    { key: 'tips', label: 'Ideas for the players (one per line)', kind: 'list' },
    { key: 'secrets', label: 'Secrets (one per line)', kind: 'list' },
  ],
  condition: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'active', label: 'Active for the party', kind: 'toggle', when: (e) => e.scope === 'party' },
    { key: 'mods', label: 'Stat modifiers', kind: 'mods' },
    { key: 'summary', label: 'Summary', kind: 'area', rows: 2 },
    { key: 'starts', label: 'Starts', kind: 'text' },
    { key: 'ends', label: 'Ends', kind: 'text' },
  ],
  clue: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'revealed', label: 'Revealed', kind: 'toggle' },
    { key: 'text', label: 'Clue', kind: 'area', rows: 3 },
  ],
  rule: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'summary', label: 'Summary', kind: 'area', rows: 2 },
    { key: 'body', label: 'Body (blank line between paragraphs)', kind: 'paras' },
    { key: 'list', label: 'Points (one per line)', kind: 'list' },
  ],
  film: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'favorite', label: "One of Flynn's favorites", kind: 'toggle' },
    { key: 'kind', label: 'Kind', kind: 'select', options: opt(FILM_KIND_LABEL) },
    { key: 'note', label: 'Note', kind: 'area', rows: 2 },
  ],
  act: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'tagline', label: 'Tagline', kind: 'text' },
    { key: 'summary', label: 'Summary', kind: 'area', rows: 3 },
  ],
};

function displayName(e: AnyEntity): string {
  const r = e as unknown as { name?: string; title?: string; id: string };
  return r.name ?? r.title ?? r.id;
}

function FieldRow({ type, id, f, children }: { type: EntityType; id: string; f: FieldDef; children: ComponentChildren }) {
  const changed = isPatched(type, id, f.key);
  const base = baseOf(type, id) as Record<string, unknown> | undefined;
  return (
    <div class={cx('field', changed && 'field--changed')}>
      <div class="field__label">
        <label htmlFor={`ed-${type}-${id}-${f.key}`}>{f.label}</label>
        {changed && (
          <>
            <span class="field__mod" title="Changed from the original" />
            <button
              type="button"
              class="field__reset"
              title="Put back the original"
              onClick={() => base && patch(type, id, { [f.key]: base[f.key] }, `${f.label}: back to the original`, { toast: true })}
            >
              <Icon name="rotate-ccw" size={11} /> original
            </button>
          </>
        )}
      </div>
      {children}
      {f.hint && <div class="field__hint">{f.hint}</div>}
    </div>
  );
}

export function EntityEditor({ type, id }: { type: EntityType; id: string }) {
  const e = ent(type, id) as unknown as Record<string, any> | undefined;
  if (!e) return null;
  const name = displayName(e as unknown as AnyEntity);
  const set = (key: string, label: string, value: unknown) => patch(type, id, { [key]: value }, `${name}: ${label.replace(/ \(.*\)$/, '').toLowerCase()} changed`, { toast: true });
  const fields = SCHEMAS[type].filter((f) => !f.when || f.when(e));
  const uid = (k: string) => `ed-${type}-${id}-${k}`;

  return (
    <div class="editor stack" style={{ '--gap': '16px' } as never}>
      <div class="editor__intro">
        <Icon name="pencil" size={15} />
        <div>
          Changes save as you go and update every view: the run screen, script, map, slides and codex.
          <Expander id="editor:tokens" title="Linking and formatting" variant="plain">
            <ul class="rlist">
              <li>
                <code>[[npc:lou]]</code> links a character, <code>[[item:batman-cowl]]</code> an item, <code>[[ability:gump-luck]]</code> an ability. Add a label with <code>[[npc:lou|the cameraman]]</code>.
              </li>
              <li>
                <code>{'{{cha:12}}'}</code> becomes a clickable Charisma DC 12 check. <code>{'{{1d8}}'}</code> becomes a die you can roll.
              </li>
              <li>
                <code>**bold**</code> and <code>*italic*</code> work everywhere.
              </li>
            </ul>
          </Expander>
        </div>
      </div>
      {fields.map((f) => {
        const v = e[f.key];
        switch (f.kind) {
          case 'text':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <CommitInput id={uid(f.key)} value={v ?? ''} onCommit={(x) => set(f.key, f.label, x)} />
              </FieldRow>
            );
          case 'area':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <CommitInput id={uid(f.key)} multiline rows={f.rows ?? 4} value={v ?? ''} onCommit={(x) => set(f.key, f.label, x)} />
              </FieldRow>
            );
          case 'paras':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <CommitInput
                  id={uid(f.key)}
                  multiline
                  rows={f.rows ?? 6}
                  value={(v as string[] | undefined)?.join('\n\n') ?? ''}
                  onCommit={(x) => set(f.key, f.label, x.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean))}
                />
              </FieldRow>
            );
          case 'list':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <CommitInput
                  id={uid(f.key)}
                  multiline
                  rows={Math.min(10, Math.max(3, ((v as string[] | undefined)?.length ?? 0) + 1))}
                  value={(v as string[] | undefined)?.join('\n') ?? ''}
                  onCommit={(x) => set(f.key, f.label, x.split('\n').map((s) => s.trim()).filter(Boolean))}
                />
              </FieldRow>
            );
          case 'number':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <NumberInput id={uid(f.key)} value={v ?? null} min={f.min} max={f.max} onCommit={(x) => set(f.key, f.label, x)} width={96} />
              </FieldRow>
            );
          case 'select': {
            let options = f.options ?? [];
            if (f.key === 'holder') options = holderOptions();
            if (f.key === 'owner') options = all('pc').map((p) => ({ value: p.id, label: (p as { name: string }).name }));
            if (f.key === 'film' && type === 'npc') options = [{ value: '', label: 'Original to this campaign' }, ...all<Film>('film').map((x) => ({ value: x.id, label: x.title }))];
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <select id={uid(f.key)} class="select" value={v ?? ''} onChange={(ev) => set(f.key, f.label, (ev.target as HTMLSelectElement).value)}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            );
          }
          case 'portrait': {
            const def = DEFAULT_PORTRAIT[`${type}:${id}`];
            const cur = (v as string | undefined) ?? def ?? 'none';
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <div class="portpick" role="radiogroup" aria-label={f.label}>
                  <button type="button" role="radio" aria-checked={cur === 'none'} class={cx('portpick__opt portpick__none', cur === 'none' && 'is-on')} onClick={() => set(f.key, f.label, 'none')} title="No picture: use the icon">
                    <Icon name={(e.icon as string) ?? 'user'} size={18} />
                  </button>
                  {PORTRAITS.map((p) => (
                    <button key={p.key} type="button" role="radio" aria-checked={cur === p.key} class={cx('portpick__opt', cur === p.key && 'is-on')} onClick={() => set(f.key, f.label, p.key)} title={p.label}>
                      <img src={p.src} alt={p.label} decoding="async" />
                    </button>
                  ))}
                </div>
              </FieldRow>
            );
          }
          case 'toggle':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <Switch id={uid(f.key)} checked={!!v} onChange={(x) => set(f.key, f.label, x)} label={v ? 'Yes' : 'No'} />
              </FieldRow>
            );
          case 'stats':
          case 'mods':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <div class="statedit">
                  {STATS.map((s) => (
                    <label key={s} class="statedit__cell">
                      <span>{STAT_ABBR[s]}</span>
                      <NumberInput
                        value={(v ?? {})[s] ?? (f.kind === 'stats' ? 0 : null)}
                        ariaLabel={STAT_ABBR[s]}
                        onCommit={(x) => {
                          const next = { ...(v ?? {}) };
                          if (f.kind === 'mods' && x === 0) delete next[s];
                          else next[s] = x;
                          set(f.key, `${f.label} (${STAT_ABBR[s]})`, next);
                        }}
                        width={64}
                      />
                    </label>
                  ))}
                </div>
              </FieldRow>
            );
          case 'range2':
            return (
              <FieldRow key={f.key} type={type} id={id} f={f}>
                <div class="row">
                  <NumberInput value={v?.[0] ?? null} min={0} ariaLabel="Minimum minutes" onCommit={(x) => set(f.key, f.label, [x, Math.max(x, v?.[1] ?? x)])} />
                  <span class="muted">to</span>
                  <NumberInput value={v?.[1] ?? null} min={0} ariaLabel="Maximum minutes" onCommit={(x) => set(f.key, f.label, [Math.min(x, v?.[0] ?? x), x])} />
                  <span class="muted">min</span>
                </div>
              </FieldRow>
            );
        }
      })}
      {type === 'npc' && <StatBlockEditor npc={e as unknown as NPC} />}
      <FieldRow type={type} id={id} f={{ key: 'dmNote', label: 'Your note', kind: 'area' }}>
        <CommitInput id={uid('dmNote')} multiline rows={3} value={e.dmNote ?? ''} placeholder="Anything you want to remember about this. Shows on its card." onCommit={(x) => set('dmNote', 'note', x)} />
      </FieldRow>
      <div class="editor__foot">
        {isPatched(type, id) && (
          <button type="button" class="btn btn--sm" onClick={() => confirmThen(`Reset ${name}?`, `All your changes to this ${TYPE_LABEL[type].toLowerCase()} go back to the campaign as written. You can undo this.`, 'Reset', () => resetEntity(type, id, name))}>
            <Icon name="rotate-ccw" /> Reset to original
          </button>
        )}
        {isCustom(type, id) && (
          <button
            type="button"
            class="btn btn--sm btn--danger"
            onClick={() =>
              confirmThen(`Delete ${name}?`, 'This removes something you created. You can undo it.', 'Delete', () => {
                closeDrawer();
                mutate(`Deleted ${name}`, (d) => {
                  const key = `${type}:${id}`;
                  const { [key]: _c, ...created } = d.created;
                  const { [key]: _p, ...patches } = d.patches;
                  d.created = created;
                  d.patches = patches;
                }, { toast: true });
              }, true)
            }
          >
            <Icon name="trash" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function StatBlockEditor({ npc }: { npc: NPC }) {
  const stat = npcStat(npc);
  if (!stat) return null;
  const phaseIdx = npc.phases?.length ? npc.phase : -1;
  const write = (next: StatBlock, label: string) => {
    if (phaseIdx >= 0 && npc.phases) {
      const phases = npc.phases.map((p, i) => (i === phaseIdx ? { ...p, stat: next } : p));
      patch('npc', npc.id, { phases, ...(phaseIdx === 0 ? { stat: next } : {}) }, `${npc.name}: ${label}`, { toast: true });
    } else patch('npc', npc.id, { stat: next }, `${npc.name}: ${label}`, { toast: true });
  };
  const setAttack = (i: number, a: Partial<Attack>) => write({ ...stat, attacks: stat.attacks.map((x, j) => (j === i ? { ...x, ...a } : x)) }, `${stat.attacks[i].name} changed`);
  return (
    <div class={cx('field', (isPatched('npc', npc.id, 'stat') || isPatched('npc', npc.id, 'phases')) && 'field--changed')}>
      <div class="field__label">
        Stat block{npc.phases ? ` (${npc.phases[npc.phase]?.label} phase)` : ''}
        {(isPatched('npc', npc.id, 'stat') || isPatched('npc', npc.id, 'phases')) && <span class="field__mod" />}
      </div>
      {stat.invincible ? (
        <div class="muted">Invincible. No AC or HP to edit.</div>
      ) : (
        <div class="row">
          <label class="statedit__cell">
            <span>AC</span>
            <NumberInput value={stat.ac} min={0} ariaLabel="Armor Class" onCommit={(x) => write({ ...stat, ac: x }, 'AC changed')} width={64} />
          </label>
          <label class="statedit__cell">
            <span>Max HP</span>
            <NumberInput value={stat.hp} min={1} ariaLabel="Max HP" onCommit={(x) => write({ ...stat, hp: x }, 'max HP changed')} width={72} />
          </label>
        </div>
      )}
      <div class="atkedit">
        {stat.attacks.map((a, i) => (
          <div key={i} class="atkedit__row">
            <CommitInput value={a.name} ariaLabel="Attack name" onCommit={(x) => setAttack(i, { name: x })} />
            <NumberInput value={a.bonus ?? null} ariaLabel="To hit" onCommit={(x) => setAttack(i, { bonus: x })} width={60} />
            <CommitInput value={a.dmg ?? ''} ariaLabel="Damage" placeholder="1d8" onCommit={(x) => setAttack(i, { dmg: x || undefined })} style={{ width: '76px' }} />
          </div>
        ))}
        <div class="field__hint">Name · to hit · damage. Attack rolls in the combat tracker use these.</div>
      </div>
    </div>
  );
}

let createdSeq = 0;
const newId = () => `custom-${Date.now().toString(36)}${(createdSeq++).toString(36)}`;

export function createCustomItem(holder = 'party') {
  const id = newId();
  mutate(
    'Created a new item',
    (d) => {
      d.created = {
        ...d.created,
        [`item:${id}`]: {
          id,
          name: 'New item',
          kind: 'prop',
          icon: 'package',
          effect: 'Describe what it does.',
          state: 'held',
          holder,
          qty: null,
          ammo: null,
          revealed: true,
          dmNote: '',
        } as AnyEntity,
      };
    },
    { toast: true },
  );
  return id;
}

export function createCustomNpc() {
  const id = newId();
  mutate(
    'Created a new character',
    (d) => {
      d.created = {
        ...d.created,
        [`npc:${id}`]: {
          id,
          name: 'New character',
          side: 'neutral',
          icon: 'user',
          role: 'Who are they?',
          status: 'present',
          hp: 12,
          phase: 0,
          dmNote: '',
          stat: { ac: 12, hp: 12, attacks: [{ name: 'Strike', bonus: 3, dmg: '1d6', range: 'Close' }] },
        } as AnyEntity,
      };
    },
    { toast: true },
  );
  return id;
}
