// State controls shared by every view. When Edit mode is on they become pickers; the same
// action runs no matter where the change is made, so every other view updates with it.

import type { Ability, Clue, Condition, Item, NPC, PC, Scene } from '../data/types';
import {
  setAbilityState,
  setClue,
  setCondition,
  setItemHolder,
  setItemState,
  setNpcStatus,
  setPcStatus,
  setSceneStatus,
} from '../state/actions';
import {
  abilityStatus,
  ABILITY_STATUS,
  ITEM_STATES,
  NPC_STATUSES,
  PC_STATUSES,
  SCENE_STATUSES,
  sceneStatus,
} from '../state/derive';
import { all, getUi } from '../state/store';
import type { NPC as NpcT, PC as PcT } from '../data/types';
import { StatePicker, type PickOption } from './kit';

export const canEdit = () => getUi().edit;

export function ItemStateControl({ item, size, force }: { item: Item; size?: 'sm' | 'md'; force?: boolean }) {
  const opts: PickOption[] = ITEM_STATES.map((s) => ({ value: s.id, label: s.label, tone: s.tone, hint: s.hint }));
  return (
    <StatePicker
      value={item.state}
      options={opts}
      editable={force || canEdit()}
      onChange={(v) => setItemState(item.id, v as Item['state'])}
      label={`${item.name} state`}
      size={size}
    />
  );
}

export function holderOptions(): PickOption[] {
  return [
    { value: 'party', label: 'The party' },
    ...all<PcT>('pc').map((p) => ({ value: p.id, label: p.name })),
    { value: '', label: 'Nobody' },
    ...all<NpcT>('npc')
      .filter((n) => !n.minor || n.group)
      .map((n) => ({ value: n.id, label: n.name })),
  ];
}

export function HolderControl({ item, force }: { item: Item; force?: boolean }) {
  const editable = force || canEdit();
  const opts = holderOptions();
  if (!opts.some((o) => o.value === item.holder)) opts.push({ value: item.holder, label: item.holder });
  if (!editable) return null;
  return (
    <select
      class="select select--sm holder-select"
      aria-label={`Who has the ${item.name}`}
      value={item.holder}
      onChange={(e) => setItemHolder(item.id, (e.target as HTMLSelectElement).value)}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AbilityStateControl({ ab, size, force }: { ab: Ability; size?: 'sm' | 'md'; force?: boolean }) {
  const st = abilityStatus(ab);
  const cur = ABILITY_STATUS[st.status];
  const opts: PickOption[] = [{ value: 'cur', label: cur.label, tone: cur.tone, hint: st.why }];
  if (ab.max) {
    opts.push({ value: 'ready', label: 'Ready: restore all uses' });
    opts.push({ value: 'spent', label: 'Spent: use them all' });
  }
  opts.push({ value: 'disabled', label: ab.enabled ? 'Turn off' : 'Turn back on' });
  if (ab.secret) opts.push({ value: ab.revealed ? 'hidden' : 'revealed', label: ab.revealed ? 'Hide from the table again' : 'Reveal to the table' });
  return (
    <StatePicker
      value="cur"
      options={opts}
      editable={force || canEdit()}
      onChange={(v) => v !== 'cur' && setAbilityState(ab.id, v as never)}
      label={`${ab.name} state`}
      size={size}
      title={st.why}
    />
  );
}

export function PcStatusControl({ pc, size, force }: { pc: PC; size?: 'sm' | 'md'; force?: boolean }) {
  return (
    <StatePicker
      value={pc.status}
      options={PC_STATUSES.map((s) => ({ value: s.id, label: s.label, tone: s.tone, hint: s.hint }))}
      editable={force || canEdit()}
      onChange={(v) => setPcStatus(pc.id, v as PC['status'])}
      label={`${pc.name} status`}
      size={size}
    />
  );
}

export function NpcStatusControl({ npc, size, force }: { npc: NPC; size?: 'sm' | 'md'; force?: boolean }) {
  return (
    <StatePicker
      value={npc.status}
      options={NPC_STATUSES.map((s) => ({ value: s.id, label: s.label, tone: s.tone }))}
      editable={force || canEdit()}
      onChange={(v) => setNpcStatus(npc.id, v as NPC['status'])}
      label={`${npc.name} status`}
      size={size}
    />
  );
}

export function SceneStatusControl({ scene, size, force }: { scene: Scene; size?: 'sm' | 'md'; force?: boolean }) {
  const st = sceneStatus(scene);
  const opts: PickOption[] = SCENE_STATUSES.filter((s) => s.id !== 'active' || st === 'active').map((s) => ({ value: s.id, label: s.label, tone: s.tone }));
  return (
    <StatePicker
      value={st}
      options={opts}
      editable={(force || canEdit()) && st !== 'active'}
      onChange={(v) => setSceneStatus(scene.id, v as Scene['status'])}
      label={`${scene.title} status`}
      size={size}
    />
  );
}

export function ClueControl({ clue, size, force }: { clue: Clue; size?: 'sm' | 'md'; force?: boolean }) {
  return (
    <StatePicker
      value={clue.revealed ? 'y' : 'n'}
      options={[
        { value: 'n', label: 'Hidden', tone: 'muted' },
        { value: 'y', label: 'Revealed', tone: 'gold' },
      ]}
      editable={force || canEdit()}
      onChange={(v) => setClue(clue.id, v === 'y')}
      label={`${clue.name}`}
      size={size}
    />
  );
}

export function ConditionControl({ cond, size, force }: { cond: Condition; size?: 'sm' | 'md'; force?: boolean }) {
  return (
    <StatePicker
      value={cond.active ? 'y' : 'n'}
      options={[
        { value: 'y', label: 'Active', tone: 'warn' },
        { value: 'n', label: 'Off', tone: 'muted' },
      ]}
      editable={force || canEdit()}
      onChange={(v) => setCondition(cond.id, v === 'y')}
      label={cond.name}
      size={size}
    />
  );
}
