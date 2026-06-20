"use client";

import React, { useEffect, useRef } from 'react';
import styles from './ChoiceQuestion.module.css';

export interface ChoiceOption {
  label: string;
  value: string;
}

interface ChoiceQuestionProps {
  /** The question text */
  question: string;
  /** Options to choose from */
  options: ChoiceOption[];
  /** Currently selected value */
  value: string | null;
  /** Custom text if user chose "Otro" */
  customText?: string;
  /** Callback when an option is selected */
  onSelect: (value: string) => void;
  /** Callback when custom text changes (required if allowOther=true) */
  onCustomTextChange?: (text: string) => void;
  /** Whether to show "Otro" option with free text */
  allowOther?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function ChoiceQuestion({
  question,
  options,
  value,
  customText = '',
  onSelect,
  onCustomTextChange,
  allowOther = false,
  disabled = false,
}: ChoiceQuestionProps): React.ReactElement {
  const customInputRef = useRef<HTMLInputElement>(null);
  const isCustom = value === '__custom__';

  // Focus custom input when "Otro" selected
  useEffect(() => {
    if (isCustom && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isCustom]);

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.question}>{question}</h2>
      <div className={styles.options}>
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.option} ${value === opt.value ? styles.optionSelected : ''} ${disabled ? styles.optionDisabled : ''}`}
            onClick={() => !disabled && onSelect(opt.value)}
            disabled={disabled}
          >
            <span className={styles.optionIndex}>{String.fromCharCode(65 + i)}</span>
            <span className={styles.optionLabel}>{opt.label}</span>
            {value === opt.value && (
              <svg className={styles.optionCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        ))}

        {/* Opción "Otro" con texto libre */}
        {allowOther && (
          <>
            <div className={styles.divider} />
            <button
              type="button"
              className={`${styles.option} ${styles.optionOther} ${isCustom ? styles.optionSelected : ''} ${disabled ? styles.optionDisabled : ''}`}
              onClick={() => !disabled && onSelect('__custom__')}
              disabled={disabled}
            >
              <span className={styles.optionIndex}>✏️</span>
              <span className={styles.optionLabel}>Otro...</span>
              {isCustom && (
                <svg className={styles.optionCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          </>
        )}
      </div>

      {/* Input de texto libre para "Otro" */}
      {isCustom && (
        <div className={styles.customInputWrap}>
          <input
            ref={customInputRef}
            type="text"
            className={styles.customInput}
            value={customText}
            onChange={(e) => onCustomTextChange?.(e.target.value)}
            placeholder="Escribe tu respuesta..."
            maxLength={100}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export default ChoiceQuestion;
