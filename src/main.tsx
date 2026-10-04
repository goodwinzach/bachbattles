import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/run.css';
import './styles/views.css';
import './styles/slides.css';
import './styles/cast.css';
import { applyPrefs, bootData, loadPrefs, startPersistence } from './state/persist';
import { getUi, setUi, VIEWS, type View } from './state/store';
import { App } from './ui/App';

type HotState = { view?: View; slide?: number; castFocus?: string | null };

function start(hot: HotState = {}) {
  bootData();
  applyPrefs(loadPrefs());
  if (hot.view) setUi({ view: hot.view, slide: hot.slide ?? 0, castFocus: hot.castFocus ?? null });
  // #codex opens a view; #cast/npc/lou opens that character's profile page
  const [hash, type, id] = location.hash.slice(1).split('/');
  if (VIEWS.some((v) => v.id === hash)) setUi({ view: hash as View });
  if (hash === 'cast' && (type === 'pc' || type === 'npc') && id) setUi({ castFocus: `${type}:${id}` });
  startPersistence();
  render(<App />, document.getElementById('app')!);
}

const claude = (window as unknown as { claude?: { hot?: { snapshot?: (fn: () => HotState) => void; ready?: (fn: (d: HotState) => void) => void; data?: HotState } } }).claude;
claude?.hot?.snapshot?.(() => ({ view: getUi().view, slide: getUi().slide, castFocus: getUi().castFocus }));
if (claude?.hot?.ready) claude.hot.ready(start);
else start(claude?.hot?.data ?? {});
