import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { TYPE_LABEL } from '../data/campaign';
import type { EntityType } from '../data/types';
import { backlinks, isSecretHidden, nameOf } from '../state/derive';
import { getSyncState, onSync, type SyncState } from '../state/persist';
import {
  closeDrawer,
  dismissToast,
  getUi,
  go,
  latestUndoId,
  openModal,
  redo,
  setUi,
  undo,
  undoInfo,
  VIEWS,
  type DrawerSpec,
} from '../state/store';
import { EntityDetail, PeekCard } from './detail';
import { EntityEditor } from './editor';
import { Icon } from './icons';
import { cx } from './kit';
import { getPeek, onPeek, peekHold, peekOut, Ref } from './rich';

// ─── wordmark ─────────────────────────────────────────────────────────────

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <button type="button" class="wordmark" onClick={() => go('run')} aria-label="One Ring to Rule Flynn: go to the run screen">
      <svg class="wordmark__ring" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--gold-2)" />
            <stop offset="0.55" stop-color="var(--gold)" />
            <stop offset="1" stop-color="var(--gold-2)" />
          </linearGradient>
        </defs>
        <ellipse cx="16" cy="17" rx="11.5" ry="10" fill="none" stroke="url(#ringg)" stroke-width="4" />
        <ellipse cx="16" cy="17" rx="11.5" ry="10" fill="none" stroke="var(--on-gold)" stroke-opacity="0.25" stroke-width="0.8" />
      </svg>
      <span class="wordmark__text">
        <span class="wordmark__one">One Ring</span>
        {!compact && <span class="wordmark__sub">to rule Flynn</span>}
      </span>
    </button>
  );
}

// ─── sync dot ─────────────────────────────────────────────────────────────

function SyncDot() {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => onSync(setS), []);
  const label: Record<SyncState, string> = {
    local: 'Saved in this browser',
    connecting: 'Connecting to your Claude account…',
    synced: 'Saved to your Claude account',
    saving: 'Saving…',
    offline: 'Offline: saved in this browser',
    error: 'Could not sync. Saved in this browser.',
  };
  return <span class={cx('syncdot', `syncdot--${s}`)} title={label[s]} aria-label={label[s]} />;
}

// ─── menu ─────────────────────────────────────────────────────────────────

function MoreMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.morebtn')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const item = (icon: string, label: string, fn: () => void, hint?: string) => (
    <button
      type="button"
      class="menu__item"
      role="menuitem"
      onClick={() => {
        onClose();
        fn();
      }}
    >
      <Icon name={icon} size={16} />
      <span class="grow">{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
  const u = undoInfo();
  return (
    <div class="pop menu" ref={ref} role="menu">
      {item('settings', 'Settings & campaign options', () => openModal({ kind: 'settings' }))}
      {item('list-restart', `History${u.history.length ? ` (${u.history.length})` : ''}`, () => openModal({ kind: 'history' }))}
      {item('file-down', 'Export save', () => openModal({ kind: 'export' }))}
      {item('file-up', 'Import save', () => openModal({ kind: 'import' }))}
      {item('keyboard', 'Keyboard shortcuts', () => openModal({ kind: 'shortcuts' }), '?')}
    </div>
  );
}

// ─── top bar ──────────────────────────────────────────────────────────────

export function TopBar() {
  const ui = getUi();
  const u = undoInfo();
  const [more, setMore] = useState(false);
  return (
    <header class={cx('topbar', ui.edit && 'topbar--edit')}>
      <div class="topbar__inner">
        <Wordmark />
        <nav class="tabs" aria-label="Views">
          {VIEWS.map((v, i) => (
            <button key={v.id} type="button" class={cx('tab', ui.view === v.id && 'is-on')} aria-current={ui.view === v.id ? 'page' : undefined} onClick={() => go(v.id)} title={`${v.label}: ${v.hint} (${i + 1})`} aria-label={v.label}>
              <Icon name={v.icon} size={16} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        <div class="topbar__right">
          <button type="button" class="btn btn--ghost searchbtn" onClick={() => setUi({ palette: true })} title="Search everything (Ctrl/⌘ K)">
            <Icon name="search" />
            <span class="searchbtn__label">Search</span>
            <kbd class="searchbtn__kbd">⌘K</kbd>
          </button>
          <div class="topbar__undo">
            <button type="button" class="btn btn--ghost btn--icon" disabled={!u.canUndo} onClick={() => undo()} title={u.undoLabel ? `Undo: ${u.undoLabel}` : 'Nothing to undo'} aria-label="Undo">
              <Icon name="undo-2" />
            </button>
            <button type="button" class="btn btn--ghost btn--icon" disabled={!u.canRedo} onClick={() => redo()} title={u.redoLabel ? `Redo: ${u.redoLabel}` : 'Nothing to redo'} aria-label="Redo">
              <Icon name="redo-2" />
            </button>
          </div>
          <button
            type="button"
            class={cx('btn btn--icon shieldbtn', ui.shield && 'is-on')}
            aria-pressed={ui.shield}
            onClick={() => setUi({ shield: !ui.shield })}
            title={ui.shield ? 'Spoiler shield on: secrets are hidden. Click to show them. (H)' : 'Hide DM secrets before sharing your screen (H)'}
            aria-label="Spoiler shield"
          >
            <Icon name={ui.shield ? 'eye-off' : 'eye'} />
          </button>
          <button
            type="button"
            class={cx('editbtn', ui.edit && 'is-on')}
            aria-pressed={ui.edit}
            onClick={() => setUi({ edit: !ui.edit })}
            title={ui.edit ? 'Editing: every state badge is a picker and every entry opens in its editor. Click to stop. (E)' : 'Edit: change the state of any item, ability, character or scene, everywhere at once (E)'}
          >
            <Icon name={ui.edit ? 'pencil-off' : 'pencil'} size={16} />
            <span>{ui.edit ? 'Editing' : 'Edit'}</span>
          </button>
          <div class="morewrap">
            <button type="button" class="btn btn--ghost btn--icon morebtn" onClick={() => setMore(!more)} aria-expanded={more} aria-label="More">
              <Icon name="ellipsis" />
            </button>
            {more && <MoreMenu onClose={() => setMore(false)} />}
          </div>
          <SyncDot />
        </div>
      </div>
      {ui.edit && (
        <div class="editbar" role="status">
          <Icon name="pencil" size={13} />
          <span>
            <strong>Edit mode.</strong> Click any state badge to change it, or any name to open its editor. Every view updates together.
          </span>
          <button type="button" class="editbar__done" onClick={() => setUi({ edit: false })}>
            Done
          </button>
        </div>
      )}
    </header>
  );
}

export function BottomNav() {
  const ui = getUi();
  return (
    <nav class="bottomnav" aria-label="Views">
      {VIEWS.map((v) => (
        <button key={v.id} type="button" class={cx('bottomnav__tab', ui.view === v.id && 'is-on')} aria-current={ui.view === v.id ? 'page' : undefined} onClick={() => go(v.id)}>
          <Icon name={v.icon} size={19} />
          <span>{v.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── drawer ───────────────────────────────────────────────────────────────

function Links({ type, id }: { type: EntityType; id: string }) {
  const hits = backlinks(type, id);
  if (!hits.length) return <div class="muted">Nothing else in the campaign points here yet.</div>;
  const groups = new Map<EntityType, typeof hits>();
  for (const h of hits) groups.set(h.type, [...(groups.get(h.type) ?? []), h]);
  return (
    <div class="stack" style={{ '--gap': '16px' } as never}>
      <p class="muted">Everywhere this is mentioned. Edits to it show up in all of these.</p>
      {[...groups.entries()].map(([t, list]) => (
        <div key={t}>
          <div class="label">
            {TYPE_LABEL[t]}s · {list.length}
          </div>
          <div class="chips">
            {list.map((h) => (
              <Ref key={`${h.type}:${h.id}`} type={h.type} id={h.id} chip />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Drawer() {
  const spec = getUi().drawer;
  const [shown, setShown] = useState<DrawerSpec | null>(spec);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (spec) setShown(spec);
  }, [spec?.type, spec?.id, spec?.tab]);
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [spec?.type, spec?.id]);
  const open = !!spec;
  const cur = spec ?? shown;
  const name = cur ? nameOf(cur.type, cur.id) : '';
  const tabs: { id: DrawerSpec['tab']; label: string; icon: string }[] = [
    { id: 'info', label: 'Overview', icon: 'eye' },
    { id: 'edit', label: 'Edit', icon: 'pencil' },
    { id: 'links', label: 'Mentioned in', icon: 'link' },
  ];
  const secretLocked = cur ? isSecretHidden(cur.type, cur.id) : false;
  return (
    <>
      <div class={cx('scrim', open && 'is-on')} onClick={closeDrawer} aria-hidden="true" />
      <aside class={cx('drawer', open && 'is-on')} aria-hidden={!open} aria-label={name} role="dialog">
        {cur && (
          <>
            <div class="drawer__head">
              <div class="drawer__crumb">
                <span class="eyebrow">{TYPE_LABEL[cur.type]}</span>
              </div>
              <div class="seg drawer__tabs" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={cur.tab === t.id}
                    aria-pressed={cur.tab === t.id}
                    onClick={() => setUi({ drawer: { ...cur, tab: t.id } })}
                    disabled={t.id === 'edit' && secretLocked}
                  >
                    <Icon name={t.icon} size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" class="btn btn--ghost btn--icon" onClick={closeDrawer} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <div class="drawer__body" ref={bodyRef}>
              {cur.tab === 'info' && <EntityDetail type={cur.type} id={cur.id} />}
              {cur.tab === 'edit' && (secretLocked ? <div class="muted">Turn off the spoiler shield to edit this secret.</div> : <EntityEditor type={cur.type} id={cur.id} />)}
              {cur.tab === 'links' && <Links type={cur.type} id={cur.id} />}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ─── toasts ───────────────────────────────────────────────────────────────

export function Toasts() {
  const toasts = getUi().toasts;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={cx('toast', t.tone && `t-${t.tone}`, t.big && 'toast--big')}>
          <span class="toast__dot" />
          <span class="toast__text">{t.text}</span>
          {t.undoId != null && t.undoId === latestUndoId() && (
            <button
              type="button"
              class="toast__btn"
              onClick={() => {
                dismissToast(t.id);
                undo();
              }}
            >
              Undo
            </button>
          )}
          <button type="button" class="toast__x" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── hover cards ──────────────────────────────────────────────────────────

export function PeekLayer() {
  const [, force] = useState(0);
  useEffect(() => onPeek(() => force((n) => n + 1)), []);
  const p = getPeek();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!p || !ref.current) return setPos(null);
    const card = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = p.rect.left;
    let y = p.rect.bottom + 8;
    if (x + card.width > vw - 12) x = vw - card.width - 12;
    if (y + card.height > vh - 12) y = p.rect.top - card.height - 8;
    setPos({ x: Math.max(12, x), y: Math.max(12, y) });
  }, [p?.type, p?.id, p?.rect.left, p?.rect.top]);
  if (!p) return null;
  return (
    <div
      ref={ref}
      class="peekwrap"
      style={{ left: `${pos?.x ?? -9999}px`, top: `${pos?.y ?? -9999}px`, opacity: pos ? 1 : 0 }}
      onMouseEnter={peekHold}
      onMouseLeave={peekOut}
    >
      <PeekCard type={p.type} id={p.id} />
    </div>
  );
}
