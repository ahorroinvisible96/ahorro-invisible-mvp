"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './FillBlankInput.module.css';

export interface FillBlankOption {
  label: string;
  value: string;
}

interface FillBlankInputProps {
  sentence: string;
  options: FillBlankOption[];
  value: string | null;
  customText: string;
  onSelect: (value: string) => void;
  onCustomTextChange: (text: string) => void;
  disabled?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function FillBlankInput({
  sentence,
  options,
  value,
  customText,
  onSelect,
  onCustomTextChange,
  disabled = false,
  onOpenChange,
}: FillBlankInputProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const isCustom = value === '__custom__';
  const displayValue = isCustom
    ? customText
    : value ? options.find(o => o.value === value)?.label ?? value : null;

  // Notificar al padre
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus en input "Otro"
  useEffect(() => {
    if (isCustom && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isCustom]);

  const BLANK = '[___]';
  const parts = sentence.split(BLANK);
  const before = parts[0] || '';
  const after = parts.slice(1).join(BLANK) || '';

  function handleSelect(val: string) {
    onSelect(val);
    if (val !== '__custom__') {
      setIsOpen(false);
    }
  }

  // Siempre mostramos la frase con el hueco inline
  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <p className={styles.sentence}>
        <span>{before}</span>
        <button
          type="button"
          className={`${styles.blankButton} ${displayValue ? styles.blankFilled : ''} ${disabled ? styles.blankDisabled : ''} ${isOpen ? styles.blankOpen : ''}`}
          onClick={() => !disabled && setIsOpen(o => !o)}
          disabled={disabled}
        >
          {displayValue || '...'}
          <svg
            className={`${styles.blankChevron} ${isOpen ? styles.blankChevronUp : ''}`}
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <span>{after}</span>
      </p>

      {isOpen && (
        <div className={styles.dropdown}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.dropdownOption} ${value === opt.value ? styles.dropdownOptionSelected : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className={styles.dropdownOptionLabel}>{opt.label}</span>
              {value === opt.value && (
                <svg className={styles.dropdownCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
          <div className={styles.dropdownDivider} />
          <div className={styles.dropdownOtherRow}>
            <button
              type="button"
              className={`${styles.dropdownOtherBtn} ${isCustom ? styles.dropdownOptionSelected : ''}`}
              onClick={() => handleSelect('__custom__')}
            >
              ✏️ Otro:
            </button>
            <input
              ref={customInputRef}
              type="text"
              className={styles.dropdownOtherInput}
              value={customText}
              onChange={e => onCustomTextChange(e.target.value)}
              placeholder="Escribe tu propia categoria..."
              maxLength={100}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FillBlankInput;
