import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/run.css';
import './styles/views.css';
import './styles/slides.css';
import { applyPrefs, bootData, loadPrefs, startPersistence } from './state/persist';
import { getUi, setUi, VIEWS, type View } from './state/store';
import { App } from './ui/App';

type HotState = { view?: View; slide?: number };

function start(hot: HotState = {}) {
  bootData();
  applyPrefs(loadPrefs());
  if (hot.view) setUi({ view: hot.view, slide: hot.slide ?? 0 });
  const hash = location.hash.slice(1);
  if (VIEWS.some((v) => v.id === hash)) setUi({ view: hash as View });
  startPersistence();
  render(<App />, document.getElementById('app')!);
}

const claude = (window as unknown as { claude?: { hot?: { snapshot?: (fn: () => HotState) => void; ready?: (fn: (d: HotState) => void) => void; data?: HotState } } }).claude;
claude?.hot?.snapshot?.(() => ({ view: getUi().view, slide: getUi().slide }));
if (claude?.hot?.ready) claude.hot.ready(start);
else start(claude?.hot?.data ?? {});
