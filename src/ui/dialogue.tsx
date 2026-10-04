// Dialogue options: a character's situations, each with a few interchangeable lines. Tap a line
// once it has been said so it is not repeated (remembered until the page is reloaded), or let the
// dice pick one. Used in profiles (all situations at once on the page, tabs in the drawer) and in
// each scene's "Dialogue options" panel on the Run screen and in the Script.

import { useState } from 'preact/hooks';
import type { NPC } from '../data/types';
import { dialogueOf } from '../state/derive';
import { getUi, setUi } from '../state/store';
import { Icon } from './icons';
import { cx } from './kit';
import { Rich } from './rich';

const SEP = '␟';
const saidKey = (npcId: string, text: string) => `${npcId}${SEP}${text.trim()}`;

/** Lines in (parentheses) are performance cues, shown without the brackets. */
const asCue = (t: string) => {
  const s = t.trim();
  return s.startsWith('(') && s.endsWith(')') && !s.slice(1, -1).includes(')') ? s.slice(1, -1) : null;
};

/** Stage directions inside a spoken line, like "(Backs away.) Fine.", read in italics. */
const stage = (t: string) => t.replace(/\(([^()*\[\]]+)\)/g, '*($1)*');

export function DialogueOptions({ npc, layout = 'tabs' }: { npc: NPC; layout?: 'tabs' | 'grid' }) {
  const cues = dialogueOf(npc);
  const [sel, setSel] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const said = getUi().said;
  if (!cues.length) return null;
  const cur = Math.min(sel, cues.length - 1);
  const isSaid = (text: string) => !!said[saidKey(npc.id, text)];
  const toggle = (text: string) => {
    const k = saidKey(npc.id, text);
    const next = { ...said };
    if (next[k]) delete next[k];
    else next[k] = true;
    setUi({ said: next });
  };
  const pick = (ci: number) => {
    const opts = cues[ci].options;
    const fresh = opts.filter((o) => !isSaid(o));
    const base = fresh.length ? fresh : opts;
    // never the same line twice in a row
    const others = base.filter((o) => `${ci}${SEP}${o}` !== picked);
    const pool = others.length ? others : base;
    setPicked(`${ci}${SEP}${pool[Math.floor(Math.random() * pool.length)]}`);
  };
  const mine = Object.keys(said).filter((k) => k.startsWith(npc.id + SEP));
  const clear = () => {
    const next = { ...said };
    for (const k of mine) delete next[k];
    setUi({ said: next });
    setPicked(null);
  };
  const left = (ci: number) => cues[ci].options.filter((o) => !isSaid(o)).length;

  const list = (ci: number) => (
    <ol class="dlg__opts">
      {cues[ci].options.map((o, i) => {
        const done = isSaid(o);
        const cue = asCue(o);
        return (
          <li
            key={i}
            class={cx('dlg__opt', done && 'is-said', picked === `${ci}${SEP}${o}` && 'is-picked', cue != null && 'dlg__opt--cue')}
            onClick={(e) => {
              // links and dice inside a line keep their own click
              if ((e.target as HTMLElement).closest('button:not(.dlg__n), a')) return;
              toggle(o);
            }}
          >
            <button
              type="button"
              class="dlg__n"
              aria-pressed={done}
              aria-label={done ? 'Said. Mark as not said' : 'Mark as said'}
              title={done ? 'Said. Click to un-mark.' : 'Mark as said'}
            >
              {done ? <Icon name="check" size={12} /> : cue != null ? <Icon name="drama" size={12} /> : i + 1}
            </button>
            <span class="dlg__text">
              <Rich text={cue ?? stage(o)} />
            </span>
          </li>
        );
      })}
    </ol>
  );

  const foot = (
    <div class="dlg__foot">
      {layout === 'tabs' && (
        <button type="button" class="btn btn--xs" onClick={() => pick(cur)} title="Pick a line you have not used yet">
          <Icon name="dices" /> Pick one
        </button>
      )}
      {mine.length > 0 && (
        <button type="button" class="btn btn--xs btn--ghost" onClick={clear}>
          <Icon name="rotate-ccw" /> Clear {mine.length} said
        </button>
      )}
      <span class="dlg__hint">Tap a line once you have said it.</span>
    </div>
  );

  if (layout === 'grid') {
    return (
      <div class="dlg dlg--grid">
        <div class="dlg__cards">
          {cues.map((c, ci) => (
            <section key={ci} class="dlg__card">
              <header class="dlg__cardhead">
                <span class="dlg__cue">{c.cue}</span>
                <button type="button" class="btn btn--xs btn--ghost btn--icon" onClick={() => pick(ci)} title="Pick a line for me" aria-label={`Pick a line: ${c.cue}`}>
                  <Icon name="dices" />
                </button>
              </header>
              {list(ci)}
            </section>
          ))}
        </div>
        {foot}
      </div>
    );
  }

  return (
    <div class="dlg dlg--tabs">
      {cues.length > 1 && (
        <div class="dlg__tabs" role="tablist" aria-label={`${npc.name}: situations`}>
          {cues.map((c, ci) => (
            <button
              key={ci}
              type="button"
              role="tab"
              aria-selected={ci === cur}
              class={cx('dlg__tab', left(ci) === 0 && 'is-spent')}
              onClick={() => {
                setSel(ci);
                setPicked(null);
              }}
            >
              {c.cue}
            </button>
          ))}
        </div>
      )}
      <div class="dlg__panel" role={cues.length > 1 ? 'tabpanel' : undefined}>
        {cues.length === 1 && <div class="dlg__cue dlg__cue--solo">{cues[0].cue}</div>}
        {list(cur)}
      </div>
      {foot}
    </div>
  );
}
