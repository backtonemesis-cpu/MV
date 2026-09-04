import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import type { CardDensityPreference, NavTab } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onSetDensity: (density: CardDensityPreference) => void;
}

type PaletteCommand = {
  command: string;
  description: string;
  run: () => void;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSetDensity,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        command: '/home',
        description: 'Open Home dashboard',
        run: () => onNavigate('dashboard'),
      },
      {
        command: '/activity',
        description: 'Open Activity ledger',
        run: () => onNavigate('activity'),
      },
      {
        command: '/settings',
        description: 'Open Settings',
        run: () => onNavigate('settings'),
      },
      {
        command: '/compact',
        description: 'Use compact card density',
        run: () => onSetDensity('compact'),
      },
      {
        command: '/comfortable',
        description: 'Use comfortable card density',
        run: () => onSetDensity('comfortable'),
      },
    ],
    [onNavigate, onSetDensity]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCommands = useMemo(
    () =>
      normalizedQuery
        ? commands.filter(
            (item) =>
              item.command.includes(normalizedQuery) ||
              item.description.toLowerCase().includes(normalizedQuery)
          )
        : commands,
    [commands, normalizedQuery]
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const executeCommand = (command: PaletteCommand) => {
    command.run();
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const exact = commands.find((item) => item.command === normalizedQuery);
    const command = exact || filteredCommands[0];
    if (command) executeCommand(command);
  };

  return (
    <div
      className="mv-command-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mv-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="mv-command-search-row">
          <Command className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <form onSubmit={handleSubmit} className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="mv-command-input">
              Command
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                id="mv-command-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type /home, /activity, /settings…"
                autoComplete="off"
                spellCheck={false}
                className="mv-command-input"
              />
            </div>
          </form>
          <button
            type="button"
            onClick={onClose}
            className="mv-command-close"
            aria-label="Close command palette"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mv-command-list" role="listbox" aria-label="Available commands">
          {filteredCommands.length === 0 ? (
            <div className="mv-command-empty">No matching command</div>
          ) : (
            filteredCommands.map((item) => (
              <button
                key={item.command}
                type="button"
                className="mv-command-item"
                onClick={() => executeCommand(item)}
              >
                <span className="mv-command-token">{item.command}</span>
                <span className="mv-command-description">{item.description}</span>
              </button>
            ))
          )}
        </div>

        <div className="mv-command-footer">
          <span>Enter to run</span>
          <span>Esc to close</span>
        </div>
      </section>
    </div>
  );
};
