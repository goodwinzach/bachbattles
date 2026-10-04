// Turns the original character icons (1000px PNGs, ~1.5 MB each) into the small WebP portraits the
// app inlines (src/assets/portraits/<key>.webp, 400px, ~15 KB each). Needs ffmpeg with libwebp.
// Usage: node scripts/portraits.mjs <folder with the original PNGs>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** original file name (without .png) → portrait key used in src/data/portraits.ts */
export const SOURCES = {
  Flynn_Original_The_Groom: 'flynn',
  Forrest_Gumpwin_Forrest_Gump: 'goodwin',
  Dude_Bro_The_Big_Lebowski: 'alex',
  Master_Oogwaydn_Kung_Fu_Panda: 'haydn',
  Jam_Radish_Spirited_Away: 'jamie',
  Antinous_The_Odyssey: 'antinous',
  Nerissa_Original_NPC: 'nerissa',
  Michael_Pearson_The_Gentlemen: 'michael-pearson',
  Ray_The_Gentlemen: 'ray',
  Coach_The_Gentlemen: 'coach',
  Louise_Banks_Arrival: 'louise',
  Costello_Arrival: 'costello',
  Tyler_Durden_Fight_Club: 'tyler',
  Odysseus_The_Odyssey: 'odysseus',
  John_Doe_Se7en: 'john-doe',
  Medusa_Greek_Mythology: 'medusa',
  Naked_Gladiators_Gladiator: 'gladiators',
  Ted_Terger_Stitched: 'ted-terger',
  Truman_Burbank_The_Truman_Show: 'truman',
  Kingpin_Into_the_Spider_Verse: 'kingpin',
  Cypher_The_Matrix: 'cypher',
  Baron_Vladimir_Harkonnen_Dune_Part_Two: 'baron',
  Feyd_Rautha_Harkonnen_Dune_Part_Two: 'feyd',
  Beast_Rabban_Dune_Part_Two: 'rabban',
  Nathan_Fielder_Nathan_For_You: 'nathan-fielder',
  Lou_Bloom_Nightcrawler: 'lou',
  Oh_Dae_su_Oldboy: 'oh-dae-su',
  Toothless_How_to_Train_Your_Dragon: 'toothless',
  The_Cat_in_the_Hat_The_Cat_in_the_Hat: 'cat',
  Spider_Man_Spider_Man: 'spider-mask',
  Batman_Batman: 'batman-cowl',
  Rorschach_Watchmen: 'inkblot-mask',
  V_V_for_Vendetta: 'v-mask',
};

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/portraits.mjs <folder with the original PNGs>');
  process.exit(1);
}
const out = 'src/assets/portraits';
mkdirSync(out, { recursive: true });

const files = readdirSync(src).filter((f) => f.toLowerCase().endsWith('.png') && !f.startsWith('._'));
const unknown = files.filter((f) => !SOURCES[f.replace(/\.png$/i, '')]);
if (unknown.length) console.warn(`No key for: ${unknown.join(', ')} (add them to SOURCES)`);

let total = 0;
for (const f of files) {
  const key = SOURCES[f.replace(/\.png$/i, '')];
  if (!key) continue;
  const dest = join(out, `${key}.webp`);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', join(src, f),
    '-vf', 'scale=400:400:flags=lanczos',
    '-c:v', 'libwebp', '-lossless', '0', '-quality', '80', '-compression_level', '6',
    '-pix_fmt', 'yuva420p',
    dest,
  ]);
  total += statSync(dest).size;
}
const missing = Object.entries(SOURCES).filter(([name]) => !files.includes(`${name}.png`)).map(([, key]) => key);
console.log(`wrote ${files.length - unknown.length} portraits to ${out} (${Math.round(total / 1024)} KB)`);
if (missing.length) console.warn(`not in the folder: ${missing.join(', ')}`);
