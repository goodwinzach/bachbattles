import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Hue } from '../data/types';
import type { Tone } from '../state/derive';
import { useBulk, useOpen } from './hooks';
import { Icon } from './icons';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Badge({ tone = 'muted', children, dot = true, title, class: cls }: { tone?: Tone; children: ComponentChildren; dot?: boolean; title?: string; class?: string }) {
  return (
    <span class={cx('badge', `t-${tone}`, !dot && 'badge--nodot', cls)} title={title}>
      {children}
    </span>
  );
}

export interface PickOption {
  value: string;
  label: string;
  tone?: Tone;
  hint?: string;
}

/** A status badge that becomes a dropdown when editable. Uses a native select so it never clips. */
export function StatePicker({
  value,
  options,
  onChange,
  editable,
  label,
  size = 'md',
  title,
}: {
  value: string;
  options: PickOption[];
  onChange: (v: string) => void;
  editable: boolean;
  label?: string;
  size?: 'sm' | 'md';
  title?: string;
}) {
  const cur = options.find((o) => o.value === value) ?? options[0];
  const tone = cur?.tone ?? 'muted';
  if (!editable) {
    return (
      <span class={cx('badge', `t-${tone}`, size === 'sm' && 'badge--sm')} title={title ?? cur?.hint}>
        {cur?.label ?? value}
      </span>
    );
  }
  return (
    <span class={cx('picker', 'badge', `t-${tone}`, size === 'sm' && 'badge--sm')} title={title ?? 'Change state'}>
      {cur?.label ?? value}
      <Icon name="chevron-down" size={12} />
      <select
        aria-label={label ?? 'State'}
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Expander({
  id,
  title,
  icon,
  count,
  tone,
  defaultOpen = false,
  right,
  hint,
  children,
  variant = 'rule',
}: {
  id?: string;
  title: ComponentChildren;
  icon?: string;
  count?: number | string;
  tone?: Tone;
  defaultOpen?: boolean;
  right?: ComponentChildren;
  hint?: ComponentChildren;
  children: ComponentChildren;
  variant?: 'rule' | 'box' | 'plain';
}) {
  const [open, setOpen] = useOpen(id, defaultOpen);
  const [mounted, setMounted] = useState(open);
  useBulk(id, setOpen);
  useEffect(() => {
    if (open && !mounted) setMounted(true);
  }, [open]);
  return (
    <section class={cx('xp', `xp--${variant}`, tone && `t-${tone}`)} data-open={open ? '' : undefined}>
      <div class="xp__bar">
        <button class="xp__head" aria-expanded={open} onClick={() => setOpen(!open)}>
          {icon && <Icon name={icon} size={15} class="xp__icon" />}
          <span class="xp__title">{title}</span>
          {count != null && count !== 0 && <span class="xp__count num">{count}</span>}
          {hint && <span class="xp__hint">{hint}</span>}
          <Icon name="chevron-down" size={16} class="xp__chev" />
        </button>
        {right && <div class="xp__right">{right}</div>}
      </div>
      <div class="xp__body">
        <div class="xp__inner">
          <div class="xp__pad">{open || mounted ? children : null}</div>
        </div>
      </div>
    </section>
  );
}

export function Pips({
  max,
  used,
  onUse,
  onRestore,
  disabled,
  label,
}: {
  max: number;
  used: number;
  onUse?: () => void;
  onRestore?: () => void;
  disabled?: boolean;
  label: string;
}) {
  const left = Math.max(0, max - used);
  return (
    <span class="pips" role="group" aria-label={`${label}: ${left} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < left;
        return (
          <button
            key={i}
            type="button"
            class={cx('pip', filled && 'pip--on')}
            disabled={disabled}
            title={filled ? `Use ${label}` : `Restore ${label}`}
            aria-label={filled ? `Use one ${label}` : `Restore one ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              if (filled) onUse?.();
              else onRestore?.();
            }}
          />
        );
      })}
    </span>
  );
}

export function HpBar({ hp, max, tone, ghost, thin }: { hp: number; max: number; tone?: Tone; ghost?: boolean; thin?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const t: Tone = ghost ? 'ghost' : tone ?? (pct > 0.6 ? 'good' : pct > 0.3 ? 'warn' : 'bad');
  return (
    <div
      class={cx('hpbar', `t-${t}`, thin && 'hpbar--thin')}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hp}
      aria-label="Hit points"
    >
      <div class="hpbar__fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

export function Stepper({
  value,
  onDelta,
  steps = [1],
  label,
  render,
}: {
  value: number;
  onDelta: (d: number) => void;
  steps?: number[];
  label: string;
  render?: (v: number) => ComponentChildren;
}) {
  return (
    <span class="stepper" role="group" aria-label={label}>
      {[...steps].reverse().map((s) => (
        <button key={`-${s}`} type="button" class="stepper__btn" onClick={() => onDelta(-s)} aria-label={`${label} minus ${s}`}>
          {s === 1 ? <Icon name="minus" size={13} /> : `−${s}`}
        </button>
      ))}
      <span class="stepper__val num">{render ? render(value) : value}</span>
      {steps.map((s) => (
        <button key={`+${s}`} type="button" class="stepper__btn" onClick={() => onDelta(s)} aria-label={`${label} plus ${s}`}>
          {s === 1 ? <Icon name="plus" size={13} /> : `+${s}`}
        </button>
      ))}
    </span>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ComponentChildren; id?: string }) {
  return (
    <label class="switch" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="switch__track" />
      <span>{label}</span>
    </label>
  );
}

export const hueVar = (hue?: Hue) => (hue ? `var(--c-${hue})` : undefined);

export function Avatar({ icon, hue, size = 34, ring, title }: { icon: string; hue?: Hue; size?: number; ring?: Tone; title?: string }) {
  return (
    <span
      class={cx('avatar', hue ? 'hue' : 'avatar--plain', ring && `avatar--ring t-${ring}`)}
      style={{ '--c': hueVar(hue), width: `${size}px`, height: `${size}px` } as JSX.CSSProperties}
      title={title}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} />
    </span>
  );
}

export function Empty({ icon = 'circle-dashed', title, children }: { icon?: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} size={22} />
      <div class="empty__title">{title}</div>
      {children && <div class="empty__body">{children}</div>}
    </div>
  );
}

export function Label({ children, icon }: { children: ComponentChildren; icon?: string }) {
  return (
    <div class="label">
      {icon && <Icon name={icon} size={13} />}
      {children}
    </div>
  );
}

/** Text input that commits on blur / Enter instead of on every keystroke. */
export function CommitInput({
  value,
  onCommit,
  multiline,
  rows = 4,
  placeholder,
  class: cls,
  id,
  type = 'text',
  ariaLabel,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  class?: string;
  id?: string;
  type?: string;
  ariaLabel?: string;
  style?: JSX.CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (draft !== value) onCommit(draft);
  };
  if (multiline) {
    return (
      <textarea
        id={id}
        class={cx('textarea', cls)}
        rows={rows}
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={() => (focused.current = true)}
        onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur();
          if (e.key === 'Escape') {
            setDraft(value);
            focused.current = false;
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    );
  }
  return (
    <input
      id={id}
      type={type}
      class={cx('input', cls)}
      style={style}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => (focused.current = true)}
      onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          focused.current = false;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function NumberInput({ value, onCommit, min, max, id, ariaLabel, width = 72 }: { value: number | null; onCommit: (v: number) => void; min?: number; max?: number; id?: string; ariaLabel?: string; width?: number }) {
  return (
    <CommitInput
      id={id}
      type="number"
      ariaLabel={ariaLabel}
      class="input--num"
      value={value == null ? '' : String(value)}
      onCommit={(v) => {
        const n = parseFloat(v);
        if (Number.isNaN(n)) return;
        let x = n;
        if (min != null) x = Math.max(min, x);
        if (max != null) x = Math.min(max, x);
        onCommit(x);
      }}
      placeholder="—"
      style={{ width: `${width}px` }}
    />
  );
}
