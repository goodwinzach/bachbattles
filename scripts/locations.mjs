// Turns the original location pictures (960x540 PNGs, ~1 MB each) into the WebP files the app
// inlines (src/assets/locations/<key>.webp, ~60 KB each). The originals sit in a transparent frame
// with rounded corners, so this crops to the photo; the app rounds its own corners. Needs ffmpeg
// with libwebp.
// Usage: node scripts/locations.mjs <folder with the original PNGs>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** original file name (without .png) → location id in src/data/locations.ts */
export const SOURCES = {
  The_Green_Dragon_Inn: 'green-dragon',
  New_Zealand_Field: 'nz-field',
  Abbott_and_Costello_Spaceship: 'shell',
  Airport_Airfield: 'airfield',
  Harbor_Docks: 'harbor',
  Odysseus_Ship: 'ship',
  Seven_Deadly_Sins_Island: 'island',
  Nathan_Fielder_Arrival_Area: 'hollywood-harbor',
  Lou_Bloom_Movie_Studio_Volume_Soundstage: 'volume',
  Donut_Shop: 'bagel-shop', // a giant donut on the roof; inside, only bagels
};

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/locations.mjs <folder with the original PNGs>');
  process.exit(1);
}
const out = 'src/assets/locations';
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
    // the photo inside the 960x540 frame is 908x478 at (26,31); 8 px more on each side clears the rounded corners
    '-vf', "crop=892:462:34:39,scale='min(960,iw)':-2:flags=lanczos",
    '-c:v', 'libwebp', '-lossless', '0', '-quality', '78', '-compression_level', '6', '-pix_fmt', 'yuv420p',
    dest,
  ]);
  total += statSync(dest).size;
}
console.log(`wrote ${files.length - unknown.length} location pictures to ${out} (${Math.round(total / 1024)} KB)`);
