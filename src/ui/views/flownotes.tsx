// Sticky notes on the story flow map. A note belongs to the scene it sits next to and moves with it;
// drag it by its bar and drop it near another scene to move it there. Notes are saved with the game,
// undoable, and also show in their scene's branches and on the Run screen.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Scene } from '../../data/types';
import { deleteMapNote, updateMapNote } from '../../state/actions';
import { ent, type MapNote, type MapNoteColor } from '../../state/store';
import { Icon } from '../icons';
import { cx } from '../kit';

export const NOTE_W = 216;
export const NOTE_COLORS: MapNoteColor[] = ['yellow', 'pink', 'blue', 'green'];

/** The scene whose node is closest to a point (distance to the node's box, not its corner). */
export function nearestScene(x: number, y: number, pos: Map<string, { x: number; y: number }>, w: number, h: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [id, p] of pos) {
    const dx = Math.max(p.x - x, 0, x - (p.x + w));
    const dy = Math.max(p.y - y, 0, y - (p.y + h));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function MapNoteView({
  note,
  x,
  y,
  dragging,
  attachedTo,
  focus,
  onGrab,
}: {
  note: MapNote;
  x: number;
  y: number;
  dragging: boolean;
  /** while dragging: the scene it will join if dropped here */
  attachedTo: string;
  focus: boolean;
  onGrab: (e: PointerEvent) => void;
}) {
  const [text, setText] = useState(note.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  // follow undo/redo and edits from elsewhere
  useEffect(() => setText(note.text), [note.text]);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  const scene = ent<Scene>('scene', attachedTo);
  const commit = () => {
    if (text !== note.text) updateMapNote(note.id, { text }, 'Map note edited');
  };
  return (
    <div
      class={cx('mnote nopan', `mnote--${note.color}`, dragging && 'is-dragging')}
      style={{ left: `${x}px`, top: `${y}px`, width: `${NOTE_W}px` }}
      data-note={note.id}
      onDblClick={(e) => e.stopPropagation()}
    >
      <div
        class="mnote__bar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onGrab(e);
        }}
        title="Drag to move. Drop it next to a scene to attach it there."
      >
        <Icon name="grip-vertical" size={14} class="mnote__grip" />
        <span class="mnote__scene">{scene ? `${scene.slate} · ${scene.title}` : 'Note'}</span>
        <span class="mnote__colors" role="radiogroup" aria-label="Note color">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === note.color}
              class={cx('mnote__dot', `mnote__dot--${c}`, c === note.color && 'is-on')}
              onClick={() => updateMapNote(note.id, { color: c }, 'Map note color changed')}
              aria-label={`${c[0].toUpperCase()}${c.slice(1)}`}
              title={`${c[0].toUpperCase()}${c.slice(1)}`}
            />
          ))}
        </span>
        <button type="button" class="mnote__del" onClick={() => deleteMapNote(note.id)} aria-label="Delete this note" title="Delete this note">
          <Icon name="trash" size={13} />
        </button>
      </div>
      <textarea
        ref={ref}
        class="mnote__text"
        value={text}
        rows={3}
        placeholder="Write a note…"
        aria-label={`Note by ${scene?.title ?? 'the map'}`}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    </div>
  );
}
