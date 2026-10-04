// Checks that every [[type:id]] reference, scene link, holder, owner and film id in the
// campaign data points at a real entity. Run: node tests/validate-data.mjs
import * as esbuild from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'orf-'));
const out = join(dir, 'campaign.mjs');
await esbuild.build({ entryPoints: ['src/data/campaign.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const { CAMPAIGN, BASE_INDEX, TOKEN_TYPE, RELATIONS } = await import(out);

const errors = [];
const has = (type, id) => Boolean(BASE_INDEX[`${type}:${id}`]);
const walk = (value, where) => {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\[\[([a-z]+):([a-z0-9-]+)(?:\|[^\]]*)?\]\]/g)) {
      const type = TOKEN_TYPE[m[1]];
      if (!type) errors.push(`${where}: unknown token type "${m[1]}"`);
      else if (!has(type, m[2])) errors.push(`${where}: missing ${m[1]}:${m[2]}`);
    }
    for (const m of value.matchAll(/\{\{([^}]+)\}\}/g)) {
      if (!/^(str|agi|cha|per|int|any):\d+$|^\d*d\d+([+-]\d+)?$/.test(m[1])) errors.push(`${where}: bad dice/check token {{${m[1]}}}`);
    }
  } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${where}.${k}`);
};
for (const [key, e] of Object.entries(BASE_INDEX)) walk(e, key);

const ids = (list) => new Set(list.map((e) => e.id));
const sceneIds = ids(CAMPAIGN.scenes), npcIds = ids(CAMPAIGN.npcs), pcIds = ids(CAMPAIGN.pcs);
const itemIds = ids(CAMPAIGN.items), filmIds = ids(CAMPAIGN.films), actIds = ids(CAMPAIGN.acts);
const clueIds = ids(CAMPAIGN.clues), abilityIds = ids(CAMPAIGN.abilities), condIds = ids(CAMPAIGN.conditions);
for (const s of CAMPAIGN.scenes) {
  if (!actIds.has(s.act)) errors.push(`scene:${s.id}: unknown act ${s.act}`);
  for (const n of s.next) if (!sceneIds.has(n)) errors.push(`scene:${s.id}: next -> ${n}`);
  for (const c of s.cast ?? []) if (!npcIds.has(c)) errors.push(`scene:${s.id}: cast ${c}`);
  for (const enc of s.encounters ?? []) {
    for (const f of enc.foes) if (!npcIds.has(f)) errors.push(`scene:${s.id}: foe ${f}`);
    for (const f of enc.fighters ?? []) if (!pcIds.has(f)) errors.push(`scene:${s.id}: fighter ${f}`);
  }
  for (const l of s.loot ?? []) if (!itemIds.has(l)) errors.push(`scene:${s.id}: loot ${l}`);
  for (const l of s.lines ?? []) if (!npcIds.has(l.by) && !pcIds.has(l.by)) errors.push(`scene:${s.id}: line by ${l.by}`);
  for (const f of s.films ?? []) if (!filmIds.has(f)) errors.push(`scene:${s.id}: film ${f}`);
  for (const ef of s.effects ?? []) {
    const check = (set, list, label) => list.forEach((x) => set.has(x) || errors.push(`scene:${s.id}: effect ${label} ${x}`));
    if (ef.kind === 'items') check(itemIds, ef.ids, 'item');
    if (ef.kind === 'npcs') check(npcIds, ef.ids, 'npc');
    if (ef.kind === 'clues') check(clueIds, ef.ids, 'clue');
    if (ef.kind === 'abilities') check(abilityIds, ef.ids, 'ability');
    if (ef.kind === 'condition') check(condIds, [ef.id], 'condition');
  }
}
for (const i of CAMPAIGN.items) {
  if (i.holder && i.holder !== 'party' && !pcIds.has(i.holder) && !npcIds.has(i.holder)) errors.push(`item:${i.id}: holder ${i.holder}`);
  if (i.source && !sceneIds.has(i.source)) errors.push(`item:${i.id}: source ${i.source}`);
}
for (const a of CAMPAIGN.abilities) {
  if (!pcIds.has(a.owner)) errors.push(`ability:${a.id}: owner ${a.owner}`);
  if (a.requires && !itemIds.has(a.requires)) errors.push(`ability:${a.id}: requires ${a.requires}`);
}
for (const p of CAMPAIGN.pcs) for (const a of p.abilities) if (!abilityIds.has(a)) errors.push(`pc:${p.id}: ability ${a}`);
for (const n of CAMPAIGN.npcs) if (n.film && !filmIds.has(n.film)) errors.push(`npc:${n.id}: film ${n.film}`);
for (const c of CAMPAIGN.clues) if (!sceneIds.has(c.source)) errors.push(`clue:${c.id}: source ${c.source}`);
for (const coll of ['pcs', 'items', 'abilities', 'rules']) for (const e of CAMPAIGN[coll]) for (const f of e.films ?? []) if (!filmIds.has(f)) errors.push(`${coll}:${e.id}: film ${f}`);
for (const r of RELATIONS) for (const k of [r.a, r.b]) if (!BASE_INDEX[k]) errors.push(`relation: missing ${k}`);
const dupes = Object.keys(BASE_INDEX).length !== Object.values(CAMPAIGN).reduce((n, l) => n + l.length, 0);
if (dupes) errors.push('duplicate ids within a type');

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s)`);
  process.exit(1);
}
const counts = Object.entries(CAMPAIGN).map(([k, v]) => `${k} ${v.length}`).join(', ');
console.log(`data ok: ${counts}`);
