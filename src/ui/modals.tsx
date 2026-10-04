import { useEffect, useRef, useState } from 'preact/hooks';
import type { NPC, PC, Scene } from '../data/types';
import { setCatVariant, setRoute, startCombat } from '../state/actions';
import { pcStatusInfo, sceneFoes } from '../state/derive';
import { applyTheme, exportText, getSyncState, parseImport, saveFile } from '../state/persist';
import { all, closeModal, ent, game, getUi, latestUndoId, replaceData, resetAll, setUi, toast, undo, undoInfo, type ModalSpec } from '../state/store';
import { Icon } from './icons';
import { Face } from './profile';
import { Switch, cx } from './kit';

function Dialog({ title, children, onClose, wide, tone }: { title: string; children: preact.ComponentChildren; onClose: () => void; wide?: boolean; tone?: 'gold' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], button, input, textarea, select');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="modalwrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={cx('modal', wide && 'modal--wide', tone && `modal--${tone}`)} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div class="modal__head">
          <h2 class="modal__title">{title}</h2>
          <button type="button" class="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div class="modal__body">{children}</div>
      </div>
    </div>
  );
}

function Confirm({ m }: { m: Extract<ModalSpec, { kind: 'confirm' }> }) {
  return (
    <Dialog title={m.title} onClose={closeModal}>
      <p class="prose">{m.body}</p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" onClick={closeModal}>
          Cancel
        </button>
        <button
          type="button"
          class={cx('btn', m.danger ? 'btn--danger btn--solid' : 'btn--primary')}
          data-autofocus
          onClick={() => {
            closeModal();
            m.onConfirm();
          }}
        >
          {m.confirm}
        </button>
      </div>
    </Dialog>
  );
}

function ExportModal() {
  const text = exportText();
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return (
    <Dialog title="Export your save" onClose={closeModal} wide>
      <p class="prose muted">
        Everything you changed (states, HP, edits, the session timer, notes and the roll log) in one JSON file. Keep a copy before the game, or move your prep to
        another device with Import.
      </p>
      <textarea ref={areaRef} class="textarea mono exportarea" readOnly value={text} aria-label="Save data" onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
      <div class="modal__actions">
        <span class="muted num">{(text.length / 1024).toFixed(1)} KB</span>
        <span class="spacer" />
        <button
          type="button"
          class="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              areaRef.current?.focus();
              areaRef.current?.select();
              toast('Copy blocked here. The text is selected: press Ctrl/⌘ C.', { tone: 'info' });
            }
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          class="btn btn--primary"
          onClick={async () => {
            const r = await saveFile(`one-ring-dm-${stamp}.json`, text);
            if (r === 'saved' || r === 'downloaded') toast('Save file ready.', { tone: 'good' });
            else if (r === 'failed') toast('Could not save a file here. Use Copy instead.', { tone: 'bad' });
          }}
        >
          <Icon name="download" /> Save file
        </button>
      </div>
    </Dialog>
  );
}

function ImportModal() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const go = (raw: string) => {
    const parsed = parseImport(raw);
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    closeModal();
    replaceData(parsed, { keepUndo: true, label: 'Imported a save' });
    toast('Save imported. Undo brings back what you had.', { tone: 'good', undoId: latestUndoId() });
  };
  return (
    <Dialog title="Import a save" onClose={closeModal} wide>
      <p class="prose muted">Choose an exported .json file, or paste its contents. This replaces your current state; you can undo it.</p>
      <label class="btn filebtn">
        <Icon name="upload" /> Choose file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) go(await f.text());
          }}
        />
      </label>
      <textarea
        class="textarea mono exportarea"
        placeholder='Or paste here: {"app":"one-ring-to-rule-flynn", ...}'
        value={text}
        onInput={(e) => {
          setText((e.target as HTMLTextAreaElement).value);
          setError('');
        }}
        aria-label="Paste save data"
      />
      {error && (
        <div class="callout callout--bad">
          <Icon name="circle-alert" size={16} />
          <span>{error}</span>
        </div>
      )}
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" onClick={closeModal}>
          Cancel
        </button>
        <button type="button" class="btn btn--primary" disabled={!text.trim()} onClick={() => go(text)}>
          Import
        </button>
      </div>
    </Dialog>
  );
}

function SettingsModal() {
  const ui = getUi();
  const g = game();
  const sync = getSyncState();
  return (
    <Dialog title="Settings" onClose={closeModal} wide>
      <div class="settings">
        <section class="settings__sec">
          <h3 class="settings__h">Studio gauntlet</h3>
          <p class="muted">
            Your Latest outline has Oh Dae-su kill at least two players and Toothless take out everyone but Flynn. The expanded build softens both and adds
            the Cat in the Hat as an invincible wipe that you play yourself. Pick one; the script, map, slides and run screen all follow.
          </p>
          <div class="choice">
            <button type="button" class={cx('choice__opt', !g.catVariant && 'is-on')} aria-pressed={!g.catVariant} onClick={() => setCatVariant(false)}>
              <Icon name="flame" size={18} />
              <span>
                <strong>Outline version</strong>
                <span>Toothless wipes the party</span>
              </span>
            </button>
            <button type="button" class={cx('choice__opt', g.catVariant && 'is-on')} aria-pressed={g.catVariant} onClick={() => setCatVariant(true)}>
              <Icon name="cat" size={18} />
              <span>
                <strong>Expanded build</strong>
                <span>The Cat in the Hat wipes the party</span>
              </span>
            </button>
          </div>
        </section>
        <section class="settings__sec">
          <h3 class="settings__h">Route to Hollywood</h3>
          <p class="muted">Set when the players decide. The other route's scenes are skipped everywhere.</p>
          <div class="seg">
            <button type="button" aria-pressed={g.route === null} onClick={() => setRoute(null)}>
              Undecided
            </button>
            <button type="button" aria-pressed={g.route === 'plane'} onClick={() => setRoute('plane')}>
              <Icon name="route" /> Plane
            </button>
            <button type="button" aria-pressed={g.route === 'boat'} onClick={() => setRoute('boat')}>
              <Icon name="sailboat" /> Boat
            </button>
          </div>
        </section>
        <section class="settings__sec">
          <h3 class="settings__h">Display</h3>
          <div class="seg" role="group" aria-label="Theme">
            {(['system', 'dark', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={ui.theme === t}
                onClick={() => {
                  setUi({ theme: t });
                  applyTheme(t);
                }}
              >
                <Icon name={t === 'system' ? 'monitor' : t === 'dark' ? 'moon' : 'sun'} /> {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Switch id="set-shield" checked={ui.shield} onChange={(v) => setUi({ shield: v })} label="Spoiler shield: hide DM secrets (for screen sharing)" />
          <Switch id="set-edit" checked={ui.edit} onChange={(v) => setUi({ edit: v })} label="Edit mode" />
        </section>
        <section class="settings__sec">
          <h3 class="settings__h">Your save</h3>
          <p class="muted">
            {sync === 'synced' || sync === 'saving'
              ? 'Saved automatically to your Claude account and this browser.'
              : 'Saved automatically in this browser. Export a copy before game night so nothing depends on one browser.'}
          </p>
          <div class="row">
            <button type="button" class="btn" onClick={() => setUi({ modal: { kind: 'export' } })}>
              <Icon name="file-down" /> Export
            </button>
            <button type="button" class="btn" onClick={() => setUi({ modal: { kind: 'import' } })}>
              <Icon name="file-up" /> Import
            </button>
            <span class="spacer" />
            <button
              type="button"
              class="btn btn--danger"
              onClick={() =>
                setUi({
                  modal: {
                    kind: 'confirm',
                    title: 'Reset everything?',
                    body: 'Every state, HP total, edit, note and roll goes back to the campaign as written. Export first if you might want it back.',
                    confirm: 'Reset everything',
                    danger: true,
                    onConfirm: resetAll,
                  },
                })
              }
            >
              <Icon name="rotate-ccw" /> Reset all
            </button>
          </div>
        </section>
        <section class="settings__sec">
          <h3 class="settings__h">Sources</h3>
          <p class="muted">
            Story spine from your campaign outline and the Latest.docx DM handoff. Stats, abilities, DCs, ghost and bagel rules, pacing and NPC
            performance notes from the comprehensive DM build. Every scene keeps its original outline text under "Original outline".
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function HistoryModal() {
  const u = undoInfo();
  const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <Dialog title="History" onClose={closeModal} wide>
      {u.history.length === 0 ? (
        <p class="muted">No changes yet this session. Everything you change shows up here, and you can step back to any point.</p>
      ) : (
        <>
          <p class="muted">Most recent first. Undo back to any point; the steps after it can be redone.</p>
          <ol class="history">
            {u.history.map((h, i) => (
              <li key={i} class="history__row">
                <span class="history__t num">{fmt(h.t)}</span>
                <span class="grow">{h.label}</span>
                <button
                  type="button"
                  class="btn btn--xs"
                  onClick={() => {
                    undo(i + 1);
                    closeModal();
                  }}
                >
                  Undo to before this
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
}

function ShortcutsModal() {
  const rows: [string, string][] = [
    ['⌘ K  or  /', 'Search everything'],
    ['1 – 7', 'Switch view: Run, Script, Map, Slides, Cast, Codex, Rules'],
    ['E', 'Toggle edit mode'],
    ['H', 'Toggle the spoiler shield'],
    ['D', 'Open the dice tray'],
    ['⌘ Z  /  ⌘ ⇧ Z', 'Undo / redo'],
    [']  /  [', 'Next / previous scene (Run view)'],
    ['← → Space', 'Previous / next slide'],
    ['← →', 'Previous / next character (Cast profile page)'],
    ['F', 'Fullscreen slides'],
    ['Esc', 'Close the drawer or dialog (on the story flow: the last opened node)'],
  ];
  return (
    <Dialog title="Keyboard shortcuts" onClose={closeModal}>
      <dl class="shortcuts">
        {rows.map(([k, v]) => (
          <div key={k} class="shortcuts__row">
            <dt>
              {k.split('  ').map((part, i) => (
                <kbd key={i}>{part}</kbd>
              ))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

function EncounterModal({ m }: { m: Extract<ModalSpec, { kind: 'encounter' }> }) {
  const scene = ent<Scene>('scene', m.scene);
  const enc = scene?.encounters?.[m.index];
  const pcs = all<PC>('pc');
  const defaultFighters = enc?.fighters ?? pcs.filter((p) => p.status !== 'stone' && p.status !== 'down').map((p) => p.id);
  const [fighters, setFighters] = useState<string[]>(defaultFighters);
  const allFoes = scene ? sceneFoes(scene) : [];
  const [foes, setFoes] = useState<string[]>(enc?.foes ?? []);
  if (!scene || !enc) return null;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <Dialog title={`Start: ${enc.label}`} onClose={closeModal} wide>
      <p class="muted">Initiative is rolled automatically: players d20 + Agility (penalties included), enemies d20. You can type in real rolls afterwards.</p>
      <div class="encset">
        <div>
          <div class="label">Players</div>
          <div class="encset__list">
            {pcs.map((p) => {
              const on = fighters.includes(p.id);
              return (
                <button key={p.id} type="button" class={cx('encset__opt', on && 'is-on')} aria-pressed={on} onClick={() => setFighters(toggle(fighters, p.id))}>
                  <Face type="pc" id={p.id} size={28} />
                  <span class="grow">{p.name}</span>
                  <span class="muted">{pcStatusInfo(p.status).label}</span>
                  <Icon name={on ? 'circle-check' : 'circle-dashed'} size={16} />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div class="label">Enemies</div>
          <div class="encset__list">
            {allFoes.map((id) => {
              const n = ent<NPC>('npc', id);
              if (!n) return null;
              const on = foes.includes(id);
              return (
                <button key={id} type="button" class={cx('encset__opt', on && 'is-on')} aria-pressed={on} onClick={() => setFoes(toggle(foes, id))}>
                  <Face type="npc" id={n.id} size={28} />
                  <span class="grow">{n.name}</span>
                  <span class="muted num">{n.stat?.invincible ? '∞' : `HP ${n.stat?.hp ?? '—'}`}</span>
                  <Icon name={on ? 'circle-check' : 'circle-dashed'} size={16} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" onClick={closeModal}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn--primary"
          disabled={!foes.length}
          onClick={() => {
            closeModal();
            startCombat(m.scene, m.index, fighters, foes);
            setUi({ view: 'run' });
          }}
        >
          <Icon name="swords" /> Roll initiative
        </button>
      </div>
    </Dialog>
  );
}

function RevealModal({ m }: { m: Extract<ModalSpec, { kind: 'reveal' }> }) {
  return (
    <Dialog title="Reveal" onClose={closeModal} tone="gold">
      <div class="reveal">
        <div class="reveal__big">{m.title}</div>
        <p class="prose">{m.body}</p>
        <button type="button" class="btn btn--primary btn--lg" onClick={closeModal} data-autofocus>
          Back to the scene
        </button>
      </div>
    </Dialog>
  );
}

export function ModalHost() {
  const m = getUi().modal;
  if (!m) return null;
  switch (m.kind) {
    case 'confirm':
      return <Confirm m={m} />;
    case 'export':
      return <ExportModal />;
    case 'import':
      return <ImportModal />;
    case 'settings':
      return <SettingsModal />;
    case 'history':
      return <HistoryModal />;
    case 'shortcuts':
      return <ShortcutsModal />;
    case 'encounter':
      return <EncounterModal m={m} />;
    case 'reveal':
      return <RevealModal m={m} />;
  }
}
