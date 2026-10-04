// Location pictures (from the uploaded locations pack, cropped and shrunk by scripts/locations.mjs).
// The build inlines each file as a data: URL, so the app stays one offline file. Each location uses
// the picture with its own id unless its `picture` field says otherwise.

import l_green_dragon from '../assets/locations/green-dragon.webp';
import l_nz_field from '../assets/locations/nz-field.webp';
import l_shell from '../assets/locations/shell.webp';
import l_airfield from '../assets/locations/airfield.webp';
import l_harbor from '../assets/locations/harbor.webp';
import l_ship from '../assets/locations/ship.webp';
import l_island from '../assets/locations/island.webp';
import l_hollywood_harbor from '../assets/locations/hollywood-harbor.webp';
import l_volume from '../assets/locations/volume.webp';
import l_bagel_shop from '../assets/locations/bagel-shop.webp';

export const LOCATION_PICTURES: { key: string; src: string; label: string }[] = [
  { key: 'green-dragon', src: l_green_dragon, label: 'The Green Dragon Inn' },
  { key: 'nz-field', src: l_nz_field, label: 'A field in New Zealand' },
  { key: 'shell', src: l_shell, label: "Abbott and Costello's craft" },
  { key: 'airfield', src: l_airfield, label: 'The airfield' },
  { key: 'harbor', src: l_harbor, label: 'The harbor and docks' },
  { key: 'ship', src: l_ship, label: "Odysseus's ship" },
  { key: 'island', src: l_island, label: 'The seven deadly sins island' },
  { key: 'hollywood-harbor', src: l_hollywood_harbor, label: "Nathan Fielder's arrival dock" },
  { key: 'volume', src: l_volume, label: "Lou Bloom's Volume soundstage" },
  { key: 'bagel-shop', src: l_bagel_shop, label: 'The shop with the giant donut' },
];

export const LOCATION_PICTURE_SRC: Record<string, string> = Object.fromEntries(LOCATION_PICTURES.map((p) => [p.key, p.src]));
