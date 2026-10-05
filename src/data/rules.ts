import type { Film, Rule } from './types';

type RuleDef = Omit<Rule, 'dmNote'>;
const rule = (d: RuleDef): Rule => ({ dmNote: '', ...d });

/** Safe, silly real-life stunts for a bagel revival, when the table runs out of ideas. */
export const STUNTS: string[] = [
  'Put your shoes on the wrong feet and keep them that way until the next scene.',
  'Tell the player on your left, completely sincerely, that you love them.',
  'Ten jumping jacks while saying the alphabet backwards.',
  'Talk like a pirate until your next turn.',
  'Swap one piece of clothing with another player.',
  'Balance a spoon on your nose for five seconds.',
  'Drink a glass of water while standing on one leg.',
  'Pitch the documentary as Lou Bloom for thirty seconds.',
  'Eat a spoonful of mustard, or the worst condiment in the fridge.',
  'Hum the Jaws theme while slowly circling the table.',
  'A slow-motion action-movie dive onto the couch.',
  'Name ten Pixar movies in thirty seconds.',
  'Wear your shirt inside out for the rest of the game.',
  'Give a thirty-second wedding toast to a household object.',
  'Hop on one foot to the kitchen and back.',
  'Let the table draw a mustache on you (washable marker only).',
  'Call someone and sing them happy birthday, whatever the date.',
  'Spin around ten times, then walk a straight line.',
  'Try to lick your elbow for ten full seconds.',
  'Speak only in rhymes until the next ghost comes back.',
  'Act out a dramatic Shakespearean death, then come back to life.',
  'Narrate everything you do in the third person until your next turn.',
];

export const RULE_GROUPS: { id: Rule['group']; title: string; blurb: string }[] = [
  { id: 'core', title: 'Core Rules', blurb: 'What gets rolled and how hard it is.' },
  { id: 'combat', title: 'Combat', blurb: 'Initiative, turns, range bands, weapons.' },
  { id: 'conditions', title: 'Conditions & Healing', blurb: 'Hangover, hunger and the feast.' },
  { id: 'death', title: 'Death & Bagels', blurb: 'Ghosts keep playing. Bagels bring them back.' },
  { id: 'secrets', title: 'DM Secrets', blurb: 'Never read these out loud.' },
  { id: 'craft', title: 'Running the Night', blurb: 'Improvising, pacing, and keeping the spine intact.' },
];

export const RULES: Rule[] = [
  // ── Core ────────────────────────────────────────────────
  rule({
    id: 'golden-rules',
    group: 'core',
    title: 'The Three DM Rules',
    summary: 'Keep it moving. Failure creates trouble, not dead ends. Protect the story beats, not the route.',
    list: [
      '**Keep it moving.** If a scene has stopped being funny, dangerous, revealing or useful, push forward.',
      '**Failure should usually create trouble, not a dead end.** If the players need a clue to continue, give it to them even on a bad roll, but attach a consequence.',
      '**Protect the required story beats, not the exact route.** The party must get the ring, reach Hollywood by boat, survive the island, be wiped except Flynn, and reach Flynn vs. Lou. How they get there can be chaotic.',
    ],
    body: [
      'This is not normal D&D. It uses familiar mechanics (dice, combat, stats, weapons, initiative, crits, stupid plans) without classes, spell slots, proficiencies or reactions.',
      'The campaign should feel like a movie the players are allowed to wreck. The DM\'s job is not to stop stupid ideas; it is to decide what roll the idea needs, what it costs, and how the story reacts.',
    ],
  }),
  rule({
    id: 'the-roll',
    group: 'core',
    title: 'What Players Roll',
    summary: 'Almost every uncertain action is **d20 + stat modifier vs. a Difficulty Class (DC)**.',
    body: [
      'Players roll dice throughout the game.',
      'Do not make players roll for obvious actions. If there is no interesting failure, just let it happen.',
    ],
    table: {
      head: ['Stat', 'Used for'],
      rows: [
        ['**Strength**', 'Punching, wrestling, lifting, breaking, forcing doors, throwing heavy objects'],
        ['**Agility**', 'Running, dodging, jumping, balancing, sneaking, physical stunts'],
        ['**Charisma**', 'Persuasion, lying, flirting, intimidation, distracting, performance'],
        ['**Perception**', 'Noticing danger, clues, people, traps, hidden details'],
        ['**Intelligence**', 'Reasoning, remembering, investigating, understanding systems or plans'],
      ],
    },
  }),
  rule({
    id: 'dc-ladder',
    group: 'core',
    title: 'Difficulty Classes',
    summary: 'Pick 8, 10, 12, 15, 18 or 20.',
    table: {
      head: ['DC', 'Difficulty', 'Meaning'],
      rows: [
        ['8', 'Easy', 'Most people could do it under pressure'],
        ['10', 'Standard', 'Requires a little competence'],
        ['12', 'Tricky', 'A real chance of failure'],
        ['15', 'Hard', 'Needs skill, luck, or a good plan'],
        ['18', 'Very hard', 'Impressive if they pull it off'],
        ['20+', 'Ridiculous', 'Possible because this campaign is stupid enough to allow it'],
      ],
    },
  }),
  rule({
    id: 'advantage',
    group: 'core',
    title: 'Advantage & Disadvantage',
    summary: 'Roll 2d20. Advantage keeps the higher, disadvantage the lower. They never stack.',
    list: [
      '**Advantage:** roll {{2d20}} and take the higher result.',
      '**Disadvantage:** roll {{2d20}} and take the lower result.',
      'Do not stack multiple advantages. Two sources of advantage are still just advantage.',
    ],
  }),
  rule({
    id: 'crits',
    group: 'core',
    title: 'Critical Rolls',
    summary: 'Natural 20: success plus one extra benefit. Natural 1: failure plus a complication.',
    list: [
      '**Natural 20:** the action succeeds and gains one extra benefit.',
      '**Natural 1:** the action fails and creates a funny or harmful complication.',
      'A natural 1 should not automatically kill somebody.',
      'A natural 20 should not let somebody skip Hollywood, defeat the Cat, or erase a required story beat.',
    ],
  }),
  rule({
    id: 'consequence',
    group: 'core',
    title: 'Success with a Consequence',
    summary: 'When a failed roll would stall the campaign, give them what they need and attach a cost.',
    list: [
      'They find the clue, but the bartender also calls Michael Pearson.',
      'They break the lock, but the noise alerts the goons.',
      'They make the jump, but drop a weapon.',
      'They convince the NPC, but owe them something.',
      'They dodge the first needle, but the camera crew fires again and knocks them out anyway.',
    ],
    body: ['Use normal failure when failure itself is funny, dangerous, or creates a new playable situation.'],
  }),

  // ── Combat ──────────────────────────────────────────────
  rule({
    id: 'initiative',
    group: 'combat',
    title: 'Initiative',
    summary: 'Every player rolls **d20 + Agility**. The DM rolls once per enemy or enemy group. Keep the order all fight.',
  }),
  rule({
    id: 'a-turn',
    group: 'combat',
    title: 'A Turn',
    summary: 'One movement and one action. No bonus actions or reactions unless an ability says so.',
    list: [
      'Attack',
      'Use a special ability',
      'Interact with something important',
      'Help another player',
      'Attempt a stunt',
      'Use an item',
      'Persuade or intimidate, if it makes sense mid-fight',
    ],
  }),
  rule({
    id: 'range',
    group: 'combat',
    title: 'Range Bands',
    summary: 'Do not measure feet. One movement changes one band.',
    table: {
      head: ['Range', 'Meaning'],
      rows: [
        ['**Close**', 'Within grabbing, punching, stabbing distance'],
        ['**Nearby**', 'Across the room, a short sprint away'],
        ['**Far Away**', 'Across a large space, a rooftop, a long room, the opposite side of the battlefield'],
      ],
    },
  }),
  rule({
    id: 'attacking',
    group: 'combat',
    title: 'Attacking',
    summary: 'Roll **d20 + attack modifier vs. the target\'s AC**. Meet or beat it and roll damage.',
    list: ['Heavy melee: Strength.', 'Quick melee or a precise weapon: Agility.', 'Improvised throw: Strength or Agility, depending on how it is used.'],
    body: ['All players are intentionally close in durability: **AC 14, HP 32**. Differences come from abilities.'],
  }),
  rule({
    id: 'weapons',
    group: 'combat',
    title: 'Weapon Categories',
    summary: 'Four damage tiers. Guns trade damage for range; shields add +1 AC.',
    table: {
      head: ['Weapon', 'Damage', 'Examples'],
      rows: [
        ['Unarmed / tiny improvised', '{{1d4}}', 'Punch, slap, mug, rock'],
        ['Light weapon', '{{1d6}}', 'Dagger, small knife, taser, bottle'],
        ['Normal weapon', '{{1d8}}', 'Sword, crowbar, machete, staff, bow, pistol'],
        ['Heavy weapon', '{{1d10}}', 'Sledgehammer, chainsaw, heavy hammer, lightning rifle'],
      ],
    },
    list: [
      '**Guns:** pistols deal {{1d8}} and can attack from Far Away. Their advantage is range, not damage. Each of the Gentlemen\'s pistols has **6 shots**.',
      '**Shields:** a held shield gives **+1 AC** until dropped.',
      '**Help:** spend your action helping someone Close or Nearby; they get advantage on their next relevant roll.',
    ],
  }),
  rule({
    id: 'zero-hp',
    group: 'combat',
    title: 'Zero HP',
    summary: 'There are no death saves. At 0 HP a character immediately dies and becomes a ghost.',
    body: ['See [[rule:ghosts]]. [[pc:flynn]] is the exception until the finale: [[ability:plot-armor]].'],
  }),

  // ── Conditions ─────────────────────────────────────────
  rule({
    id: 'hangover-hunger',
    group: 'conditions',
    title: 'Hangover & Hunger',
    summary: '[[cond:hangover]]: −2 CHA and −2 PER from the start. [[cond:hunger]]: −2 AGI at sea. Both end at the feast.',
    body: [
      'Do not pile on additional small hangover rules. The joke works because the penalty is obvious and annoying.',
      'Hunger stacks with the hangover until the party eats in [[scene:gluttony]].',
    ],
  }),
  rule({
    id: 'healing',
    group: 'conditions',
    title: 'Major Healing',
    summary: 'The feast in Gluttony is the one full recovery. Damage should matter.',
    list: [
      'Every living player returns to full HP.',
      'Hangover and Hunger end.',
      'The party obtains five [[item:bagels]].',
      'Other healing should be rare and small, only when an improvised story moment strongly justifies it.',
    ],
  }),

  // ── Death ──────────────────────────────────────────────
  rule({
    id: 'ghosts',
    group: 'death',
    title: 'The Stitched Rule: Ghosts',
    summary: 'At 0 HP a player dies but stays in the game as a ghost who looks completely real.',
    list: [
      'Looks completely real unless someone already knows they died.',
      'Can speak and move normally, and can be seen by players and enemies.',
      'Can be attacked by enemies, but cannot be physically injured.',
      'Cannot physically attack or move normal objects.',
      'Can distract, lie to, taunt, scare, confuse, scout or misdirect.',
      'Can make Charisma, Perception and Intelligence rolls. No meaningful Strength or weapon attacks.',
    ],
    body: [
      'Enemies may not realize a character is dead. A ghost can bait attacks, stand in the wrong place, scream fake warnings, or pretend to be an active threat. Reward this.',
      'If a ghost tries something clever, roll normally with CHA, PER or INT. High: the enemy believes the ghost is still physically relevant and wastes attention or an action. Low: the enemy realizes something is wrong, or simply ignores them.',
    ],
    films: ['stitched'],
  }),
  rule({
    id: 'out-cold',
    group: 'death',
    title: 'Before the Island: Out Cold',
    summary: 'Until the party reaches John Doe\'s island, 0 HP knocks a player out instead of killing them.',
    list: [
      'A player at 0 HP before [[scene:john-doe]] is out cold, not dead.',
      'They come back at 1 HP when the scene ends (the console does this when you press "Done, next").',
      'From the island on, 0 HP means death and the ghost rules apply.',
    ],
    body: ['Bagels only turn up in [[scene:gluttony]], so an early death would leave a player as a ghost for two hours. Knock them out instead and keep the stakes for the island.'],
  }),
  rule({
    id: 'bagel-rule',
    group: 'death',
    title: 'The Bagel Rule',
    summary: 'A bagel plus a statistically improbable real-life action brings a ghost back at full HP.',
    list: [
      'A living player eats a bagel.',
      'That player performs a **statistically improbable action in real life**: genuinely stupid, unlikely, absurd or socially ridiculous. It must be done in person.',
      'The DM decides whether it qualifies.',
      'If it does, the bagel works and the ghost returns physically at full HP.',
    ],
    body: [
      'The bagel alone does nothing. It is an everything bagel, as in *Everything Everywhere All at Once*: the improbable act is what makes it work, like a verse jump.',
      'Bagels do not work inside the Volume: the studio is fake, and the improbable act needs the real world. Revivals wait for the bagel shop, where Flynn brings his friends back one stupid act at a time.',
      'No dice roll is required for the real-world action. The point is committing to the bit.',
      'Examples should come from the room and the people playing, not a prewritten checklist.',
    ],
    films: ['eeaao'],
  }),

  // ── Secrets ────────────────────────────────────────────
  rule({
    id: 'secret-unmasked',
    group: 'secrets',
    secret: true,
    title: 'Unmasked Flynn',
    summary: 'The instant Flynn voluntarily removes his mask, his Charisma becomes **+100**.',
    body: ['See [[ability:unmasked]]. Do not explain it early, and do not prevent him from discovering it early.'],
  }),
  rule({
    id: 'secret-plot-armor',
    group: 'secrets',
    secret: true,
    title: 'Plot Armor',
    summary: 'Flynn is required for the ending. He survives at 1 HP until the Lou finale.',
    body: ['See [[ability:plot-armor]]. Never announce it.'],
  }),
  rule({
    id: 'secret-v-mask',
    group: 'secrets',
    secret: true,
    title: 'The Fourth Mask',
    summary: 'The missing mask is the [[item:v-mask]]. Lou has it and wears it in the finale.',
    body: ['Do not reveal it until Lou enters.'],
  }),
  rule({
    id: 'secret-wipe',
    group: 'secrets',
    secret: true,
    title: 'The Wipe',
    summary: 'Everyone except Flynn must be dead before Lou enters.',
    body: [
      '[[npc:oh-dae-su]] takes one groomsman. [[npc:toothless]] takes a few more. [[npc:cat]] comes after Toothless and takes whoever is left.',
      'The Cat is not a fair boss; he is the wipe mechanism and the DM\'s big character moment.',
    ],
  }),

  // ── Craft ──────────────────────────────────────────────
  rule({
    id: 'improv',
    group: 'craft',
    title: 'When Players Do Something Unplanned',
    summary: 'Possible? Which stat? Pick a DC. Roll. Decide whether failure is fun.',
    list: [
      'Is it physically or socially possible in this stupid universe?',
      'Which of the five stats fits best?',
      'Pick DC 8, 10, 12, 15, 18 or 20.',
      'Let them roll.',
      'On failure, decide whether failure is fun or whether success-with-consequence keeps things moving.',
    ],
  }),
  rule({
    id: 'npc-performance',
    group: 'craft',
    title: 'Playing the NPCs',
    summary: 'Recognizable energy, not impressions. Background characters get one attitude; major ones need to be known cold.',
    body: [
      'You are not expected to imitate actors. If you know calm or loud, warm or cold, awkward or confident, sincere or manipulative, violent or avoidant, that is enough.',
      'Suggested lines are prompts. Rewrite them naturally, and never stop the game to look up an exact movie quote. The campaign version of a character beats strict movie canon.',
    ],
    table: {
      head: ['Kind of character', 'What you need'],
      rows: [
        ['Background: the bartender, suitors, goons, camera crew, Odysseus\'s men', 'One clear attitude, one goal, one memorable detail. Short conversations, no subplots.'],
        ['Major: Lou, Louise, Costello, Tyler, Odysseus, John Doe, Nathan Fielder', 'What they want, what they know, what they refuse to give, how they sound, and which story beat they must deliver.'],
      ],
    },
  }),
  rule({
    id: 'npc-questions',
    group: 'craft',
    title: 'When a Player Asks an NPC Something Unexpected',
    summary: 'What do they want? What do they realistically know? Answer from that, and never invent major lore by accident.',
    list: [
      'Ask yourself what the character wants.',
      'Ask what the character realistically knows.',
      'Answer from that.',
      'Do not create major new lore by accident.',
      'If the answer would change the campaign, keep it vague, steer back to established information, or say the character does not know.',
    ],
  }),
  rule({
    id: 'skipping',
    group: 'craft',
    title: 'When Players Try to Skip a Required Route',
    summary: 'Never just say "you cannot." Give the attempt a funny outcome that returns them to the spine.',
    table: {
      head: ['Attempt', 'What happens'],
      rows: [
        ['Alex tries to fly to Hollywood', 'One magnificent airborne turn, then the effect ends over the harbor and he drops back onto the boat or dock.'],
        ['Goodwin uses Gump Luck to find Hollywood directly', 'He accidentally finds a sign, map or person that points toward Odysseus instead.'],
        ['They steal a random boat without Odysseus', 'They sail for hours and return to the same coastline, or realize they are lost. Odysseus is still the useful option.'],
        ['They kill a clue NPC', 'Put the clue on their phone, in the environment, or in another NPC\'s mouth.'],
      ],
    },
  }),
  rule({
    id: 'brilliant-plans',
    group: 'craft',
    title: 'When They Make a Brilliant Plan',
    summary: 'Let it matter, but do not let it erase the campaign.',
    list: ['Avoid damage', 'Give advantage', 'Shorten a fight', 'Steal a weapon', 'Turn an enemy against another enemy', 'Reveal a clue early'],
  }),
  rule({
    id: 'pacing',
    group: 'craft',
    title: 'Pacing a 4 to 6 Hour Night',
    summary: 'Cut background conversations and extra sin rooms first. Never cut the spine.',
    table: {
      head: ['If running long, cut', 'Never cut', 'If running short, add'],
      rows: [
        ['Background bar conversations', "Costello's riddle", 'One more sin room'],
        ['Extra sin rooms', 'John Doe / Medusa', 'More roleplay with Antinous or Nerissa'],
        ['Goon HP', 'Pride first', 'A longer Tyler confrontation'],
        ['Oh Dae-su HP', 'Gluttony / bagels', 'Truman trying to follow the party'],
        ['Toothless HP', 'The wipe, Flynn unmasking, the Lou finale', 'More studio environmental stunts'],
      ],
    },
    body: ['Do not invent a whole side quest.'],
  }),
  rule({
    id: 'reminders',
    group: 'craft',
    title: 'Final DM Reminders',
    summary: 'The short list to re-read right before the game.',
    list: [
      "Do not explain Flynn's +100 Charisma early.",
      'Do not let Bong Flight skip the boat.',
      "Goodwin's luck should feel like absurd coincidence, not generic magic.",
      'Mention staff-like objects so Oogwaydn can scavenge them.',
      "Jamie's Spiritual Moment should respond to the current scene, not summon a random fantasy inventory.",
      'The island is where death becomes acceptable. Dead players stay engaged as visible ghosts.',
      'Gluttony is the major heal and bagel checkpoint.',
      'Oh Dae-su takes one groomsman and Toothless a few more; the Cat is the wipe.',
      'Flynn must get the final victory over Lou.',
      "If players are confused in the Lou scene, use Louise's text. Do not immediately explain the answer.",
      'If a required clue is missed, move the clue. Never let the campaign die because somebody rolled badly.',
      'If something is funnier than the written suggestion and does not destroy the story, use the funnier thing.',
    ],
  }),
];

export const FILMS: Film[] = [
  // Flynn's favorite movies (from the outline)
  { id: 'nightcrawler', title: 'Nightcrawler', favorite: true },
  { id: 'truman-show', title: 'The Truman Show', favorite: true },
  { id: 'the-odyssey', title: 'The Odyssey', favorite: true },
  { id: 'fight-club', title: 'Fight Club', favorite: true },
  { id: 'stitched', title: 'Stitched', favorite: true },
  { id: 'arrival', title: 'Arrival', favorite: true },
  { id: 'gladiator', title: 'Gladiator', favorite: true },
  { id: 'spider-verse', title: 'Into the Spider-Verse', favorite: true },
  { id: 'eeaao', title: 'Everything Everywhere All at Once', favorite: true, note: 'The everything bagel, and the statistically improbable actions that power the Bagel Rule.' },
  { id: 'the-matrix', title: 'The Matrix', favorite: true },
  { id: 'the-gentlemen', title: 'The Gentlemen', favorite: true },
  { id: 'whiplash', title: 'Whiplash', favorite: true },
  { id: 'v-for-vendetta', title: 'V for Vendetta', favorite: true },
  { id: 'akira', title: 'Akira', favorite: true },
  { id: 'shawshank', title: 'The Shawshank Redemption', favorite: true },
  { id: 'interstellar', title: 'Interstellar', favorite: true },
  { id: 'boy', title: 'Boy', favorite: true },
  { id: 'dune-2', title: 'Dune: Part Two', favorite: true },
  { id: 'memento', title: 'Memento', favorite: true },
  { id: 'httyd', title: 'How to Train Your Dragon', favorite: true, note: 'The original animated film.' },
  // Other references in the campaign
  { id: 'se7en', title: 'Se7en', favorite: false },
  { id: 'oldboy', title: 'Oldboy', favorite: false },
  { id: 'cat-in-the-hat', title: 'The Cat in the Hat', favorite: false },
  { id: 'the-rehearsal', title: 'The Rehearsal', favorite: false, note: 'Nathan Fielder.', kind: 'series' },
  { id: 'nathan-for-you', title: 'Nathan for You', favorite: false, note: 'Nathan Fielder.', kind: 'series' },
  { id: 'big-lebowski', title: 'The Big Lebowski', favorite: false, note: 'Dude Bro.' },
  { id: 'spirited-away', title: 'Spirited Away', favorite: false },
  { id: 'kung-fu-panda', title: 'Kung Fu Panda', favorite: false },
  { id: 'forrest-gump', title: 'Forrest Gump', favorite: false },
  { id: 'lotr', title: 'The Lord of the Rings', favorite: false, note: 'The Green Dragon Inn, and the title.' },
  { id: 'deadpool-wolverine', title: 'Deadpool & Wolverine', favorite: false },
  { id: 'batman', title: 'Batman', favorite: false },
  { id: 'watchmen', title: 'Watchmen', favorite: false },
  { id: 'greek-myth', title: 'Greek mythology', favorite: false, note: 'Medusa.', kind: 'myth' },
];
