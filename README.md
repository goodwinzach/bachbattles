# One Ring to Rule Flynn: DM console

A dungeon master's console for the bachelor-party one-shot *One Ring to Rule Flynn*. The whole campaign is in it (27 scenes, 5 players, 40 characters, 32 items, 14 abilities, clues, conditions, rules and the film references), laid out six ways, and editable from any of them.

## Open it

Open `dist/index.html` in a browser. It is a single self-contained file (scripts and styles inlined), so it works offline and from a USB stick. The display fonts load from Google Fonts when online and fall back to system fonts otherwise.

Your progress saves automatically in that browser. Use **⋯ → Export save** before game night to keep a copy, and **Import save** to move your prep to another device.

## The six views

| View | What it is for |
| --- | --- |
| **Run** | The live DM screen: the current scene's slate, read-aloud text, beats, rolls, failsafes and DM notes, the wedding clock, the party with HP, stats, masks and abilities, and a combat tracker with initiative, attacks and damage. |
| **Script** | The whole campaign as an organized script, act by act, with a table of contents, search, a read-aloud-only mode and expand/collapse for every section. Each scene keeps its original outline text. |
| **Map** | Three charts: the story flow (every scene and branch, pan and zoom), the connections web (who is tied to whom, which films they come from), and pacing (time spent against the 4 to 6 hour plan, plus the wedding clock). |
| **Slides** | A presentation deck. The *Table* deck is safe to show players; the *DM* deck adds stats, secrets and notes. Long read-alouds split across slides. Arrow keys to move, F for fullscreen, speaker notes optional. |
| **Codex** | Cards for everything: party, characters, bestiary (stat blocks), items grouped by owner or kind, abilities, clues, conditions and films. Search and filters on every tab. |
| **Rules** | The rules reference and DM craft, plus quick references built from the campaign: the party's live stats, a roll cheat sheet by scene and the fights in order. |

## Editing

Press **Edit** in the top bar (or `E`). Every state badge becomes a picker: item states (held, equipped, lost, enemy has it…), who holds an item, ability states, character status, scene status, clues and conditions. Click any name to open its drawer, whose **Edit** tab changes the text itself: names, read-alouds, stat blocks, DCs, notes.

Every change shows up everywhere at once. Lose the Spider-Man mask and Spider-Sense locks on the Run screen, in the Codex and in every mention in the script; rename a character and every reference updates. Edited fields show a dot and a one-click "original" reset.

- Undo and redo: `Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z`, or the arrows in the top bar. **⋯ → History** lists every change.
- **Mentioned in** (drawer tab) lists every place something is referenced.
- **New item** and **New character** buttons live in the Codex.

## Campaign options (⋯ → Settings)

- **Studio gauntlet:** *Outline version* (default, from the Latest outline: Oh Dae-su kills at least two players and Toothless wipes everyone but Flynn) or *Expanded build* (softer, adds the Cat in the Hat as the wipe). The script, map, slides and run screen all follow the choice.
- **Route to Hollywood:** plane or boat, once the players pick. The other route's scenes are skipped everywhere.
- **Spoiler shield** (`H`): hides DM secrets before you share your screen.

## Keyboard

`Ctrl/⌘ K` or `/` search everything · `1`–`6` switch views · `E` edit mode · `H` spoiler shield · `D` dice tray · `]` / `[` next or previous scene (Run) · `←` `→` slides · `F` fullscreen slides · `Esc` close · `?` all shortcuts

Every DC in the text is clickable and opens the dice tray preset to it; every dice expression (like `1d8`) rolls when clicked.

## Development

```sh
npm install
npm run build      # writes dist/index.html
npm run dev        # rebuilds on change
npm test           # typecheck, data validation, build, then a browser smoke test
```

The smoke test drives Chromium through every view at phone and desktop sizes in both themes, then exercises editing, undo, reload persistence, search, dice and the gauntlet switch. It uses `playwright-core` without downloading a browser; point `CHROMIUM_PATH` at a Chromium binary if it is not at `/opt/pw-browsers/chromium`.

```
src/data/     the campaign: scenes.ts (acts, scenes, pacing), cast.ts (players, characters, relations),
              things.ts (items, abilities, conditions, clues), rules.ts (rules, films), types.ts
src/state/    store (base data + an edit layer, undo/redo), derive (effective stats, ability locks,
              backlinks), actions, dice, persist (localStorage, optional claude.ai sync)
src/ui/       shell, drawer, editor, rich text (live [[type:id]] references), dice tray, palette
src/ui/views/ run, story (Script), map, slides, codex, rules
src/styles/   tokens and per-area stylesheets
```

Text in the data files can link to anything with `[[npc:lou]]` or `[[item:spider-mask|the mask]]`, make a clickable check with `{{cha:12}}`, or a clickable roll with `{{1d8}}`.

## Sources

The story spine follows the campaign outline and the Latest DM handoff. Stats, abilities, DCs, the ghost and donut rules, pacing and NPC performance notes come from the comprehensive DM build. Each scene keeps its original outline text under "Original outline".
