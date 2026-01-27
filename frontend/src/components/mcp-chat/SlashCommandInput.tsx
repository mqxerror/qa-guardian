// Feature #1698: Slash Command Input Component
// Input field with autocomplete dropdown for slash commands

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { slashCommandRegistry } from './SlashCommandRegistry';
import { SlashCommandSuggestion } from './types';

interface SlashCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SlashCommandInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your message... (e.g., 'Run the auth tests' or '/' for commands)",
}: SlashCommandInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommandSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update suggestions when input changes
  useEffect(() => {
    if (value.startsWith('/') && !value.includes(' ')) {
      const newSuggestions = slashCommandRegistry.getSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [value]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Select a suggestion
  const selectSuggestion = useCallback((suggestion: SlashCommandSuggestion) => {
    const hasParams = suggestion.usage.includes('[');
    onChange(suggestion.command + (hasParams ? ' ' : ''));
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }, [showSuggestions, suggestions, selectedIndex, selectSuggestion, onSubmit]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (value.startsWith('/') && !value.includes(' ')) {
      const newSuggestions = slashCommandRegistry.getSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    }
  }, [value]);

  // Handle blur with delay to allow click on suggestions
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  return (
    <div className="relative">
      {/* Autocomplete Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Slash Commands</span>
            <span className="text-xs text-muted-foreground ml-2">
              (Tab to select)
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, idx) => (
              <button
                key={suggestion.command}
                onClick={() => selectSuggestion(suggestion)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
                  idx === selectedIndex ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <code className="px-2 py-1 rounded bg-primary/10 text-primary font-mono text-sm">
                    {suggestion.command}
                  </code>
                  {suggestion.usage !== suggestion.command && (
                    <span className="text-xs text-muted-foreground">
                      {suggestion.usage.replace(suggestion.command, '').trim()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {suggestion.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Field */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={disabled}
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
