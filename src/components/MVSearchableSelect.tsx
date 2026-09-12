import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { MVSelectOption } from './MVSelect';

interface PopupPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export interface MVSearchableSelectProps {
  id: string;
  value: string;
  options: MVSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  noMatchesMessage?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  showSelectedSecondary?: boolean;
}

const VIEWPORT_GUTTER = 8;
const POPUP_GAP = 4;
const PREFERRED_MAX_HEIGHT = 360;
const MIN_USEFUL_HEIGHT = 176;

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function focusRelativeTo(anchor: HTMLElement, reverse: boolean): void {
  const modal = anchor.closest('[role="dialog"][aria-modal="true"]') as HTMLElement | null;
  const focusScope: ParentNode = modal ?? document;
  const candidates = Array.from(
    focusScope.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (element) =>
      !element.closest('[data-mv-searchable-select-popover]') && isElementVisible(element)
  );
  const index = candidates.indexOf(anchor);
  if (index < 0) return;
  const nextIndex = index + (reverse ? -1 : 1);
  const target =
    candidates[nextIndex] ??
    (modal ? candidates[reverse ? candidates.length - 1 : 0] : undefined);
  target?.focus({ preventScroll: true });
}

function calculatePopupPosition(anchor: HTMLElement): PopupPosition {
  const rect = anchor.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth = visualViewport?.width ?? window.innerWidth;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;

  const width = Math.max(
    0,
    Math.min(Math.max(rect.width, 240), viewportWidth - VIEWPORT_GUTTER * 2)
  );
  const left = Math.min(
    Math.max(rect.left, viewportLeft + VIEWPORT_GUTTER),
    Math.max(viewportLeft + VIEWPORT_GUTTER, viewportRight - VIEWPORT_GUTTER - width)
  );

  const spaceBelow = Math.max(
    0,
    viewportBottom - rect.bottom - POPUP_GAP - VIEWPORT_GUTTER
  );
  const spaceAbove = Math.max(
    0,
    rect.top - viewportTop - POPUP_GAP - VIEWPORT_GUTTER
  );
  const openAbove = spaceBelow < MIN_USEFUL_HEIGHT && spaceAbove > spaceBelow;
  const available = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, Math.min(PREFERRED_MAX_HEIGHT, available));
  const top = openAbove
    ? Math.max(viewportTop + VIEWPORT_GUTTER, rect.top - POPUP_GAP - maxHeight)
    : Math.min(
        viewportBottom - VIEWPORT_GUTTER - maxHeight,
        rect.bottom + POPUP_GAP
      );

  return { left, top, width, maxHeight };
}

function optionSearchText(option: MVSelectOption): string {
  const primary =
    option.textValue ??
    (typeof option.label === 'string' || typeof option.label === 'number'
      ? String(option.label)
      : option.value);
  const secondary =
    typeof option.secondary === 'string' || typeof option.secondary === 'number'
      ? String(option.secondary)
      : '';
  return `${primary} ${secondary}`.trim().toLocaleLowerCase('en-GB');
}

function edgeEnabledIndex(
  options: MVSelectOption[],
  edge: 'first' | 'last'
): number {
  if (edge === 'first') return options.findIndex((option) => !option.disabled);
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function nextEnabledIndex(
  options: MVSelectOption[],
  from: number,
  direction: 1 | -1
): number {
  if (options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (from + direction * offset + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function initialActiveIndex(options: MVSelectOption[], value: string): number {
  const selected = options.findIndex(
    (option) => option.value === value && !option.disabled
  );
  return selected >= 0 ? selected : edgeEnabledIndex(options, 'first');
}

interface SearchablePopoverProps {
  listboxId: string;
  label?: string;
  options: MVSelectOption[];
  value: string;
  anchor: HTMLElement;
  searchPlaceholder: string;
  noMatchesMessage: string;
  onChoose: (option: MVSelectOption) => void;
  onClose: (restoreFocus?: boolean) => void;
  onTabAway: (reverse: boolean) => void;
}

const SearchablePopover: React.FC<SearchablePopoverProps> = ({
  listboxId,
  label,
  options,
  value,
  anchor,
  searchPlaceholder,
  noMatchesMessage,
  onChoose,
  onClose,
  onTabAway,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PopupPosition>(() =>
    calculatePopupPosition(anchor)
  );

  const filteredOptions = useMemo(() => {
    const normalised = query.trim().toLocaleLowerCase('en-GB');
    if (!normalised) return options;
    return options.filter((option) => optionSearchText(option).includes(normalised));
  }, [options, query]);

  const [activeIndex, setActiveIndex] = useState(() =>
    initialActiveIndex(filteredOptions, value)
  );

  useEffect(() => {
    setActiveIndex(initialActiveIndex(filteredOptions, value));
  }, [filteredOptions, value]);

  const updatePosition = useCallback(() => {
    if (!anchor.isConnected) {
      onClose(false);
      return;
    }
    setPosition(calculatePopupPosition(anchor));
  }, [anchor, onClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      searchRef.current?.focus({ preventScroll: true });
    });
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    visualViewport?.addEventListener('resize', updatePosition);
    visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      visualViewport?.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) || anchor.contains(event.target)) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [anchor, onClose]);

  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-mv-search-option-index="${activeIndex}"]`
    );
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const activeId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = nextEnabledIndex(filteredOptions, activeIndex, 1);
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = nextEnabledIndex(filteredOptions, activeIndex, -1);
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      const next = edgeEnabledIndex(filteredOptions, 'first');
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const next = edgeEnabledIndex(filteredOptions, 'last');
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option && !option.disabled) onChoose(option);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      onTabAway(event.shiftKey);
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      className="mv-select-popover mv-searchable-select-popover"
      data-mv-searchable-select-popover
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      <div className="mv-searchable-select-search">
        <Search className="mv-searchable-select-search-icon" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          role="combobox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          className="mv-searchable-select-input"
          placeholder={searchPlaceholder}
          aria-label={label ? `Search ${label}` : 'Search options'}
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
        />
      </div>

      <div
        ref={listRef}
        id={listboxId}
        className="mv-searchable-select-list"
        role="listbox"
        aria-label={label ? `${label} options` : 'Options'}
      >
        {filteredOptions.length === 0 ? (
          <div className="mv-searchable-select-empty" role="status">
            {noMatchesMessage}
          </div>
        ) : (
          filteredOptions.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                key={`${option.value}-${index}`}
                id={`${listboxId}-option-${index}`}
                className={`mv-select-option ${selected ? 'is-selected' : ''} ${
                  active ? 'is-active' : ''
                } ${option.disabled ? 'is-disabled' : ''}`.trim()}
                data-mv-search-option-index={index}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => {
                  if (!option.disabled) setActiveIndex(index);
                }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) onChoose(option);
                }}
              >
                <span className="mv-select-option-check" aria-hidden="true">
                  {selected ? <Check /> : null}
                </span>
                <span className="mv-select-option-copy">
                  <span className="mv-select-option-primary">
                    {option.label}
                  </span>
                  {(option.secondary || option.disabledReason) && (
                    <span className="mv-select-option-secondary">
                      {option.disabledReason || option.secondary}
                    </span>
                  )}
                </span>
                {option.trailing && (
                  <span className="mv-select-option-trailing">
                    {option.trailing}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
};

export const MVSearchableSelect: React.FC<MVSearchableSelectProps> = ({
  id,
  value,
  options,
  onValueChange,
  placeholder = 'Select',
  emptyMessage = 'No options available',
  searchPlaceholder = 'Search options',
  noMatchesMessage = 'No matching options',
  ariaLabel,
  ariaLabelledBy,
  required = false,
  disabled = false,
  invalid = false,
  className = '',
  showSelectedSecondary = false,
}) => {
  const generatedId = useId().replace(/:/g, '');
  const listboxId = `${id || generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const hasOptions = options.length > 0;

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() =>
        triggerRef.current?.focus({ preventScroll: true })
      );
    }
  }, []);

  useEffect(() => {
    if (open && !hasOptions) close(false);
  }, [open, hasOptions, close]);

  const choose = (option: MVSelectOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    close(true);
  };

  const openList = () => {
    if (disabled || !hasOptions) return;
    setOpen(true);
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openList();
    }
  };

  const triggerText = hasOptions
    ? selectedOption?.label ?? placeholder
    : emptyMessage;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`mv-select-trigger ${
          selectedOption ? '' : 'is-placeholder'
        } ${hasOptions ? '' : 'is-empty'} ${className}`.trim()}
        disabled={disabled}
        aria-haspopup={hasOptions ? 'listbox' : undefined}
        aria-expanded={hasOptions ? open : undefined}
        aria-controls={open && hasOptions ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || !hasOptions || undefined}
        data-mv-searchable-select
        onClick={() => {
          if (!hasOptions) return;
          if (open) close(false);
          else openList();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="mv-select-trigger-copy">
          <span className="mv-select-trigger-primary">{triggerText}</span>
          {hasOptions && showSelectedSecondary && selectedOption?.secondary && (
            <span className="mv-select-trigger-secondary">
              {selectedOption.secondary}
            </span>
          )}
        </span>
        {hasOptions && (
          <ChevronDown className="mv-select-chevron" aria-hidden="true" />
        )}
      </button>

      {open && hasOptions && triggerRef.current && (
        <SearchablePopover
          listboxId={listboxId}
          label={ariaLabel}
          options={options}
          value={value}
          anchor={triggerRef.current}
          searchPlaceholder={searchPlaceholder}
          noMatchesMessage={noMatchesMessage}
          onChoose={choose}
          onClose={close}
          onTabAway={(reverse) => {
            const trigger = triggerRef.current;
            setOpen(false);
            if (trigger) {
              window.requestAnimationFrame(() =>
                focusRelativeTo(trigger, reverse)
              );
            }
          }}
        />
      )}
    </>
  );
};
