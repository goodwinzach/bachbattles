// Character portraits (from the uploaded icon packs, shrunk by scripts/portraits.mjs).
// The build inlines each file as a data: URL, so the app stays one offline file.

import p_flynn from '../assets/portraits/flynn.webp';
import p_goodwin from '../assets/portraits/goodwin.webp';
import p_alex from '../assets/portraits/alex.webp';
import p_haydn from '../assets/portraits/haydn.webp';
import p_jamie from '../assets/portraits/jamie.webp';
import p_nerissa from '../assets/portraits/nerissa.webp';
import p_antinous from '../assets/portraits/antinous.webp';
import p_michael_pearson from '../assets/portraits/michael-pearson.webp';
import p_ray from '../assets/portraits/ray.webp';
import p_coach from '../assets/portraits/coach.webp';
import p_louise from '../assets/portraits/louise.webp';
import p_costello from '../assets/portraits/costello.webp';
import p_tyler from '../assets/portraits/tyler.webp';
import p_odysseus from '../assets/portraits/odysseus.webp';
import p_john_doe from '../assets/portraits/john-doe.webp';
import p_medusa from '../assets/portraits/medusa.webp';
import p_gladiators from '../assets/portraits/gladiators.webp';
import p_ted_terger from '../assets/portraits/ted-terger.webp';
import p_truman from '../assets/portraits/truman.webp';
import p_kingpin from '../assets/portraits/kingpin.webp';
import p_cypher from '../assets/portraits/cypher.webp';
import p_baron from '../assets/portraits/baron.webp';
import p_feyd from '../assets/portraits/feyd.webp';
import p_rabban from '../assets/portraits/rabban.webp';
import p_nathan_fielder from '../assets/portraits/nathan-fielder.webp';
import p_lou from '../assets/portraits/lou.webp';
import p_oh_dae_su from '../assets/portraits/oh-dae-su.webp';
import p_toothless from '../assets/portraits/toothless.webp';
import p_cat from '../assets/portraits/cat.webp';
import p_spider_mask from '../assets/portraits/spider-mask.webp';
import p_batman_cowl from '../assets/portraits/batman-cowl.webp';
import p_inkblot_mask from '../assets/portraits/inkblot-mask.webp';
import p_v_mask from '../assets/portraits/v-mask.webp';

export interface Portrait {
  key: string;
  src: string;
  label: string;
}

export const PORTRAITS: Portrait[] = [
  { key: 'flynn', src: p_flynn, label: 'Flynn' },
  { key: 'goodwin', src: p_goodwin, label: 'Forrest Gumpwin' },
  { key: 'alex', src: p_alex, label: 'Dude Bro' },
  { key: 'haydn', src: p_haydn, label: 'Master Oogwaydn' },
  { key: 'jamie', src: p_jamie, label: 'Jam Radish' },
  { key: 'nerissa', src: p_nerissa, label: 'Nerissa' },
  { key: 'antinous', src: p_antinous, label: 'Antinous' },
  { key: 'michael-pearson', src: p_michael_pearson, label: 'Michael Pearson' },
  { key: 'ray', src: p_ray, label: 'Ray' },
  { key: 'coach', src: p_coach, label: 'Coach' },
  { key: 'louise', src: p_louise, label: 'Louise Banks' },
  { key: 'costello', src: p_costello, label: 'Costello (heptapod)' },
  { key: 'tyler', src: p_tyler, label: 'Tyler Durden (Edward Norton)' },
  { key: 'odysseus', src: p_odysseus, label: 'Odysseus' },
  { key: 'john-doe', src: p_john_doe, label: 'John Doe' },
  { key: 'medusa', src: p_medusa, label: 'Medusa' },
  { key: 'gladiators', src: p_gladiators, label: 'The naked gladiators' },
  { key: 'ted-terger', src: p_ted_terger, label: 'Ted Terger' },
  { key: 'truman', src: p_truman, label: 'Truman Burbank' },
  { key: 'kingpin', src: p_kingpin, label: 'Kingpin' },
  { key: 'cypher', src: p_cypher, label: 'Cypher' },
  { key: 'baron', src: p_baron, label: 'Baron Harkonnen' },
  { key: 'feyd', src: p_feyd, label: 'Feyd-Rautha' },
  { key: 'rabban', src: p_rabban, label: 'Beast Rabban' },
  { key: 'nathan-fielder', src: p_nathan_fielder, label: 'Nathan Fielder' },
  { key: 'lou', src: p_lou, label: 'Lou Bloom' },
  { key: 'oh-dae-su', src: p_oh_dae_su, label: 'Oh Dae-su' },
  { key: 'toothless', src: p_toothless, label: 'Toothless' },
  { key: 'cat', src: p_cat, label: 'The Cat in the Hat' },
  { key: 'spider-mask', src: p_spider_mask, label: 'Spider-Man mask' },
  { key: 'batman-cowl', src: p_batman_cowl, label: 'Batman cowl' },
  { key: 'inkblot-mask', src: p_inkblot_mask, label: 'Inkblot (Rorschach) mask' },
  { key: 'v-mask', src: p_v_mask, label: 'V mask' },
];

export const PORTRAIT_SRC: Record<string, string> = Object.fromEntries(PORTRAITS.map((p) => [p.key, p.src]));

/** The portrait each player, character or item starts with. The DM can pick another in the editor. */
export const DEFAULT_PORTRAIT: Record<string, string> = {
  'pc:flynn': 'flynn',
  'pc:goodwin': 'goodwin',
  'pc:alex': 'alex',
  'pc:haydn': 'haydn',
  'pc:jamie': 'jamie',
  'npc:nerissa': 'nerissa',
  'npc:antinous': 'antinous',
  'npc:michael-pearson': 'michael-pearson',
  'npc:ray': 'ray',
  'npc:coach': 'coach',
  'npc:louise': 'louise',
  'npc:costello': 'costello',
  'npc:tyler': 'tyler',
  'npc:narrator': 'tyler',  // same body, same face: "Edward Norton, again"
  'npc:odysseus': 'odysseus',
  'npc:john-doe': 'john-doe',
  'npc:medusa': 'medusa',
  'npc:gladiator-1': 'gladiators',
  'npc:gladiator-2': 'gladiators',
  'npc:gladiator-3': 'gladiators',
  'npc:ted-terger': 'ted-terger',
  'npc:truman': 'truman',
  'npc:kingpin': 'kingpin',
  'npc:cypher': 'cypher',
  'npc:baron': 'baron',
  'npc:feyd': 'feyd',
  'npc:rabban': 'rabban',
  'npc:nathan-fielder': 'nathan-fielder',
  'npc:lou': 'lou',
  'npc:oh-dae-su': 'oh-dae-su',
  'npc:toothless': 'toothless',
  'npc:cat': 'cat',
  'item:spider-mask': 'spider-mask',
  'item:batman-cowl': 'batman-cowl',
  'item:inkblot-mask': 'inkblot-mask',
  'item:v-mask': 'v-mask',
  'item:medusa-head': 'medusa',
};
