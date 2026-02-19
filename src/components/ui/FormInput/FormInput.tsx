import React, { forwardRef } from 'react';
import styles from './FormInput.module.css';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Etiqueta del campo
   */
  label?: string;
  
  /**
   * Mensaje de error
   */
  error?: string;
  
  /**
   * Clases adicionales para el contenedor
   */
  containerClassName?: string;
  
  /**
   * Clases adicionales para el input
   */
  className?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, containerClassName = '', className = '', ...props }, ref) => {
    const containerClasses = [
      styles.container,
      containerClassName
    ].filter(Boolean).join(' ');
    
    const inputClasses = [
      styles.input,
      error ? styles.error : '',
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
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
