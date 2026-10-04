import { NPCS, PCS, RELATIONS } from './cast';
import { DIALOGUE } from './dialogue';
import { LOCATIONS } from './locations';
import { FILMS, RULES } from './rules';
import { ACTS, SCENES } from './scenes';
import { ABILITIES, CLUES, CONDITIONS, ITEMS } from './things';
import type { AnyEntity, Campaign, EntityType } from './types';

export { DIALOGUE, RELATIONS };

export const CAMPAIGN: Campaign = {
  acts: ACTS,
  scenes: SCENES,
  pcs: PCS,
  npcs: NPCS,
  items: ITEMS,
  abilities: ABILITIES,
  conditions: CONDITIONS,
  clues: CLUES,
  rules: RULES,
  films: FILMS,
  locations: LOCATIONS,
};

/** Which campaign list holds each entity type. */
export const COLLECTION: Record<EntityType, keyof Campaign> = {
  act: 'acts',
  scene: 'scenes',
  pc: 'pcs',
  npc: 'npcs',
  item: 'items',
  ability: 'abilities',
  condition: 'conditions',
  clue: 'clues',
  rule: 'rules',
  film: 'films',
  location: 'locations',
};

/** Token prefixes used in rich text ([[cond:hangover]] etc.). */
export const TOKEN_TYPE: Record<string, EntityType> = {
  act: 'act',
  scene: 'scene',
  pc: 'pc',
  npc: 'npc',
  item: 'item',
  ability: 'ability',
  cond: 'condition',
  condition: 'condition',
  clue: 'clue',
  rule: 'rule',
  film: 'film',
  loc: 'location',
  location: 'location',
};

export const TYPE_LABEL: Record<EntityType, string> = {
  act: 'Act',
  scene: 'Scene',
  pc: 'Player',
  npc: 'Character',
  item: 'Item',
  ability: 'Ability',
  condition: 'Condition',
  clue: 'Clue',
  rule: 'Rule',
  film: 'Film',
  location: 'Location',
};

export const BASE_INDEX: Record<string, AnyEntity> = (() => {
  const out: Record<string, AnyEntity> = {};
  (Object.keys(COLLECTION) as EntityType[]).forEach((t) => {
    for (const e of CAMPAIGN[COLLECTION[t]] as AnyEntity[]) out[`${t}:${e.id}`] = e;
  });
  return out;
})();
