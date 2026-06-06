"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './FillBlankInput.module.css';

export interface FillBlankOption {
  label: string;
  value: string;
}

interface FillBlankInputProps {
  /** The sentence with ____ as placeholder for the blank */
  sentence: string;
  /** The 3 suggested options ("Otro" is added automatically) */
  options: FillBlankOption[];
  /** Currently selected value */
  value: string | null;
  /** Custom text if user chose "Otro" */
  customText: string;
  /** Callback when an option is selected */
  onSelect: (value: string) => void;
  /** Callback when custom text changes */
  onCustomTextChange: (text: string) => void;
  /** Disabled state */
  disabled?: boolean;
}

export function FillBlankInput({
  sentence,
  options,
  value,
  customText,
  onSelect,
  onCustomTextChange,
  disabled = false,
}: FillBlankInputProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const isCustom = value === '__custom__';
  const displayValue = isCustom ? customText : (value ? options.find(o => o.value === value)?.label ?? value : null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Lock body scroll when dropdown is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Focus custom input when "Otro" selected
  useEffect(() => {
    if (isCustom && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isCustom]);

  // Split sentence around ____
  const parts = sentence.split('____');
  const before = parts[0] || '';
  const after = parts.slice(1).join('____') || '';

  function handleSelect(val: string) {
    onSelect(val);
    if (val !== '__custom__') {
      setIsOpen(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.sentence}>
        <span>{before}</span>
        <span className={styles.blankContainer}>
          <button
            type="button"
            className={`${styles.blankButton} ${displayValue ? styles.blankFilled : ''} ${disabled ? styles.blankDisabled : ''}`}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
          >
            {displayValue || '...'}
            <svg className={`${styles.blankChevron} ${isOpen ? styles.blankChevronOpen : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </span>
        <span>{after}</span>
      </p>

      {/* Overlay centrado en pantalla */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div
            className={styles.dropdown}
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.dropdownLabel}>Elige una opción</p>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.dropdownOption} ${value === opt.value ? styles.dropdownOptionSelected : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
                {value === opt.value && (
                  <svg className={styles.dropdownCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
            <div className={styles.dropdownDivider} />
            <button
              type="button"
              className={`${styles.dropdownOption} ${styles.dropdownOptionOther} ${isCustom ? styles.dropdownOptionSelected : ''}`}
              onClick={() => handleSelect('__custom__')}
            >
              ✏️ Otro...
              {isCustom && (
                <svg className={styles.dropdownCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {isCustom && (
        <div className={styles.customInputWrap}>
          <input
            ref={customInputRef}
            type="text"
            className={styles.customInput}
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="Escribe tu respuesta..."
            maxLength={100}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export default FillBlankInput;
