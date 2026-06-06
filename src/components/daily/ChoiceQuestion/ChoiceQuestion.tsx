"use client";

import React from 'react';
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
  /** Callback when an option is selected */
  onSelect: (value: string) => void;
  /** Disabled state */
  disabled?: boolean;
}

export function ChoiceQuestion({
  question,
  options,
  value,
  onSelect,
  disabled = false,
}: ChoiceQuestionProps): React.ReactElement {
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
      </div>
    </div>
  );
}

export default ChoiceQuestion;
