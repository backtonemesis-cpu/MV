import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface MVSelectOption {
  value: string;
  label: React.ReactNode;
  textValue?: string;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

interface MVSelectPopoverProps {
  listboxId: string;
  label?: string;
  labelledBy?: string;
  options: MVSelectOption[];
  value: string;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  anchor: HTMLElement;
  onChoose: (option: MVSelectOption) => void;
  onClose: (restoreFocus?: boolean) => void;
  onTabAway: (reverse: boolean) => void;
}

interface PopupPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

const VIEWPORT_GUTTER = 8;
const POPUP_GAP = 4;
const PREFERRED_MAX_HEIGHT = 320;
const MIN_USEFUL_HEIGHT = 144;

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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

function edgeEnabledIndex(options: MVSelectOption[], edge: 'first' | 'last'): number {
  if (edge === 'first') return options.findIndex((option) => !option.disabled);
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function initialActiveIndex(options: MVSelectOption[], value: string): number {
  const selected = options.findIndex((option) => option.value === value && !option.disabled);
  return selected >= 0 ? selected : edgeEnabledIndex(options, 'first');
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
    Math.min(rect.width, viewportWidth - VIEWPORT_GUTTER * 2)
  );
  const left = Math.min(
    Math.max(rect.left, viewportLeft + VIEWPORT_GUTTER),
    Math.max(viewportLeft + VIEWPORT_GUTTER, viewportRight - VIEWPORT_GUTTER - width)
  );

  const spaceBelow = Math.max(0, viewportBottom - rect.bottom - POPUP_GAP - VIEWPORT_GUTTER);
  const spaceAbove = Math.max(0, rect.top - viewportTop - POPUP_GAP - VIEWPORT_GUTTER);
  const openAbove = spaceBelow < MIN_USEFUL_HEIGHT && spaceAbove > spaceBelow;
  const available = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(80, Math.min(PREFERRED_MAX_HEIGHT, available));
  const top = openAbove
    ? Math.max(viewportTop + VIEWPORT_GUTTER, rect.top - POPUP_GAP - maxHeight)
    : Math.min(viewportBottom - VIEWPORT_GUTTER - maxHeight, rect.bottom + POPUP_GAP);

  return { left, top, width, maxHeight };
}

function focusRelativeTo(anchor: HTMLElement, reverse: boolean): void {
  const modal = anchor.closest('[role="dialog"][aria-modal="true"]') as HTMLElement | null;
  const focusScope: ParentNode = modal ?? document;
  const candidates = Array.from(
    focusScope.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.closest('[data-mv-select-popover]') && isElementVisible(element));
  const index = candidates.indexOf(anchor);
  if (index < 0) return;
  const nextIndex = index + (reverse ? -1 : 1);
  const target =
    candidates[nextIndex] ??
    (modal ? candidates[reverse ? candidates.length - 1 : 0] : undefined);
  target?.focus({ preventScroll: true });
}

const MVSelectPopover: React.FC<MVSelectPopoverProps> = ({
  listboxId,
  label,
  labelledBy,
  options,
  value,
  activeIndex,
  setActiveIndex,
  anchor,
  onChoose,
  onClose,
  onTabAway,
}) => {
  const listboxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopupPosition>(() =>
    calculatePopupPosition(anchor)
  );

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
      listboxRef.current?.focus({ preventScroll: true });
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
      if (listboxRef.current?.contains(event.target) || anchor.contains(event.target)) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [anchor, onClose]);

  useEffect(() => {
    const option = listboxRef.current?.querySelector<HTMLElement>(
      `[data-mv-option-index="${activeIndex}"]`
    );
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const activeId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = nextEnabledIndex(options, activeIndex, 1);
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = nextEnabledIndex(options, activeIndex, -1);
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      const next = edgeEnabledIndex(options, 'first');
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const next = edgeEnabledIndex(options, 'last');
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
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
      ref={listboxRef}
      id={listboxId}
      className="mv-select-popover"
      data-mv-select-popover
      role="listbox"
      aria-label={label || (!labelledBy ? 'Options' : undefined)}
      aria-labelledby={label ? undefined : labelledBy}
      aria-activedescendant={activeId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const active = index === activeIndex;
        return (
          <div
            key={`${option.value}-${index}`}
            id={`${listboxId}-option-${index}`}
            className={`mv-select-option ${selected ? 'is-selected' : ''} ${
              active ? 'is-active' : ''
            } ${option.disabled ? 'is-disabled' : ''}`.trim()}
            data-mv-option-index={index}
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
              <span className="mv-select-option-primary" data-mv-value-primary>
                {option.label}
              </span>
              {(option.secondary || option.disabledReason) && (
                <span className="mv-select-option-secondary">
                  {option.disabledReason || option.secondary}
                </span>
              )}
            </span>
            {option.trailing && (
              <span className="mv-select-option-trailing">{option.trailing}</span>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export interface MVSelectProps {
  id: string;
  value: string;
  options: MVSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  className?: string;
  showSelectedSecondary?: boolean;
}

export const MVSelect: React.FC<MVSelectProps> = ({
  id,
  value,
  options,
  onValueChange,
  placeholder = 'Select',
  emptyMessage = 'No options available',
  ariaLabel,
  ariaLabelledBy,
  required = false,
  disabled = false,
  invalid = false,
  autoFocus = false,
  className = '',
  showSelectedSecondary = false,
}) => {
  const generatedId = useId().replace(/:/g, '');
  const listboxId = `${id || generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => initialActiveIndex(options, value));
  const selectedOption = options.find((option) => option.value === value);
  const hasOptions = options.length > 0;

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(initialActiveIndex(options, value));
  }, [open, options, value]);

  useEffect(() => {
    if (open && !hasOptions) close(false);
  }, [open, hasOptions, close]);

  const openList = (edge?: 'first' | 'last') => {
    if (disabled || !hasOptions) return;
    const next = edge
      ? edgeEnabledIndex(options, edge)
      : initialActiveIndex(options, value);
    setActiveIndex(next);
    setOpen(true);
  };

  const choose = (option: MVSelectOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    close(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openList('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openList('last');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openList();
    }
  };

  const triggerText = hasOptions ? selectedOption?.label ?? placeholder : emptyMessage;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        autoFocus={autoFocus}
        className={`mv-select-trigger ${selectedOption ? '' : 'is-placeholder'} ${
          hasOptions ? '' : 'is-empty'
        } ${className}`.trim()}
        disabled={disabled}
        aria-haspopup={hasOptions ? 'listbox' : undefined}
        aria-expanded={hasOptions ? open : undefined}
        aria-controls={open && hasOptions ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || !hasOptions || undefined}
        onClick={() => {
          if (!hasOptions) return;
          if (open) close(false);
          else openList();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="mv-select-trigger-copy">
          <span className="mv-select-trigger-primary" data-mv-value-primary>
            {triggerText}
          </span>
          {hasOptions && showSelectedSecondary && selectedOption?.secondary && (
            <span className="mv-select-trigger-secondary">{selectedOption.secondary}</span>
          )}
        </span>
        {hasOptions && <ChevronDown className="mv-select-chevron" aria-hidden="true" />}
      </button>
      {open && hasOptions && triggerRef.current && (
        <MVSelectPopover
          listboxId={listboxId}
          label={ariaLabel}
          labelledBy={ariaLabelledBy}
          options={options}
          value={value}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          anchor={triggerRef.current}
          onChoose={choose}
          onClose={close}
          onTabAway={(reverse) => {
            const trigger = triggerRef.current;
            setOpen(false);
            if (trigger) window.requestAnimationFrame(() => focusRelativeTo(trigger, reverse));
          }}
        />
      )}
    </>
  );
};
