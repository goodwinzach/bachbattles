// Game actions. Each one is a single undoable step with a human-readable label.

import type { Ability, Clue, Condition, Effect, Item, ItemState, NPC, NpcStatus, PC, PcStatus, Scene, Stat } from '../data/types';
import { STAT_NAME } from '../data/types';
import {
  abilityStatus,
  checkParts,
  holderName,
  isUnmasked,
  itemStateInfo,
  nameOf,
  neighbors,
  npcMaxHp,
  npcStat,
  pcStatusInfo,
  npcStatusInfo,
  statCalc,
} from './derive';
import { rollCheck, rollDie, rollExpr, type RollMode, type RollResult } from './dice';
import {
  all,
  ent,
  game,
  getData,
  getUi,
  lastRoll,
  latestUndoId,
  mutate,
  openModal,
  pushLog,
  setUi,
  toast,
  writePatch,
  type Combatant,
  type MapNote,
  type SaveData,
} from './store';

const flagPatch = (d: SaveData, type: Parameters<typeof writePatch>[1], id: string, f: Record<string, unknown>) =>
  writePatch(d, type, id, f);

// ─── players ──────────────────────────────────────────────────────────────

/** True until the party reaches John Doe's island: 0 HP knocks players out instead of killing them. */
export function beforeIsland(sceneId = game().scene): boolean {
  const order = all<Scene>('scene').map((s) => s.id);
  return order.indexOf(sceneId) < order.indexOf('john-doe');
}

/** Apply HP change with the death and plot-armor rules. Returns the label. */
function hpChange(d: SaveData, pc: PC, next: number): string {
  const max = pc.hpMax;
  let hp = Math.max(0, Math.min(max, next));
  let status: PcStatus = pc.status;
  let label = `${pc.name}: HP ${pc.hp} → ${hp}`;
  if (hp === 0 && pc.status !== 'ghost') {
    const armor = ent<Ability>('ability', 'plot-armor');
    if (pc.id === 'flynn' && armor?.enabled) {
      hp = 1;
      label = `${pc.name} would die. Plot armor: survives at 1 HP`;
    } else if (beforeIsland(d.game.scene)) {
      status = 'down';
      label = `${pc.name} is knocked out cold`;
    } else {
      status = 'ghost';
      label = `${pc.name} dies and becomes a ghost`;
    }
  } else if (hp > 0 && pc.status === 'ghost') {
    status = 'alive';
  } else if (hp > 0 && pc.status === 'down' && pc.hp === 0) {
    status = 'alive';
  }
  flagPatch(d, 'pc', pc.id, { hp, status });
  return label;
}

export function adjustHp(pcId: string, delta: number) {
  const pc = ent<PC>('pc', pcId);
  if (!pc || !delta) return;
  if (pc.status === 'ghost' && delta < 0) {
    toast(`${pc.name} is a ghost and cannot be physically injured.`, { tone: 'info' });
    return;
  }
  let label = '';
  const lethal = pc.hp + delta <= 0;
  mutate(
    () => label,
    (d) => {
      label = hpChange(d, pc, pc.hp + delta);
    },
    { coalesce: lethal ? undefined : `hp:${pcId}`, log: lethal },
  );
  const after = ent<PC>('pc', pcId)!;
  if (after.status === 'ghost' && pc.status !== 'ghost') {
    toast(`${label}. Ghost rules apply; a bagel can bring them back.`, { tone: 'bad', undoId: latestUndoId(), big: true });
  } else if (after.status === 'down' && pc.status !== 'down') {
    toast(`${label}. Nobody dies before the island: back at 1 HP when the scene ends.`, { tone: 'info', undoId: latestUndoId() });
  } else if (lethal && pc.id === 'flynn') {
    toast(label, { tone: 'gold', undoId: latestUndoId() });
  }
}

export function setHp(pcId: string, hp: number) {
  const pc = ent<PC>('pc', pcId);
  if (!pc) return;
  let label = '';
  mutate(() => label, (d) => (label = hpChange(d, pc, hp)), { coalesce: `hp:${pcId}` });
}

/** A scripted fall: they go down whatever the dice said (a ghost from the island on). */
export function takeOut(pcId: string) {
  const pc = ent<PC>('pc', pcId);
  if (!pc || pc.status === 'ghost') return;
  if (pc.hp > 0) adjustHp(pcId, -pc.hp);
  else setPcStatus(pcId, beforeIsland() ? 'down' : 'ghost');
}

export function setPcStatus(pcId: string, status: PcStatus) {
  const pc = ent<PC>('pc', pcId);
  if (!pc || pc.status === status) return;
  const fields: Partial<PC> = { status };
  if (status === 'ghost') fields.hp = 0;
  if (status === 'alive' && pc.hp === 0) fields.hp = pc.hpMax;
  mutate(`${pc.name}: ${pcStatusInfo(pc.status).label} → ${pcStatusInfo(status).label}`, (d) => flagPatch(d, 'pc', pcId, fields), {
    toast: true,
    log: status === 'ghost' || status === 'stone',
  });
}

export function toggleEffect(pcId: string, condId: string) {
  const pc = ent<PC>('pc', pcId);
  const cond = ent<Condition>('condition', condId);
  if (!pc || !cond) return;
  const on = pc.effects.includes(condId);
  const effects = on ? pc.effects.filter((e) => e !== condId) : [...pc.effects, condId];
  mutate(`${pc.name}: ${cond.name} ${on ? 'off' : 'on'}`, (d) => flagPatch(d, 'pc', pcId, { effects }), { toast: true });
}

/** Flynn's masks. Taking the mask off reveals the +100 Charisma secret. */
export function setMask(maskId: string) {
  const flynn = ent<PC>('pc', 'flynn');
  if (!flynn || flynn.mask === maskId) return;
  const prev = flynn.mask;
  const label =
    maskId === 'none' ? 'Flynn takes off his mask' : `Flynn puts on the ${nameOf('item', maskId)}`;
  mutate(
    label,
    (d) => {
      flagPatch(d, 'pc', 'flynn', { mask: maskId });
      // worn mask is "equipped"; the one he took off goes back to "held"
      if (prev && prev !== 'none') {
        const old = ent<Item>('item', prev);
        if (old && old.state === 'equipped') flagPatch(d, 'item', prev, { state: 'held', holder: 'flynn' });
      }
      if (maskId !== 'none') flagPatch(d, 'item', maskId, { state: 'equipped', holder: 'flynn' });
      if (maskId === 'none') {
        const un = ent<Ability>('ability', 'unmasked');
        if (un && !un.revealed) flagPatch(d, 'ability', 'unmasked', { revealed: true });
      }
    },
    { toast: true, log: maskId === 'none' },
  );
  if (maskId === 'none') {
    const un = ent<Ability>('ability', 'unmasked');
    if (un?.enabled) {
      openModal({
        kind: 'reveal',
        title: 'Your Charisma is now +100.',
        body: 'Flynn removed his mask. Stop the table and say it out loud. Still have him roll the d20, then add 100.',
      });
    }
  }
}

export function revive(pcId: string, useBagel: boolean) {
  const pc = ent<PC>('pc', pcId);
  if (!pc) return;
  const bagels = ent<Item>('item', 'bagels');
  if (useBagel && (!bagels || (bagels.qty ?? 0) <= 0 || (bagels.state !== 'held' && bagels.state !== 'equipped'))) {
    toast('No bagels left. Find more (the bagel shop in the epilogue has plenty).', { tone: 'bad' });
    return;
  }
  mutate(
    `${pc.name} is revived${useBagel ? ' with a bagel' : ''}`,
    (d) => {
      flagPatch(d, 'pc', pcId, { status: 'alive', hp: pc.hpMax });
      if (useBagel && bagels) {
        const qty = Math.max(0, (bagels.qty ?? 0) - 1);
        flagPatch(d, 'item', 'bagels', qty === 0 ? { qty, state: 'spent' } : { qty });
      }
    },
    { toast: 'good', log: true },
  );
}

export function healAll() {
  mutate(
    'Everyone living is back to full HP',
    (d) => {
      for (const pc of all<PC>('pc')) {
        if (pc.status !== 'ghost') flagPatch(d, 'pc', pc.id, { hp: pc.hpMax, status: pc.status === 'down' ? 'alive' : pc.status });
      }
    },
    { toast: 'good', log: true },
  );
}

// ─── abilities ────────────────────────────────────────────────────────────

export function useAbility(abId: string, delta = 1) {
  const ab = ent<Ability>('ability', abId);
  if (!ab || !ab.max) return;
  const used = Math.max(0, Math.min(ab.max, ab.used + delta));
  if (used === ab.used) return;
  const left = ab.max - used;
  mutate(
    delta > 0 ? `${nameOf('ability', abId)} used (${left}/${ab.max} left)` : `${nameOf('ability', abId)} restored (${left}/${ab.max} left)`,
    (d) => flagPatch(d, 'ability', abId, { used }),
    { toast: true, coalesce: `ab:${abId}` },
  );
}

export type AbilityStateChoice = 'ready' | 'spent' | 'disabled' | 'revealed' | 'hidden';

export function setAbilityState(abId: string, choice: AbilityStateChoice) {
  const ab = ent<Ability>('ability', abId);
  if (!ab) return;
  const name = nameOf('ability', abId);
  const fields: Partial<Ability> = {};
  let label = '';
  switch (choice) {
    case 'ready':
      Object.assign(fields, { enabled: true, used: 0 });
      label = `${name}: ready`;
      break;
    case 'spent':
      Object.assign(fields, { used: ab.max ?? 0 });
      label = `${name}: spent`;
      break;
    case 'disabled':
      Object.assign(fields, { enabled: !ab.enabled });
      label = `${name}: ${ab.enabled ? 'turned off' : 'turned on'}`;
      break;
    case 'revealed':
      Object.assign(fields, { revealed: true });
      label = `${name}: revealed to the table`;
      break;
    case 'hidden':
      Object.assign(fields, { revealed: false });
      label = `${name}: hidden again`;
      break;
  }
  mutate(label, (d) => flagPatch(d, 'ability', abId, fields), { toast: true });
}

/** Reset abilities that recharge per scene or per fight. */
function rechargeIn(d: SaveData, kind: 'scene' | 'fight') {
  for (const ab of all<Ability>('ability')) {
    if (ab.recharge === kind && ab.used > 0) flagPatch(d, 'ability', ab.id, { used: 0 });
  }
  if (kind === 'scene') {
    for (const pc of all<PC>('pc')) {
      const keep = pc.effects.filter((e) => !['dr-pepper-rush', 'tased', 'heavy', 'flying', 'helped'].includes(e));
      if (keep.length !== pc.effects.length) flagPatch(d, 'pc', pc.id, { effects: keep });
    }
  }
}

// ─── items ────────────────────────────────────────────────────────────────

export function setItemState(itemId: string, state: ItemState, holder?: string) {
  const it = ent<Item>('item', itemId);
  if (!it) return;
  const fields: Partial<Item> = { state };
  if (holder !== undefined) fields.holder = holder;
  else if ((state === 'held' || state === 'equipped') && (!it.holder || it.state === 'enemy' || it.state === 'unclaimed')) {
    fields.holder = it.holder && ent('pc', it.holder) ? it.holder : 'party';
  }
  const who = fields.holder !== undefined && fields.holder !== it.holder ? ` (${holderName(fields.holder)})` : '';
  mutate(
    `${nameOf('item', itemId)}: ${itemStateInfo(it.state).label} → ${itemStateInfo(state).label}${who}`,
    (d) => {
      flagPatch(d, 'item', itemId, fields);
      // a mask that is no longer usable comes off Flynn's face. That leaves him bare-faced but not
      // "Unmasked": the +100 Charisma only comes from taking a mask off by choice ('none').
      const flynn = ent<PC>('pc', 'flynn');
      if (it.kind === 'mask' && flynn?.mask === itemId && state !== 'equipped' && state !== 'held') {
        flagPatch(d, 'pc', 'flynn', { mask: '' });
      }
    },
    { toast: true },
  );
}

export function setItemHolder(itemId: string, holder: string) {
  const it = ent<Item>('item', itemId);
  if (!it || it.holder === holder) return;
  const fields: Partial<Item> = { holder };
  if (holder && (it.state === 'unclaimed' || it.state === 'missing' || it.state === 'lost') && (holder === 'party' || ent('pc', holder))) {
    fields.state = 'held';
  }
  if (holder && ent('npc', holder) && (it.state === 'held' || it.state === 'equipped')) fields.state = 'enemy';
  mutate(`${nameOf('item', itemId)} → ${holderName(holder)}`, (d) => flagPatch(d, 'item', itemId, fields), { toast: true });
}

export function adjustQty(itemId: string, delta: number, field: 'qty' | 'ammo' = 'qty') {
  const it = ent<Item>('item', itemId);
  if (!it) return;
  const cur = (field === 'qty' ? it.qty : it.ammo) ?? 0;
  const max = field === 'ammo' ? it.ammoMax ?? 99 : 9999;
  const next = Math.max(0, Math.min(max, cur + delta));
  if (next === cur) return;
  const unit = field === 'ammo' ? 'shots' : it.id === 'gold' ? 'gold' : '';
  mutate(`${nameOf('item', itemId)}: ${next}${unit ? ' ' + unit : ''}`, (d) => flagPatch(d, 'item', itemId, { [field]: next }), {
    coalesce: `${field}:${itemId}`,
  });
}

// ─── NPCs ─────────────────────────────────────────────────────────────────

export function setNpcStatus(npcId: string, status: NpcStatus) {
  const n = ent<NPC>('npc', npcId);
  if (!n || n.status === status) return;
  mutate(`${n.name}: ${npcStatusInfo(n.status).label} → ${npcStatusInfo(status).label}`, (d) => flagPatch(d, 'npc', npcId, { status }), {
    toast: true,
  });
}

export function adjustNpcHp(npcId: string, delta: number) {
  const n = ent<NPC>('npc', npcId);
  if (!n) return;
  const stat = npcStat(n);
  if (stat?.invincible) {
    toast(`${n.name} is invincible. Give the attack a cartoon reaction instead.`, { tone: 'gold' });
    return;
  }
  const max = npcMaxHp(n);
  if (max == null) return;
  const cur = n.hp ?? max;
  const hp = Math.max(0, Math.min(max, cur + delta));
  if (hp === cur) return;
  const fields: Partial<NPC> = { hp };
  if (hp === 0 && n.status !== 'defeated' && n.status !== 'dead') fields.status = 'defeated';
  if (hp > 0 && n.status === 'defeated') fields.status = 'hostile';
  mutate(
    hp === 0 ? `${n.name} is down` : `${n.name}: HP ${cur} → ${hp}`,
    (d) => flagPatch(d, 'npc', npcId, fields),
    { coalesce: hp === 0 ? undefined : `npchp:${npcId}`, toast: hp === 0 ? 'good' : undefined, log: hp === 0 },
  );
}

export function setNpcPhase(npcId: string, phase: number) {
  const n = ent<NPC>('npc', npcId);
  if (!n?.phases || n.phase === phase) return;
  const hp = n.phases[phase]?.stat.hp ?? null;
  mutate(`${n.name}: ${n.phases[phase].label} stats`, (d) => flagPatch(d, 'npc', npcId, { phase, hp }), { toast: true });
}

// ─── clues & conditions ───────────────────────────────────────────────────

export function setClue(clueId: string, revealed: boolean) {
  const c = ent<Clue>('clue', clueId);
  if (!c || c.revealed === revealed) return;
  mutate(`${revealed ? 'Revealed' : 'Hid'}: ${c.name}`, (d) => flagPatch(d, 'clue', clueId, { revealed }), { toast: revealed ? 'gold' : true, log: revealed });
}

export function setCondition(condId: string, active: boolean) {
  const c = ent<Condition>('condition', condId);
  if (!c || c.active === active) return;
  mutate(`${c.name} ${active ? 'begins' : 'ends'}`, (d) => flagPatch(d, 'condition', condId, { active }), { toast: true, log: true });
}

// ─── session timer ────────────────────────────────────────────────────────

export function toggleTimer() {
  const g = game();
  const now = Date.now();
  if (g.timer.running && g.timer.since) {
    const spent = { ...g.timer.spent, [g.scene]: (g.timer.spent[g.scene] ?? 0) + (now - g.timer.since) };
    mutate('Session timer paused', (d) => (d.game = { ...d.game, timer: { running: false, since: null, spent } }));
  } else {
    mutate('Session timer started', (d) => (d.game = { ...d.game, timer: { ...d.game.timer, running: true, since: now } }));
  }
}

export function resetTimer() {
  mutate('Session timer reset', (d) => (d.game = { ...d.game, timer: { running: false, since: null, spent: {} } }), { toast: true });
}

// ─── scenes ───────────────────────────────────────────────────────────────

function moveTimer(d: SaveData, from: string) {
  const t = d.game.timer;
  if (t.running && t.since) {
    const now = Date.now();
    d.game.timer = { running: true, since: now, spent: { ...t.spent, [from]: (t.spent[from] ?? 0) + (now - t.since) } };
  }
}

export function goScene(id: string, opts: { complete?: boolean } = {}) {
  const g = game();
  const target = ent<Scene>('scene', id);
  if (!target) return;
  if (g.scene === id && !opts.complete) return;
  const from = ent<Scene>('scene', g.scene);
  mutate(
    opts.complete && from ? `${from.title} done → ${target.title}` : `Now playing: ${target.title}`,
    (d) => {
      moveTimer(d, g.scene);
      if (opts.complete && from) flagPatch(d, 'scene', from.id, { status: 'done' });
      // knocked out before the island: back on their feet at 1 HP once the scene is over, however the DM leaves it
      if (g.scene !== id) for (const pc of all<PC>('pc')) if (pc.status === 'down' && pc.hp === 0) flagPatch(d, 'pc', pc.id, { status: 'alive', hp: 1 });
      if (target.status === 'skipped' || target.status === 'done') flagPatch(d, 'scene', id, { status: 'upcoming' });
      // playing one route's scene settles the route, so "Done, next" never wanders onto the other one
      const route = target.branch && !d.game.route ? target.branch : d.game.route;
      // reaching Gluttony closes the island: the rooms nobody chose are skipped
      if (id === 'gluttony') {
        for (const r of SIN_IDS) {
          const room = ent<Scene>('scene', r);
          if (room && r !== 'pride' && r !== 'gluttony' && room.status === 'upcoming') flagPatch(d, 'scene', r, { status: 'skipped' });
        }
      }
      const sinOrder = SIN_IDS.includes(id) && !d.game.sinOrder.includes(id) ? [...d.game.sinOrder, id] : d.game.sinOrder;
      d.game = { ...d.game, scene: id, sinOrder, route };
      rechargeIn(d, 'scene');
      if (d.game.combat) d.game.combat = null;
    },
    { toast: true, log: true },
  );
  setUi({ focusScene: id });
}

const SIN_IDS = ['pride', 'lust', 'greed', 'envy', 'wrath', 'sloth', 'gluttony'];

export function completeAndNext() {
  const g = game();
  if (g.scene === 'route-choice' && !g.route) {
    toast('Pick the route first: plane or boat (the buttons in this scene).', { tone: 'info' });
    return;
  }
  const { next } = neighbors(g.scene);
  if (next) goScene(next.id, { complete: true });
  else {
    const cur = ent<Scene>('scene', g.scene);
    if (cur && cur.status !== 'done') mutate(`${cur.title} done. That's a wrap.`, (d) => flagPatch(d, 'scene', cur.id, { status: 'done' }), { toast: 'gold', log: true });
  }
}

export function setSceneStatus(id: string, status: Scene['status']) {
  const s = ent<Scene>('scene', id);
  if (!s || s.status === status) return;
  mutate(`${s.title}: ${status}`, (d) => flagPatch(d, 'scene', id, { status }), { toast: true });
}

export function setRoute(route: 'plane' | 'boat' | null) {
  mutate(route ? `Route chosen: ${route === 'plane' ? 'by plane' : 'by boat'}` : 'Route undecided', (d) => (d.game = { ...d.game, route }), {
    toast: true,
    log: !!route,
  });
}

export function setCostello(asked: number) {
  const n = Math.max(0, Math.min(3, asked));
  mutate(`Costello: ${n} of 3 questions asked`, (d) => (d.game = { ...d.game, costelloAsked: n }), { coalesce: 'costello' });
  if (n !== 2) return;
  const missing = [
    ['fact-thief', 'Lou has the ring'],
    ['fact-hollywood', 'Lou and the ring are in Hollywood'],
  ].filter(([id]) => !ent<Clue>('clue', id)?.revealed);
  const riddle = !ent<Clue>('clue', 'fact-riddle')?.revealed;
  if (!missing.length && !riddle) return;
  const carry = missing.map(([, label]) => label).join(' and ');
  toast(
    `Two questions down. The last answer has to ${carry ? `say ${carry}` : ''}${carry && riddle ? ', and ' : ''}${riddle ? 'end with "Out of the closet without a face."' : '.'}`,
    { tone: 'gold', big: true },
  );
}

// ─── scene effects ────────────────────────────────────────────────────────

export const effectKey = (sceneId: string, i: number) => `${sceneId}:${i}`;

function applyOne(d: SaveData, ef: Effect) {
  switch (ef.kind) {
    case 'condition':
      flagPatch(d, 'condition', ef.id, { active: ef.active });
      break;
    case 'items':
      for (const id of ef.ids) flagPatch(d, 'item', id, ef.patch as Record<string, unknown>);
      break;
    case 'npcs':
      for (const id of ef.ids) flagPatch(d, 'npc', id, ef.patch as Record<string, unknown>);
      break;
    case 'clues':
      for (const id of ef.ids) flagPatch(d, 'clue', id, { revealed: true });
      break;
    case 'abilities':
      for (const id of ef.ids) flagPatch(d, 'ability', id, ef.patch as Record<string, unknown>);
      break;
    case 'healAll':
      // the feast after Gluttony: everyone, dead or alive, is back at full HP
      for (const pc of all<PC>('pc')) flagPatch(d, 'pc', pc.id, { hp: pc.hpMax, status: 'alive' });
      break;
    case 'pcs': {
      for (const pc of all<PC>('pc')) {
        const match =
          ef.filter === 'all' ||
          (ef.filter === 'notFlynn' && pc.id !== 'flynn') ||
          (ef.filter === 'flynn' && pc.id === 'flynn') ||
          (ef.filter === 'down' && pc.status === 'down') ||
          (ef.filter === 'stone' && pc.status === 'stone');
        if (!match) continue;
        if (ef.patch.status === 'down' && pc.status === 'ghost') continue;
        flagPatch(d, 'pc', pc.id, ef.patch as Record<string, unknown>);
      }
      if (ef.filter === 'flynn' && ef.patch.mask === 'none') {
        const flynn = ent<PC>('pc', 'flynn');
        if (flynn?.mask && flynn.mask !== 'none') flagPatch(d, 'item', flynn.mask, { state: 'held', holder: 'flynn' });
      }
      break;
    }
  }
}

export function applyEffect(sceneId: string, index: number) {
  const s = ent<Scene>('scene', sceneId);
  const ef = s?.effects?.[index];
  if (!s || !ef) return;
  const wasUnmasked = isUnmasked(ent<PC>('pc', 'flynn')!);
  mutate(
    ef.label,
    (d) => {
      applyOne(d, ef);
      d.game = { ...d.game, applied: { ...d.game.applied, [effectKey(sceneId, index)]: true } };
    },
    { toast: 'good', log: true },
  );
  if (!wasUnmasked && isUnmasked(ent<PC>('pc', 'flynn')!)) {
    openModal({ kind: 'reveal', title: 'Your Charisma is now +100.', body: 'Flynn removed his mask. Say it out loud to the whole table.' });
  }
}

export function applyAllEffects(sceneId: string) {
  const s = ent<Scene>('scene', sceneId);
  if (!s?.effects) return;
  const g = game();
  const pending = s.effects
    .map((ef, i) => ({ ef, i }))
    .filter(({ i }) => !g.applied[effectKey(sceneId, i)]);
  if (!pending.length) return;
  mutate(
    `${s.title}: applied ${pending.length} effect${pending.length > 1 ? 's' : ''}`,
    (d) => {
      for (const { ef, i } of pending) {
        applyOne(d, ef);
        d.game = { ...d.game, applied: { ...d.game.applied, [effectKey(sceneId, i)]: true } };
      }
    },
    { toast: 'good', log: true },
  );
}

// ─── combat ───────────────────────────────────────────────────────────────

export function startCombat(sceneId: string, encIndex: number, fighters: string[], foes: string[]) {
  const s = ent<Scene>('scene', sceneId);
  const enc = s?.encounters?.[encIndex];
  if (!s || !enc) return;
  const list: Combatant[] = [];
  const rolls: string[] = [];
  for (const id of fighters) {
    const pc = ent<PC>('pc', id);
    if (!pc) continue;
    const agi = statCalc(pc, 'agi').total;
    const d20 = rollDie(20);
    list.push({ key: `pc:${id}`, type: 'pc', id, init: d20 + agi });
    rolls.push(`${pc.name} ${d20 + agi}`);
  }
  for (const id of foes) {
    const n = ent<NPC>('npc', id);
    if (!n) continue;
    const d20 = rollDie(20);
    list.push({ key: `npc:${id}`, type: 'npc', id, init: d20 });
    rolls.push(`${n.name} ${d20}`);
  }
  list.sort((a, b) => b.init - a.init || (a.type === 'pc' ? -1 : 1));
  mutate(
    `Fight: ${enc.label}`,
    (d) => {
      for (const id of foes) {
        const n = ent<NPC>('npc', id);
        if (!n) continue;
        const fields: Partial<NPC> = { status: 'hostile' };
        if (enc.phase != null && n.phases) {
          fields.phase = enc.phase;
          fields.hp = n.phases[enc.phase]?.stat.hp ?? n.hp;
        } else if (n.hp == null || n.status === 'defeated') {
          fields.hp = npcMaxHp(n);
        }
        flagPatch(d, 'npc', id, fields);
      }
      d.game = { ...d.game, combat: { scene: sceneId, enc: encIndex, label: enc.label, round: 1, turn: 0, list } };
      if (d.game.scene !== sceneId) d.game.scene = sceneId;
    },
    { toast: 'gold', log: true },
  );
  pushLog({ kind: 'event', text: `Initiative: ${rolls.join(', ')}` });
}

function isOut(c: Combatant): boolean {
  if (c.type === 'npc') {
    const n = ent<NPC>('npc', c.id);
    return !n || ['defeated', 'dead', 'fled', 'stone', 'captured'].includes(n.status);
  }
  const pc = ent<PC>('pc', c.id);
  return !pc || pc.status === 'stone' || pc.status === 'down';
}

export function combatStep(dir: 1 | -1) {
  const c = game().combat;
  if (!c || !c.list.length) return;
  let { turn, round } = c;
  for (let guard = 0; guard < c.list.length; guard++) {
    turn += dir;
    if (turn >= c.list.length) {
      turn = 0;
      round += 1;
    } else if (turn < 0) {
      turn = c.list.length - 1;
      round = Math.max(1, round - 1);
    }
    if (!isOut(c.list[turn])) break;
  }
  const who = c.list[turn];
  const name = who.type === 'pc' ? ent<PC>('pc', who.id)?.name : ent<NPC>('npc', who.id)?.name;
  mutate(`Round ${round}: ${name}'s turn`, (d) => (d.game = { ...d.game, combat: { ...c, turn, round } }), { coalesce: 'turn' });
}

export function setInit(key: string, init: number) {
  const c = game().combat;
  if (!c) return;
  const current = c.list[c.turn]?.key;
  const list = c.list.map((x) => (x.key === key ? { ...x, init } : x)).sort((a, b) => b.init - a.init);
  const turn = Math.max(0, list.findIndex((x) => x.key === current));
  mutate('Initiative changed', (d) => (d.game = { ...d.game, combat: { ...c, list, turn } }), { coalesce: `init:${key}` });
}

export function addCombatant(type: 'pc' | 'npc', id: string) {
  const c = game().combat;
  if (!c || c.list.some((x) => x.key === `${type}:${id}`)) return;
  const e = type === 'pc' ? ent<PC>('pc', id) : ent<NPC>('npc', id);
  if (!e) return;
  const init = rollDie(20) + (type === 'pc' ? statCalc(e as PC, 'agi').total : 0);
  const current = c.list[c.turn]?.key;
  const list = [...c.list, { key: `${type}:${id}`, type, id, init }].sort((a, b) => b.init - a.init);
  mutate(`${e.name} joins the fight (initiative ${init})`, (d) => {
    if (type === 'npc') {
      const n = e as NPC;
      flagPatch(d, 'npc', id, { status: 'hostile', hp: n.hp ?? npcMaxHp(n) });
    }
    d.game = { ...d.game, combat: { ...c, list, turn: Math.max(0, list.findIndex((x) => x.key === current)) } };
  }, { toast: true });
}

export function removeCombatant(key: string) {
  const c = game().combat;
  if (!c) return;
  const current = c.list[c.turn]?.key;
  const list = c.list.filter((x) => x.key !== key);
  let turn = list.findIndex((x) => x.key === current);
  if (turn < 0) turn = Math.min(c.turn, list.length - 1);
  mutate('Removed from the fight', (d) => (d.game = { ...d.game, combat: list.length ? { ...c, list, turn: Math.max(0, turn) } : null }));
}

export function endCombat() {
  const c = game().combat;
  if (!c) return;
  mutate(
    `Fight over: ${c.label} (${c.round} round${c.round === 1 ? '' : 's'})`,
    (d) => {
      d.game = { ...d.game, combat: null };
      rechargeIn(d, 'fight');
    },
    { toast: true, log: true },
  );
}

// ─── rolling ──────────────────────────────────────────────────────────────

function announce(r: RollResult) {
  lastRoll(r);
  setUi({ lastRoll: r });
}

export function rollFor(pcId: string, stat: Stat, opts: { dc?: number; inverted?: boolean; mode?: RollMode; label?: string } = {}) {
  const pc = ent<PC>('pc', pcId);
  if (!pc) return null;
  const mode = opts.mode ?? getUi().diceMode;
  const calc = statCalc(pc, stat);
  const r = rollCheck({
    label: opts.label ?? `${pc.name}: ${STAT_NAME[stat]}${opts.dc != null ? ` vs DC ${opts.dc}` : ''}`,
    parts: checkParts(pc, stat),
    mode,
    dc: opts.dc,
    inverted: opts.inverted,
    who: pcId,
    stat,
  });
  if (pc.status === 'ghost' && (stat === 'str' || stat === 'agi')) r.note = 'Ghosts can only make Charisma, Perception and Intelligence rolls.';
  if (calc.override) r.note = 'Unmasked: Charisma is +100.';
  if (opts.inverted && opts.dc != null) r.note = r.success ? 'Safe: they fail to notice her eyes.' : 'Turned to stone.';
  announce(r);
  return r;
}

export function rollPlain(expr: string, label?: string) {
  const r = rollExpr(expr, label);
  if (r) announce(r);
  return r;
}

export function rollD20(mode: RollMode, mod = 0, label = 'd20', dc?: number) {
  const r = rollCheck({ label, parts: mod ? [{ label: 'Modifier', value: mod }] : [], mode, dc });
  announce(r);
  return r;
}

export function rollAttack(npcId: string, attackIndex: number, targetAc?: number) {
  const n = ent<NPC>('npc', npcId);
  const atk = n && npcStat(n)?.attacks[attackIndex];
  if (!n || !atk) return null;
  const r = rollCheck({
    label: `${n.name}: ${atk.name}${targetAc ? ` vs AC ${targetAc}` : ''}`,
    parts: atk.bonus ? [{ label: atk.name, value: atk.bonus }] : [],
    mode: 'normal',
    dc: targetAc,
    kind: 'attack',
  });
  if (atk.dmg && (r.success || targetAc == null) && r.nat !== 1) {
    const dmg = rollExpr(atk.dmg, 'damage');
    if (dmg) {
      const crit = r.nat === 20;
      const extra = crit ? rollExpr(atk.dmg, 'crit') : null;
      const total = dmg.total + (extra?.total ?? 0);
      r.note = `${crit ? 'Critical! ' : ''}Damage ${atk.dmg}${crit ? ' ×2 dice' : ''}: ${total}`;
      (r as RollResult & { damage?: number }).damage = total;
    }
  }
  announce(r);
  return r;
}

export function rollSpiritual() {
  const ab = ent<Ability>('ability', 'spiritual-moment');
  const d20 = rollDie(20);
  const band = ab?.table?.find((row) => {
    const [lo, hi] = row.range.split(/[–-]/).map((x) => parseInt(x, 10));
    return d20 >= lo && d20 <= hi;
  });
  const r: RollResult = {
    id: `r${Date.now().toString(36)}`,
    t: Date.now(),
    kind: 'table',
    label: 'Jam Radish: Spiritual Moment',
    dice: [d20],
    sides: 20,
    kept: d20,
    mod: 0,
    total: d20,
    nat: d20 === 20 ? 20 : d20 === 1 ? 1 : undefined,
    note: band ? `${band.label}: ${band.text}` : undefined,
    tone: band?.tone,
  };
  announce(r);
  if (ab && ab.max && abilityStatus(ab).status === 'ready') useAbility('spiritual-moment', 1);
  return r;
}

/** Medusa's gaze: inverted Perception for every groomsman with line of sight. */
export function rollMedusa(pcIds: string[]) {
  const results: { pc: PC; r: RollResult }[] = [];
  for (const id of pcIds) {
    const pc = ent<PC>('pc', id);
    if (!pc) continue;
    const r = rollCheck({
      label: `${pc.name}: Medusa's gaze (inverted Perception)`,
      parts: checkParts(pc, 'per'),
      mode: 'normal',
      dc: 11,
      inverted: true,
      who: id,
      stat: 'per',
    });
    r.note = r.success ? 'Safe' : 'Turned to stone';
    results.push({ pc, r });
    lastRoll(r);
  }
  const stoned = results.filter((x) => !x.r.success).map((x) => x.pc);
  if (stoned.length) {
    mutate(
      `Medusa: ${stoned.map((p) => p.name).join(', ')} turned to stone`,
      (d) => stoned.forEach((p) => flagPatch(d, 'pc', p.id, { status: 'stone' })),
      { toast: 'bad', log: true },
    );
  } else toast('Everyone avoided her eyes.', { tone: 'good' });
  return results;
}

export function rollInitiativeFor(pcId: string) {
  const pc = ent<PC>('pc', pcId);
  if (!pc) return;
  rollFor(pcId, 'agi', { label: `${pc.name}: initiative` });
}

export const dataSnapshot = () => getData();

// ─── story flow map: positions and notes ──────────────────────────────────

const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Put a scene somewhere else on the story flow map (in the current layout). */
export function moveScene(sceneId: string, layout: 'h' | 'v', x: number, y: number) {
  const title = ent<Scene>('scene', sceneId)?.title ?? 'a scene';
  mutate(`Moved ${title} on the map`, (d) => {
    const mapPos = { ...d.game.mapPos, [layout]: { ...d.game.mapPos[layout], [sceneId]: { x: snap(x), y: snap(y) } } };
    d.game = { ...d.game, mapPos };
  }, { toast: true });
}

/** Put every scene back where the story places it (in one layout). */
export function resetMapLayout(layout: 'h' | 'v') {
  mutate('Map layout reset', (d) => {
    d.game = { ...d.game, mapPos: { ...d.game.mapPos, [layout]: {} } };
  }, { toast: true });
}

let noteSeq = 0;
export function addMapNote(scene: string, dx: number, dy: number, color: MapNote['color'] = 'yellow'): string {
  const id = `n${Date.now().toString(36)}${(noteSeq++).toString(36)}`;
  const title = ent<Scene>('scene', scene)?.title ?? 'the map';
  mutate(`Note added by ${title}`, (d) => {
    d.game = { ...d.game, mapNotes: [...d.game.mapNotes, { id, text: '', color, scene, dx: snap(dx), dy: snap(dy) }] };
  });
  return id;
}

export function updateMapNote(id: string, fields: Partial<Omit<MapNote, 'id'>>, label = 'Map note changed') {
  const f = { ...fields };
  if (f.dx != null) f.dx = snap(f.dx);
  if (f.dy != null) f.dy = snap(f.dy);
  mutate(label, (d) => {
    d.game = { ...d.game, mapNotes: d.game.mapNotes.map((n) => (n.id === id ? { ...n, ...f } : n)) };
  }, { coalesce: `note:${id}:${Object.keys(f).join(',')}` });
}

export function deleteMapNote(id: string) {
  mutate('Map note deleted', (d) => {
    d.game = { ...d.game, mapNotes: d.game.mapNotes.filter((n) => n.id !== id) };
  }, { toast: true });
}

// ─── spotlight ────────────────────────────────────────────────────────────

/** Mark that a player just had a moment in the spotlight. */
export function giveSpotlight(pcId: string) {
  const name = ent<PC>('pc', pcId)?.name ?? 'Someone';
  mutate(`${name} had the spotlight`, (d) => {
    d.game = { ...d.game, spotlight: { ...d.game.spotlight, [pcId]: Date.now() } };
  }, { coalesce: `spot:${pcId}` });
}

