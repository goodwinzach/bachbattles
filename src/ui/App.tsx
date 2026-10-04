import { useEffect } from 'preact/hooks';
import { completeAndNext, goScene } from '../state/actions';
import { neighbors } from '../state/derive';
import { closeDrawer, closeModal, game, getUi, redo, setUi, undo, VIEWS } from '../state/store';
import { DiceTray } from './dice';
import { isTyping, useMedia, useStore } from './hooks';
import { cx } from './kit';
import { ModalHost } from './modals';
import { Palette } from './palette';
import { getRoller, setRollerOpen } from './rollbus';
import { BottomNav, Drawer, PeekLayer, Toasts, TopBar } from './shell';
import { CodexView } from './views/codex';
import { MapView } from './views/map';
import { RulesView } from './views/rules';
import { RunView } from './views/run';
import { SlidesView } from './views/slides';
import { StoryView } from './views/story';

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUi();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUi({ palette: !ui.palette });
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping(e)) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        if (ui.palette) return setUi({ palette: false });
        if (ui.modal) return closeModal();
        if (getRoller().open) return setRollerOpen(false);
        if (ui.drawer) return closeDrawer();
        return;
      }
      if (isTyping(e) || mod || e.altKey) return;
      if (ui.modal || ui.palette) return;
      const k = e.key;
      if (k >= '1' && k <= '6') {
        setUi({ view: VIEWS[parseInt(k, 10) - 1].id });
      } else if (k === '/') {
        e.preventDefault();
        setUi({ palette: true });
      } else if (k === 'e' || k === 'E') {
        setUi({ edit: !ui.edit });
      } else if (k === 'h' || k === 'H') {
        setUi({ shield: !ui.shield });
      } else if (k === 'd' || k === 'D') {
        setRollerOpen(!getRoller().open);
      } else if (k === '?') {
        setUi({ modal: { kind: 'shortcuts' } });
      } else if (ui.view === 'run' && k === ']') {
        completeAndNext();
      } else if (ui.view === 'run' && k === '[') {
        const { prev } = neighbors(game().scene);
        if (prev) goScene(prev.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useHashSync() {
  const view = getUi().view;
  useEffect(() => {
    try {
      if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`);
    } catch {
      /* some hosts forbid history changes */
    }
  }, [view]);
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.slice(1);
      if (VIEWS.some((v) => v.id === h) && h !== getUi().view) setUi({ view: h as never });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
}

export function App() {
  useStore();
  useKeyboard();
  useHashSync();
  const ui = getUi();
  const wide = useMedia('(min-width: 1180px)');
  let view;
  switch (ui.view) {
    case 'story':
      view = <StoryView />;
      break;
    case 'map':
      view = <MapView />;
      break;
    case 'slides':
      view = <SlidesView />;
      break;
    case 'codex':
      view = <CodexView />;
      break;
    case 'rules':
      view = <RulesView />;
      break;
    default:
      view = <RunView />;
  }
  return (
    <div class={cx('app', `app--${ui.view}`, ui.edit && 'is-editing', ui.shield && 'is-shielded', ui.drawer && 'has-drawer')}>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <TopBar />
      <main class="main" id="main" key={ui.view}>
        {view}
      </main>
      <BottomNav />
      <Drawer />
      <DiceTray hidden={ui.view === 'run' && wide} />
      <ModalHost />
      <Palette />
      <Toasts />
      <PeekLayer />
    </div>
  );
}
