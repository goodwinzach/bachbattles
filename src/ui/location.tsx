// Locations: the drawer page for a place, the establishing banner at the top of each scene, and the
// cards in the Codex. All of them read live data, so a renamed place or a new picture shows everywhere.

import type { ComponentChildren } from 'preact';
import type { Item, Location, Scene } from '../data/types';
import { peopleAt, portraitOf, scenesAt } from '../state/derive';
import { ent, openDrawer } from '../state/store';
import { DmNote, SceneChips } from './detail';
import { Icon } from './icons';
import { Label, cx } from './kit';
import { Ref, Rich, RichList } from './rich';

/** The place a scene happens in, if it has one. */
export const locationOfScene = (scene: Scene) => (scene.location ? ent<Location>('location', scene.location) : undefined);

/** Everything the party can pick up across a location's scenes. */
function lootAt(id: string): Item[] {
  const ids = [...new Set(scenesAt(id).flatMap((s) => s.loot ?? []))];
  return ids.map((i) => ent<Item>('item', i)).filter((i): i is Item => !!i);
}

/** A location's picture with its name over it; falls back to the icon on a plain panel. */
function Picture({ loc, class: cls, children }: { loc: Location; class?: string; children?: ComponentChildren }) {
  const src = portraitOf('location', loc.id);
  return (
    <div class={cx('locpic', !src && 'locpic--none', cls)}>
      {src ? <img src={src} alt="" decoding="async" draggable={false} /> : <Icon name={loc.icon} size={44} stroke={1.4} />}
      <div class="locpic__shade" />
      {children}
    </div>
  );
}

export function LocationDetail({ loc }: { loc: Location }) {
  const scenes = scenesAt(loc.id);
  const people = peopleAt(loc.id);
  const loot = lootAt(loc.id);
  return (
    <div class="detail stack loc" style={{ '--gap': '18px' } as never}>
      <Picture loc={loc} class="locpic--hero">
        <div class="locpic__cap">
          <span class="locpic__kind">
            <Icon name="map-pin" size={13} /> {loc.kind}
          </span>
          <h2 class="locpic__name">{loc.name}</h2>
          <span class="locpic__where">{loc.where}</span>
        </div>
      </Picture>
      <Rich text={loc.summary} class="dlead" />
      {loc.describe?.length ? (
        <section class="loc__senses">
          <Label icon="eye">When they get there</Label>
          <RichList items={loc.describe} class="loc__describe" />
        </section>
      ) : null}
      <section>
        <Label icon="clapperboard">Scenes here</Label>
        <SceneChips scenes={scenes} />
      </section>
      {people.length ? (
        <section>
          <Label icon="drama">Who they meet here</Label>
          <div class="chips">
            {people.map((n) => (
              <Ref key={n.id} type="npc" id={n.id} chip />
            ))}
          </div>
        </section>
      ) : null}
      {loot.length ? (
        <section>
          <Label icon="package">Found here</Label>
          <div class="chips">
            {loot.map((i) => (
              <Ref key={i.id} type="item" id={i.id} chip />
            ))}
          </div>
        </section>
      ) : null}
      {loc.notes?.length ? (
        <section>
          <Label icon="notebook-pen">DM notes</Label>
          <RichList items={loc.notes} />
        </section>
      ) : null}
      {loc.films?.length ? (
        <section>
          <Label icon="film">References</Label>
          <div class="chips">
            {loc.films.map((f) => (
              <Ref key={f} type="film" id={f} chip />
            ))}
          </div>
        </section>
      ) : null}
      <DmNote text={loc.dmNote} />
    </div>
  );
}

/** The establishing shot at the top of a scene: the place, its picture, and a way into its page. */
export function LocationBanner({ scene, compact }: { scene: Scene; compact?: boolean }) {
  const loc = locationOfScene(scene);
  if (!loc) return null;
  return (
    <button
      type="button"
      class={cx('locbanner', compact && 'locbanner--compact')}
      onClick={() => openDrawer('location', loc.id)}
      aria-label={`Location: ${loc.name}. Open its page`}
      data-ref={`location:${loc.id}`}
    >
      <Picture loc={loc}>
        <span class="locbanner__text">
          <span class="locpic__kind">
            <Icon name="map-pin" size={12} /> {loc.kind} · {loc.where}
          </span>
          <span class="locbanner__name">{loc.name}</span>
        </span>
        <span class="locbanner__go">
          Location <Icon name="chevron-right" size={14} />
        </span>
      </Picture>
    </button>
  );
}

export function LocationCard({ loc }: { loc: Location }) {
  const scenes = scenesAt(loc.id);
  const people = peopleAt(loc.id);
  return (
    <article class="card card--loc">
      <button type="button" class="card--loc__pic" onClick={() => openDrawer('location', loc.id)} aria-label={`${loc.name}: open`}>
        <Picture loc={loc}>
          <span class="locpic__cap locpic__cap--card">
            <span class="locpic__kind">
              <Icon name="map-pin" size={12} /> {loc.kind}
            </span>
            <span class="locpic__name locpic__name--card">{loc.name}</span>
          </span>
        </Picture>
      </button>
      <div class="card__sub">{loc.where}</div>
      <Rich text={loc.summary} class="card__lead" />
      <SceneChips scenes={scenes} />
      {people.length ? (
        <div class="chips">
          {people.slice(0, 8).map((n) => (
            <Ref key={n.id} type="npc" id={n.id} chip />
          ))}
          {people.length > 8 && <span class="muted">+{people.length - 8} more</span>}
        </div>
      ) : null}
    </article>
  );
}
