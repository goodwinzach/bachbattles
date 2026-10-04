// SCRIPT: the whole campaign as an organized, searchable document.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Act, Film, PC, Scene } from '../../data/types';
import { goScene } from '../../state/actions';
import { backlinks, entityText, sceneInPlay, sceneMust, sceneStatus, shielded, strip } from '../../state/derive';
import { all, game, getDataVersion, getUi, openDrawer, setUi } from '../../state/store';
import { SceneStatusControl } from '../controls';
import { Secret } from '../detail';
import { setBulk } from '../hooks';
import { Icon } from '../icons';
import { Face } from '../profile';
import { Badge, cx, hueVar } from '../kit';
import { Ref, Rich, RichList } from '../rich';
import { ReadAloud, SceneBody, SceneMeta } from '../scene';

function TitleBlock() {
  const pcs = all<PC>('pc');
  return (
    <header class="doc__title">
      <div class="doc__eyebrow">Campaign outline · DM handoff</div>
      <h1 class="doc__mark">One Ring to Rule Flynn</h1>
      <p class="doc__lede">
        A cinematic, stupid, affectionate bachelor-party one-shot. Five friends wake up hungover in a field with the groom's wedding ring gone and the
        wedding tomorrow.
      </p>
      <dl class="doc__facts">
        <div>
          <dt>Players</dt>
          <dd class="doc__players">
            {pcs.map((p) => (
              <span key={p.id} class="doc__player">
                <Face type="pc" id={p.id} size={24} />
                <Ref type="pc" id={p.id} noDot /> <span class="muted">({p.player})</span>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>DM</dt>
          <dd>Nathan</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>4 to 6 hours</dd>
        </div>
        <div>
          <dt>Tone</dt>
          <dd>Cinematic, film-reference-heavy, occasionally lethal</dd>
        </div>
      </dl>
    </header>
  );
}

function HouseRules() {
  return (
    <section class="doc__sec" id="house-rules">
      <h2 class="doc__h2">Core rules</h2>
      <div class="houserules">
        <div class="houserule">
          <div class="houserule__icon">
            <Icon name="donut" size={20} />
          </div>
          <div>
            <h3>
              <Ref type="rule" id="donut-rule" noDot />
            </h3>
            <p>
              When a player dies, they become a ghost. To bring them back physically, a living player has to find and eat a donut, and the donut alone
              does nothing: first they must perform a statistically improbable action, in person.
            </p>
          </div>
        </div>
        <div class="houserule">
          <div class="houserule__icon">
            <Icon name="shield-check" size={20} />
          </div>
          <div>
            <h3>{shielded() ? 'DM secret' : "Flynn's plot armor"}</h3>
            <Secret>
              <p>Flynn has plot armor; the other players do not. No matter what, Flynn cannot die. His masks basically prevent it.</p>
            </Secret>
          </div>
        </div>
        <div class="houserule">
          <div class="houserule__icon">
            <Icon name="scan-face" size={20} />
          </div>
          <div>
            <h3>{shielded() ? 'DM secret' : 'The no-mask Charisma rule'}</h3>
            <Secret>
              <p>
                Flynn's Charisma goes up by 100 when he takes off the masks. It applies the whole game, but the DM only reveals it when Flynn decides to
                wear no mask. See <Ref type="ability" id="unmasked" />.
              </p>
            </Secret>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowTable() {
  const acts = all<Act>('act');
  const scenes = all<Scene>('scene');
  return (
    <section class="doc__sec" id="flow">
      <h2 class="doc__h2">Campaign flow at a glance</h2>
      <div class="tablewrap">
        <table class="table flowtable">
          <thead>
            <tr>
              <th>Section</th>
              <th>What happens</th>
              <th>Must happen</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((a) => {
              const list = scenes.filter((s) => s.act === a.id && !s.optional);
              const must = list.flatMap((s) => sceneMust(s)).slice(0, 2);
              return (
                <tr key={a.id} class="hue" style={{ '--c': hueVar(a.hue) } as never}>
                  <td>
                    <span class="flowtable__act">
                      <span class="swatch" />
                      {a.num}
                    </span>
                    <div class="flowtable__title">{a.title}</div>
                  </td>
                  <td>
                    <Rich text={a.summary} />
                    <div class="chips flowtable__chips">
                      {scenes
                        .filter((s) => s.act === a.id)
                        .map((s) => (
                          <a key={s.id} href={`#scene-${s.id}`} class={cx('scenelink', !sceneInPlay(s) && 'is-out')} onClick={(e) => { e.preventDefault(); scrollToScene(s.id); }}>
                            <span class="num">{s.slate}</span> {s.title}
                          </a>
                        ))}
                    </div>
                  </td>
                  <td>{must.length ? <RichList items={must} /> : <span class="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function scrollToScene(id: string) {
  const el = document.getElementById(`scene-${id}`);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 76;
  window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function SceneSection({ scene, scriptOnly }: { scene: Scene; scriptOnly: boolean }) {
  const st = sceneStatus(scene);
  const isCurrent = game().scene === scene.id;
  const out = !sceneInPlay(scene);
  return (
    <section id={`scene-${scene.id}`} class={cx('scenesec', out && 'is-out', isCurrent && 'is-current')} data-scene={scene.id}>
      <header class="scenesec__head">
        <div class="scenesec__slate num">{scene.slate}</div>
        <div class="scenesec__titles">
          <div class="slug">{scene.slug}</div>
          <h3 class="scenesec__title">
            <button type="button" onClick={() => openDrawer('scene', scene.id)}>
              {scene.title}
            </button>
          </h3>
          {!scriptOnly && <SceneMeta scene={scene} />}
          {out && (
            <div class="scenesec__out">
              <Icon name="circle-dashed" size={13} />
              {scene.expandedOnly ? 'Only in the expanded build (the Cat in the Hat). Switch it on in Settings.' : 'Not on the route the party chose.'}
            </div>
          )}
        </div>
        <div class="scenesec__actions">
          <SceneStatusControl scene={scene} size="sm" />
          {isCurrent ? (
            <Badge tone="rec">Now playing</Badge>
          ) : (
            <button type="button" class="btn btn--sm" onClick={() => { goScene(scene.id); }} title="Make this the current scene" disabled={st === 'active'}>
              <Icon name="play" /> Play
            </button>
          )}
          <button type="button" class="btn btn--sm btn--ghost btn--icon" title="Edit this scene" onClick={() => openDrawer('scene', scene.id, 'edit')} aria-label={`Edit ${scene.title}`}>
            <Icon name="pencil" />
          </button>
        </div>
      </header>
      {scriptOnly ? (
        <div class="scenesec__script">
          <ReadAloud paras={scene.readAloud} />
          {scene.lines?.length ? (
            <ul class="lines">
              {scene.lines.map((l, i) => (
                <li key={i} class="line line--by">
                  <span class="line__by">
                    <Ref type="npc" id={l.by} noDot />
                  </span>
                  <span class="line__text">“{l.text}”</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <SceneBody scene={scene} prefix="story" compact />
      )}
    </section>
  );
}

function Credits() {
  const films = all<Film>('film');
  const favs = films.filter((f) => f.favorite);
  const others = films.filter((f) => !f.favorite);
  return (
    <section class="doc__sec" id="movies">
      <h2 class="doc__h2">Flynn's favorite movies</h2>
      <p class="muted doc__note">The reference list from the outline. A number shows how many characters, scenes, items and rules use each one. Unused favorites are free for an improvised cameo.</p>
      <ol class="credits">
        {favs.map((f) => {
          const n = backlinks('film', f.id).length;
          return (
            <li key={f.id} class={cx('credit', !n && 'credit--unused')}>
              <Ref type="film" id={f.id} noDot />
              <span class="credit__n num">{n || 'unused'}</span>
            </li>
          );
        })}
      </ol>
      <h3 class="doc__h3">Also referenced</h3>
      <div class="chips">
        {others.map((f) => (
          <Ref key={f.id} type="film" id={f.id} chip noDot />
        ))}
      </div>
    </section>
  );
}

export function StoryView() {
  const ui = getUi();
  const acts = all<Act>('act');
  const scenes = all<Scene>('scene');
  const [q, setQ] = useState('');
  const [scriptOnly, setScriptOnly] = useState(false);
  const [spy, setSpy] = useState<string>(game().scene);
  const docRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const words = query.split(/\s+/);
    return new Set(scenes.filter((s) => {
      const text = (entityText(s) + ' ' + (s.cast ?? []).join(' ')).toLowerCase();
      return words.every((w) => text.includes(w));
    }).map((s) => s.id));
  }, [q, getDataVersion()]);

  // jump to a scene asked for elsewhere (drawer "Open in the script")
  useEffect(() => {
    const target = ui.focusScene;
    if (target) {
      setTimeout(() => scrollToScene(target), 60);
      setUi({ focusScene: null });
    }
  }, []);

  // scroll spy
  useEffect(() => {
    const els = docRef.current?.querySelectorAll<HTMLElement>('[data-scene]');
    if (!els?.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setSpy((vis[0].target as HTMLElement).dataset.scene!);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scriptOnly, matches]);

  const visible = (s: Scene) => !matches || matches.has(s.id);
  const shownCount = scenes.filter(visible).length;

  return (
    <div class="view story">
      <aside class="story__toc" aria-label="Contents">
        <div class="toc__tools">
          <label class="searchfield">
            <Icon name="text-search" size={16} />
            <input class="input" placeholder="Find in the script" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Find in the script" />
            {q && (
              <button type="button" class="searchfield__x" onClick={() => setQ('')} aria-label="Clear">
                <Icon name="x" size={14} />
              </button>
            )}
          </label>
          <div class="seg seg--full" role="group" aria-label="Layout">
            <button type="button" aria-pressed={!scriptOnly} onClick={() => setScriptOnly(false)}>
              <Icon name="list" /> Full
            </button>
            <button type="button" aria-pressed={scriptOnly} onClick={() => setScriptOnly(true)}>
              <Icon name="megaphone" /> Read-aloud only
            </button>
          </div>
          {!scriptOnly && (
            <div class="row toc__bulk">
              <button type="button" class="btn btn--xs btn--ghost" onClick={() => setBulk('story', true)}>
                <Icon name="chevrons-up-down" /> Expand all
              </button>
              <button type="button" class="btn btn--xs btn--ghost" onClick={() => setBulk('story', false)}>
                <Icon name="chevrons-down-up" /> Collapse all
              </button>
            </div>
          )}
        </div>
        <nav class="toc">
          {acts.map((a) => (
            <div key={a.id} class="toc__act hue" style={{ '--c': hueVar(a.hue) } as never}>
              <a class="toc__actname" href={`#act-${a.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`act-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <span class="swatch" />
                {a.num}: {a.title}
              </a>
              <ul>
                {scenes
                  .filter((s) => s.act === a.id && visible(s))
                  .map((s) => {
                    const st = sceneStatus(s);
                    return (
                      <li key={s.id}>
                        <a
                          href={`#scene-${s.id}`}
                          class={cx('toc__scene', spy === s.id && 'is-spy', `toc__scene--${st}`, !sceneInPlay(s) && 'is-out')}
                          onClick={(e) => {
                            e.preventDefault();
                            scrollToScene(s.id);
                          }}
                        >
                          <span class="toc__dot" />
                          <span class="num toc__slate">{s.slate}</span>
                          <span class="toc__name">{s.title}</span>
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          <div class="toc__act">
            <a class="toc__actname" href="#movies" onClick={(e) => { e.preventDefault(); document.getElementById('movies')?.scrollIntoView({ behavior: 'smooth' }); }}>
              Appendix: favorite movies
            </a>
          </div>
        </nav>
      </aside>
      <div class="story__doc" ref={docRef}>
        {!matches && !scriptOnly && (
          <>
            <TitleBlock />
            <HouseRules />
            <FlowTable />
          </>
        )}
        {matches && (
          <div class="callout">
            <Icon name="text-search" size={16} />
            <span>
              {shownCount} scene{shownCount === 1 ? '' : 's'} mention “{q}”.{' '}
              <button type="button" class="linkbtn" onClick={() => setQ('')}>
                Show everything
              </button>
            </span>
          </div>
        )}
        {acts.map((a) => {
          const list = scenes.filter((s) => s.act === a.id && visible(s));
          if (!list.length) return null;
          return (
            <div key={a.id} class="actblock hue" style={{ '--c': hueVar(a.hue) } as never}>
              <header class="actsec" id={`act-${a.id}`}>
                <div class="actsec__num">{a.num}</div>
                <h2 class="actsec__title">{a.title}</h2>
                <p class="actsec__tag">{a.tagline}</p>
                {!scriptOnly && <Rich text={a.summary} class="actsec__sum" />}
              </header>
              {list.map((s) => (
                <SceneSection key={s.id} scene={s} scriptOnly={scriptOnly} />
              ))}
            </div>
          );
        })}
        {!matches && !scriptOnly && <Credits />}
        {shielded() && <div class="muted doc__note">Spoiler shield is on: DM secrets are blurred.</div>}
        <div class="doc__end muted">
          <Icon name="clapperboard" size={14} /> {strip('That\'s a wrap.')}
        </div>
      </div>
    </div>
  );
}
