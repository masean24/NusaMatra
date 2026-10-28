import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './GlassSelect.module.css';

export interface GlassSelectOption {
  readonly value: string;
  readonly label: string;
  /** A quieter second part of the label, e.g. "35 kab/kota". */
  readonly detail?: string | undefined;
}

interface GlassSelectProps {
  /** The id of the visible <label>/heading text that names the control. */
  readonly labelledBy: string;
  readonly value: string;
  readonly options: readonly GlassSelectOption[];
  readonly onChange: (value: string) => void;
}

/** First option whose label starts with the typed text (case-insensitive), searching after `from`. */
function findByPrefix(options: readonly GlassSelectOption[], text: string, from: number): number {
  const needle = text.toLocaleLowerCase('id-ID');
  for (let step = 1; step <= options.length; step++) {
    const index = (from + step) % options.length;
    if (options[index]?.label.toLocaleLowerCase('id-ID').startsWith(needle)) return index;
  }
  return -1;
}

/**
 * A select-only combobox (WAI-ARIA APG "Select-Only Combobox") on the iOS glass: the field shows
 * the chosen option; the list opens as a glass panel under it, scrolls when long, and marks the
 * chosen option with a tick. Keyboard: ↓/↑/Enter/Space open it; ↓/↑/Home/End move, Enter/Space
 * choose, Escape and Tab close; typing a letter jumps to the next option starting with it.
 */
export function GlassSelect({ labelledBy, value, options, onChange }: GlassSelectProps) {
  const listId = useId();
  const optionId = (index: number) => `${listId}-${String(index)}`;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const show = (index = selectedIndex) => {
    setActive(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  // Close on a press anywhere outside the control.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Keep the active option in view while moving through a long list. Only the list scrolls (the
  // page never does), so its scrollTop is set directly; the list is the options' offset parent.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const option = list.children[active];
    if (!(option instanceof HTMLElement)) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    const moves: Partial<Record<string, number>> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
      PageDown: Math.min(last, active + 8),
      PageUp: Math.max(0, active - 8),
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      setActive(move);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead: letters typed within a second build one search text.
      const now = Date.now();
      const text = now - typed.current.at < 1000 ? typed.current.text + event.key : event.key;
      typed.current = { text, at: now };
      const found = findByPrefix(options, text, text.length > 1 ? active - 1 : active);
      if (found >= 0) setActive(found);
    }
  };

  const current = options[selectedIndex];

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        role="combobox"
        className={`glass-field ${styles.field}`}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={onKeyDown}
      >
        <span className={styles.value}>
          {current?.label}
          {current?.detail && <span className={styles.detail}> {current.detail}</span>}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={labelledBy}
        className={`glass ${styles.list}`}
        hidden={!open}
        tabIndex={-1}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={index === selectedIndex}
            className={styles.option}
            data-active={(open && index === active) || undefined}
            // Focus stays on the field (aria-activedescendant pattern), so the option takes the
            // pointer only: pressing it does not move focus, releasing it chooses it.
            onPointerEnter={() => {
              setActive(index);
            }}
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onPointerUp={() => {
              choose(index);
            }}
          >
            <span className={styles.optionText}>
              {option.label}
              {option.detail && <span className={styles.detail}>{option.detail}</span>}
            </span>
            <span className={styles.tick} aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
