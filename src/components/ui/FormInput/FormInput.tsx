import React, { forwardRef, useId } from 'react';
import styles from './FormInput.module.css';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Etiqueta del campo */
  label?: string;
  /** Mensaje de error */
  error?: string;
  /** Mensaje de éxito */
  success?: string;
  /** Texto de ayuda */
  hint?: string;
  /** Variante: default (widget) o auth (auth pages, fondo más oscuro) */
  variant?: 'default' | 'auth';
  /** Clases adicionales para el contenedor */
  containerClassName?: string;
  /** Clases adicionales para el input */
  className?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, success, hint, variant = 'default', containerClassName = '', className = '', id: externalId, ...props }, ref) => {
    const autoId = useId();
    const inputId = externalId || autoId;
    const feedbackId = `${inputId}-feedback`;
    const hasFeedback = !!(error || success || hint);

    const containerClasses = [
      styles.container,
      containerClassName
    ].filter(Boolean).join(' ');
    
    const inputClasses = [
      styles.input,
      variant === 'auth' ? styles.authVariant : '',
      error ? styles.error : '',
      success ? styles.success : '',
      className
    ].filter(Boolean).join(' ');
    
    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasFeedback ? feedbackId : undefined}
          {...props}
        />
        
        {error && (
          <div id={feedbackId} className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}
        {success && !error && (
          <div id={feedbackId} className={styles.successMessage}>
            {success}
          </div>
        )}
        {hint && !error && !success && (
          <div id={feedbackId} className={styles.hintMessage}>
            {hint}
          </div>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
