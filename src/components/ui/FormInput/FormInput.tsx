import React, { forwardRef } from 'react';
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
  ({ label, error, success, hint, variant = 'default', containerClassName = '', className = '', ...props }, ref) => {
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
          <label className={styles.label}>
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          className={inputClasses}
          {...props}
        />
        
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        {success && !error && (
          <div className={styles.successMessage}>
            {success}
          </div>
        )}
        {hint && !error && !success && (
          <div className={styles.hintMessage}>
            {hint}
          </div>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
