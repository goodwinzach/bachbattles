// The places the story visits, each with its picture (src/data/location-pictures.ts). Scenes point at
// them with `location`, so a location knows which scenes happen there and who the party meets there.

import type { Location } from './types';

type LocationDef = Omit<Location, 'dmNote'>;
const location = (d: LocationDef): Location => ({ dmNote: '', ...d });

export const LOCATIONS: Location[] = [
  location({
    id: 'green-dragon',
    name: 'The Green Dragon Inn',
    icon: 'beer',
    kind: 'Pub',
    where: 'New Zealand',
    summary:
      "New Zealand's most infamous bar, and where the bachelor party happened. Owned by [[npc:michael-pearson]], who would like to talk about the floor.",
    describe: [
      'Low wooden beams, round windows and warm lamplight, even at noon.',
      'It smells like spilled ale, wood smoke and last night.',
      'A patch of floor paneling is cracked in a crater about the size of a sumo wrestler.',
      'Pool cues, brooms and mop handles lean in every corner (something for [[pc:haydn]] to pick up).',
    ],
    notes: ['Same room, two moods: a blur of fragments in the prologue, then the hungover morning after.'],
    films: ['lotr'],
  }),
  location({
    id: 'nz-field',
    name: 'The Field',
    icon: 'mountain-snow',
    kind: 'Open field',
    where: 'Somewhere in New Zealand',
    summary: 'Where the party wakes up: a sheep, a cold bonfire, five hungover friends and no ring.',
    describe: [
      'Bright, wide and painfully green. The snow-capped mountains are beautiful and do not care.',
      'The bonfire is cold ash, ringed with empty bottles.',
      "A sheep is chewing about two inches from [[pc:flynn]]'s face.",
    ],
  }),
  location({
    id: 'shell',
    name: 'The Shell',
    icon: 'orbit',
    kind: 'Alien craft',
    where: 'Above an empty field, in the middle of nowhere',
    summary: "[[npc:abbott]] and [[npc:costello]]'s bean-shaped craft. [[npc:louise]] brings the party here, and Flynn gets three questions.",
    describe: [
      'A huge dark shell hangs above the grass, perfectly still, as if someone set it down on the air.',
      'A scissor lift waits underneath it.',
      'Inside, gravity tilts sideways. A bright white haze, a wall of glass, and something enormous moving behind it.',
    ],
    notes: ['Keep it quiet and strange. The comedy here comes from the party, not the aliens.'],
    films: ['arrival'],
  }),
  location({
    id: 'airfield',
    name: 'The Airfield',
    icon: 'plane',
    kind: 'Small airfield',
    where: 'On the way out of nowhere',
    summary: 'The plane route. [[npc:tyler]] waits at the entrance, five goons step out of the hangar, and every plane is rigged.',
    describe: [
      'A row of small propeller planes outside a white hangar.',
      'Heat shimmer off the tarmac, and no one else around.',
      'The hangar door is open just wide enough for five people to walk out of it.',
    ],
    notes: ['Win or lose, the planes blow up. The road from here leads to the boats.'],
  }),
  location({
    id: 'harbor',
    name: 'The Harbor',
    icon: 'anchor',
    kind: 'Harbor and docks',
    where: 'On the coast',
    summary:
      "Where [[npc:odysseus]] is getting his ships ready. On the boat route, [[npc:tyler]] is waiting on the docks and every boat is rigged; on the plane route, it's where Odysseus offers the ride.",
    describe: [
      'Wooden docks crowded with rope, crates and barrels.',
      'Tall ships with patched sails knock against the pilings.',
      'Gulls, tar, salt, and the creak of a hundred ropes.',
    ],
  }),
  location({
    id: 'ship',
    name: "Odysseus's Ship",
    icon: 'sailboat',
    kind: 'Ship',
    where: 'At sea, heading west',
    summary: 'The voyage to California: time to share out the gear, get hungry, and spot an island.',
    describe: [
      'A long, low ship under a dark red sail, oars out.',
      "Odysseus's men row without complaint. They have clearly done this before. Many times.",
      'Open sea in every direction, and the sun right in your eyes.',
    ],
    films: ['the-odyssey'],
  }),
  location({
    id: 'island',
    name: 'The Island',
    icon: 'tree-palm',
    kind: 'Jungle island',
    where: 'Somewhere between New Zealand and California',
    summary:
      "[[npc:john-doe]]'s clearing, [[npc:medusa]]'s box, and seven stone buildings, one for each deadly sin. The food is in [[scene:gluttony]].",
    describe: [
      'Dense jungle and a narrow path that opens into a clearing.',
      'Seven stone buildings stand in a semicircle.',
      'In the middle, a bald man is packaging a small box.',
    ],
    notes: ['[[scene:pride]] is always the first room. After that, the players choose.'],
  }),
  location({
    id: 'hollywood-harbor',
    name: 'Hollywood Harbor',
    icon: 'clapperboard',
    kind: 'Marina',
    where: 'Hollywood, California',
    summary: 'Where the boat lands in California. [[npc:nathan-fielder]] and a camera crew are waiting, with a laptop.',
    describe: [
      'White yachts, pink bougainvillea and perfect sunshine. It looks like a commercial.',
      'A man with a laptop is waiting at the end of the dock, screen turned away.',
      'Camera crews. A lot of camera crews.',
    ],
  }),
  location({
    id: 'volume',
    name: 'The Volume',
    icon: 'video',
    kind: 'Soundstage',
    where: "Lou's movie studio, Hollywood",
    summary: "Lou's soundstage: a curved wall of LED screens and cameras on every side. The gauntlet and the finale both happen here.",
    describe: [
      'A giant curved wall of LED screens. Whatever it shows becomes the sky.',
      'Cameras on cranes and dollies, all pointed at the party.',
      'Cables, lights and rigging everywhere, and a green-screen wall at the far end.',
    ],
    notes: ['Everything in the room is a weapon or a hazard: cables, light stands, rigging, the screen itself.'],
  }),
  location({
    id: 'bagel-shop',
    name: 'The Bagel Shop',
    icon: 'bagel',
    kind: 'Bagel shop',
    where: 'Outside the studio, Hollywood',
    summary: 'Dawn after the finale. The last chance to bring friends back with the [[rule:bagel-rule]], then the way home.',
    describe: [
      'A squat little shop with a giant donut on the roof.',
      'The sign says DONUTS. Inside, they only sell bagels. Everything bagels.',
      'It is open, because Hollywood has no normal rules.',
    ],
    notes: ['The picture shows a donut shop on purpose: the giant donut is a lie.'],
    films: ['eeaao'],
  }),
];
