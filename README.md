# One Ring to Rule Flynn: DM console

A dungeon master's console for the bachelor-party one-shot *One Ring to Rule Flynn*. The whole campaign is in it (27 scenes in 10 pictured locations, 5 players, 42 characters with portraits, full profiles and dialogue options, 32 items, 14 abilities, clues, conditions, rules and the film references), laid out seven ways, and editable from any of them.

## Open it

**Online:** https://goodwinzach.github.io/bachbattles/ (GitHub Pages, served from `docs/index.html` on the default branch; every push updates it). It is public, so anyone with the link can read the DM secrets: do not send it to the players.

**Offline:** open `dist/index.html` in a browser. It is a single self-contained file (scripts, styles and portraits inlined), so it works offline and from a USB stick. The display fonts load from Google Fonts when online and fall back to system fonts otherwise.

Your progress saves automatically in that browser. Use **⋯ → Export save** before game night to keep a copy, and **Import save** to move your prep to another device.

## The seven views

| View | What it is for |
| --- | --- |
| **Run** | The live DM screen: the current scene's slate, location, read-aloud text, beats, rolls, failsafes and DM notes, a session timer, a spotlight tracker (who has waited longest for a moment), a "Previously on…" recap for after a break, the party with HP, stats, masks and abilities, and a combat tracker with initiative, attacks, damage and each fight's planned length. Scene widgets handle the special moments: Costello's three questions, the bill, the route, sharing out the gear on the voyage, Medusa's box, the sin rooms, the studio deaths, the unmasking and the bagel shop. |
| **Script** | The whole campaign as an organized script, act by act, with a table of contents, search, a read-aloud-only mode and expand/collapse for every section. Each scene keeps its original outline text. |
| **Map** | Three charts: the story flow (every scene and branch, pan and zoom), the connections web (who is tied to whom, which films they come from), and pacing (time spent against the 4 to 6 hour plan). On the story flow, click a scene to open it: a card with its location, Play, Script and Details, and a column of branches (location, objective, characters, fights, rolls, read-aloud, beats, if-they, loot, clues, notes). Click a branch to open its own branches off to the side, down to a character's dialogue lines or stat line. Every open node has a close button; Esc closes the last one, and several scenes can be open at once. Drag scenes (or their open cards) to rearrange the map; the layout is saved and "Put every scene back in place" resets it. Add sticky notes by double-clicking empty space, with the note button, or from an open scene: a note belongs to the nearest scene, moves with it, and also shows with that scene on the Run screen. |
| **Slides** | A presentation deck. The *Table* deck is safe to show players; the *DM* deck adds stats, secrets and notes. Player cast slides and character entrances use the portraits. Long read-alouds split across slides. Arrow keys to move, F for fullscreen, speaker notes optional. |
| **Cast** | A portrait gallery of every player and character, grouped by when the story introduces them, and a full profile page for each: portrait, the film or show they come from, personality and how to play them, lines to use, stats, the scenes they appear in, connections and what they carry. ← → page through the cast. |
| **Codex** | Cards for everything: party, characters, bestiary (stat blocks), locations, items grouped by owner or kind, abilities, clues, conditions and films. Search and filters on every tab. |
| **Rules** | The rules reference and DM craft, plus quick references built from the campaign: the party's live stats, a roll cheat sheet by scene and the fights in order. |

## Character profiles

Click any character's or player's name, anywhere (the script, the run screen, chips, cards, search results, the connections web), and their profile opens in a side panel: portrait, where they're from, what kind of character they are and where the party meets them, personality in a few words, what they want, what they know and do not know, how to play and perform them, lines to use, situations to be ready for, whether they are meant to be fought, stats and connections. Every character profile also has an "Improvising them" checklist for questions the script does not cover. **Full profile** opens it as a page in the Cast view, with its own link (for example `#cast/npc/lou`). Hovering a name shows a quick card with the portrait.

Portraits follow the game: ghosts fade, stone goes grey, defeated characters dim, and the mask a character is wearing shows as a badge (Flynn's current mask, the V mask on Lou while he is masked).

**Dialogue options:** every character has the situations that come up at the table (walking in, being asked about the ring, being pushed too far, losing a fight), each with a few interchangeable lines. Tap a line once you have said it so you do not repeat yourself, or press **Pick one** and let the dice choose an unused line. Each scene also has a **Dialogue options** panel with everyone in it, open by default in conversation scenes.

Some sources are spoilers. The guy who looks like Edward Norton is introduced as a man who does not know his own name; his real identity stays a DM secret, hidden by the spoiler shield, on gallery tiles and on the Table slides.

## Locations

Ten places, each with its picture: the Green Dragon Inn, the field, Abbott and Costello's craft, the airfield, the harbor, Odysseus's ship, the island, Hollywood Harbor, the Volume and the bagel shop. Every scene opens with its location as an establishing shot; click it for the location's page: what the party sees and hears when they get there, the scenes that happen there, who they meet and what they can find. The slides cut to a full-screen shot of the place whenever the story moves, the Codex has a Locations tab, and each character's profile shows where to find them. The phone call and the plane-or-boat decision have no fixed place, so they have no picture.

## At the table

The console keeps track of the house rules so the DM does not have to:

- **Fights have a plan.** Every fight lists how many rounds it should take and what ends it (Michael calls it off as soon as one of the three drops; first to three clean hits against Tyler). The combat tracker shows "Round 2 of 2–4", keeps the end condition in view and says when a fight has run past its plan.
- **Nobody dies before the island.** Until John Doe, 0 HP knocks a groomsman out cold; they are back at 1 HP when the scene ends. From the island on, 0 HP makes a ghost, and ghosts keep playing.
- **Bagels.** At Gluttony a living player eats a bagel and does something improbable in real life to bring one ghost back. Inside the Volume nobody comes back. At the bagel shop the bagels are free, and one random, stupid act from Flynn, in real life, brings everyone back in one tap.
- **The studio deaths.** Oh Dae-su, Toothless (outline version) and the Cat (expanded build) show who is still standing, a round-by-round guide, and a "Takes them out" button that turns a groomsman into a ghost whatever the dice said, with Undo.
- **Costello.** Each fact shows the question that usually pulls it out and his answer. The widget warns when two questions are gone without the riddle, and says when the third one ends the visit. Only Flynn's questions count.
- **The road.** "Done, next" at the crossroads waits for plane or boat. The sin rooms go Pride first, then one to three more at random, then Gluttony; finishing any sin room heads to Gluttony. On the voyage, a widget shares out the gear picked up so far.
- **A spoiler-safe deck.** Surprise entrances (Medusa), the riddle and the +100 Charisma reveal stay on the DM deck until they happen in play.

## Editing

Press **Edit** in the top bar (or `E`). Every state badge becomes a picker: item states (held, equipped, lost, enemy has it…), who holds an item, ability states, character status, scene status, clues and conditions. Click any name to open its drawer, whose **Edit** tab changes the text itself: names, read-alouds, stat blocks, DCs, notes.

Each character's editor also has a **Portrait** picker, a **From** field and **Dialogue options** (add situations and lines). Every change shows up everywhere at once. Lose the Spider-Man mask and Spider-Sense locks on the Run screen, in the Codex and in every mention in the script; rename a character and every reference updates. Edited fields show a dot and a one-click "original" reset.

- Undo and redo: `Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z`, or the arrows in the top bar. **⋯ → History** lists every change.
- **Mentioned in** (drawer tab) lists every place something is referenced.
- **New item** and **New character** buttons live in the Codex.

## Campaign options (⋯ → Settings)

- **Studio gauntlet:** *Outline version* (default, from the Latest outline: Oh Dae-su kills at least two players and Toothless wipes everyone but Flynn) or *Expanded build* (softer, adds the Cat in the Hat as the wipe). The script, map, slides and run screen all follow the choice.
- **Route to Hollywood:** plane or boat, once the players pick. The other route's scenes are skipped everywhere.
- **Spoiler shield** (`H`): hides DM secrets before you share your screen.

## Keyboard

`Ctrl/⌘ K` or `/` search everything · `1`–`7` switch views · `E` edit mode · `H` spoiler shield · `D` dice tray · `]` / `[` next or previous scene (Run) · `←` `→` slides · `F` fullscreen slides · `Esc` close (on the story flow: the last opened node) · `?` all shortcuts

Every DC in the text is clickable and opens the dice tray preset to it; every dice expression (like `1d8`) rolls when clicked.

## Development

```sh
npm install
npm run build      # writes dist/index.html, and docs/index.html for the website
npm run dev        # rebuilds on change
npm test           # typecheck, data validation, build, then a browser smoke test
node scripts/portraits.mjs <folder>   # rebuild src/assets/portraits from the original icon PNGs
node scripts/locations.mjs <folder>   # rebuild src/assets/locations from the original location PNGs
```

The portraits come from the two character icon packs (1000 px PNGs). `scripts/portraits.mjs` shrinks them to 400 px WebP files (about 18 KB each, under 600 KB for all 33) and maps each file to a player, character or mask; `src/data/portraits.ts` says who uses which by default. The location pictures come from the locations pack: `scripts/locations.mjs` crops away their transparent frame and converts them to WebP (about 500 KB for all ten); `src/data/location-pictures.ts` lists them.

The smoke test drives Chromium through every view at phone and desktop sizes in both themes, then exercises editing, undo, reload persistence, search, dice and the gauntlet switch. It uses `playwright-core` without downloading a browser; point `CHROMIUM_PATH` at a Chromium binary if it is not at `/opt/pw-browsers/chromium`.

```
src/data/     the campaign: scenes.ts (acts, scenes, pacing), cast.ts (players, characters, relations),
              dialogue.ts (dialogue options), locations.ts, things.ts (items, abilities, conditions, clues),
              rules.ts (rules, films), portraits.ts, location-pictures.ts, types.ts
src/assets/   portraits and location pictures (WebP), inlined by the build
src/state/    store (base data + an edit layer, undo/redo), derive (effective stats, ability locks,
              backlinks), actions, dice, persist (localStorage, optional claude.ai sync)
src/ui/       shell, drawer, profiles (profile.tsx), editor, rich text (live [[type:id]] references), dice, palette
src/ui/views/ run, story (Script), map, slides, cast, codex, rules
src/styles/   tokens and per-area stylesheets
```

Text in the data files can link to anything with `[[npc:lou]]` or `[[item:spider-mask|the mask]]`, make a clickable check with `{{cha:12}}`, or a clickable roll with `{{1d8}}`.

## Sources

The story spine follows the campaign outline and the Latest DM handoff. Character portraits come from the two character icon packs, and the profiles draw on the complete character reference (types, locations, knowledge, performance notes, dialogue prompts and contingencies). Stats, abilities, DCs, the ghost and bagel rules, pacing and NPC performance notes come from the comprehensive DM build. Each scene keeps its original outline text under "Original outline".
