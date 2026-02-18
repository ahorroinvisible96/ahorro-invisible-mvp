import React, { forwardRef } from 'react';
import styles from './Form.module.css';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /**
   * Contenido del formulario
   */
  children: React.ReactNode;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(
  ({ children, className = '', ...props }, ref) => {
    const formClasses = [
      styles.form,
      className
    ].filter(Boolean).join(' ');

    return (
      <form ref={ref} className={formClasses} {...props}>
        {children}
      </form>
    );
  }
);

Form.displayName = 'Form';

export interface FormGroupProps {
  /**
   * Contenido del grupo
   */
  children: React.ReactNode;
  
  /**
   * Mostrar en línea
   */
  inline?: boolean;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  inline = false,
  className = '',
}) => {
  const groupClasses = [
    styles.formGroup,
    inline ? styles.formGroupInline : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClasses}>
      {children}
    </div>
  );
};

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Texto de la etiqueta
   */
  children: React.ReactNode;
  
  /**
   * Mostrar en línea
   */
  inline?: boolean;
  
  /**
   * Campo requerido
   */
  required?: boolean;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormLabel: React.FC<FormLabelProps> = ({
  children,
  inline = false,
  required = false,
  className = '',
  ...props
}) => {
  const labelClasses = [
    styles.label,
    inline ? styles.labelInline : '',
    required ? styles.labelRequired : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <label className={labelClasses} {...props}>
      {children}
    </label>
  );
};

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error del campo
   */
  error?: string;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ error, className = '', ...props }, ref) => {
    const inputClasses = [
      styles.input,
      error ? styles.inputError : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <>
        <input ref={ref} className={inputClasses} {...props} />
        {error && <div className={styles.error}>{error}</div>}
      </>
    );
  }
);

FormInput.displayName = 'FormInput';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Error del campo
   */
  error?: string;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    const textareaClasses = [
      styles.input,
      styles.textarea,
      error ? styles.inputError : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <>
        <textarea ref={ref} className={textareaClasses} {...props} />
        {error && <div className={styles.error}>{error}</div>}
      </>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Opciones del select
   */
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  
  /**
   * Error del campo
   */
  error?: string;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ options, error, className = '', ...props }, ref) => {
    const selectClasses = [
      styles.input,
      styles.select,
      error ? styles.inputError : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <>
        <select ref={ref} className={selectClasses} {...props}>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error && <div className={styles.error}>{error}</div>}
      </>
    );
  }
);

FormSelect.displayName = 'FormSelect';

export interface FormCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Etiqueta del checkbox
   */
  label: React.ReactNode;
  
  /**
   * Error del campo
   */
  error?: string;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const checkboxClasses = [
      styles.checkbox,
      className
    ].filter(Boolean).join(' ');

    return (
      <>
        <label className={checkboxClasses}>
          <input
            ref={ref}
            type="checkbox"
            className={styles.checkboxInput}
            {...props}
          />
          <span className={styles.checkboxLabel}>{label}</span>
        </label>
        {error && <div className={styles.error}>{error}</div>}
      </>
    );
  }
);

FormCheckbox.displayName = 'FormCheckbox';

export interface FormRadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Etiqueta del radio
   */
  label: React.ReactNode;
  
  /**
   * Error del campo
   */
  error?: string;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormRadio = forwardRef<HTMLInputElement, FormRadioProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const radioClasses = [
      styles.radio,
      className
    ].filter(Boolean).join(' ');

    return (
      <>
        <label className={radioClasses}>
          <input
            ref={ref}
            type="radio"
            className={styles.radioInput}
            {...props}
          />
          <span className={styles.radioLabel}>{label}</span>
        </label>
        {error && <div className={styles.error}>{error}</div>}
      </>
    );
  }
);

FormRadio.displayName = 'FormRadio';

export interface FormErrorProps {
  /**
   * Mensaje de error
   */
  children: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({
  children,
  className = '',
}) => {
  const errorClasses = [
    styles.error,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={errorClasses}>
      {children}
    </div>
  );
};

export interface FormHintProps {
  /**
   * Texto de ayuda
   */
  children: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormHint: React.FC<FormHintProps> = ({
  children,
  className = '',
}) => {
  const hintClasses = [
    styles.hint,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={hintClasses}>
      {children}
    </div>
  );
};

export interface FormActionsProps {
  /**
   * Contenido de las acciones
   */
  children: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  className = '',
}) => {
  const actionsClasses = [
    styles.actions,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={actionsClasses}>
      {children}
    </div>
  );
};

export interface FormInputGroupProps {
  /**
   * Contenido del grupo
   */
  children: React.ReactNode;
  
  /**
   * Addon izquierdo
   */
  addonLeft?: React.ReactNode;
  
  /**
   * Addon derecho
   */
  addonRight?: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const FormInputGroup: React.FC<FormInputGroupProps> = ({
  children,
  addonLeft,
  addonRight,
  className = '',
}) => {
  const groupClasses = [
    styles.inputGroup,
    className
  ].filter(Boolean).join(' ');

  // Clonar el hijo para añadir clases adicionales
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<{ className?: string }>;
      const prevClass = el.props?.className ?? '';
      const nextClass = [
        prevClass,
        styles.inputGroupInput,
        !addonLeft ? styles.inputGroupInputLeft : '',
        !addonRight ? styles.inputGroupInputRight : ''
      ].filter(Boolean).join(' ');

      return React.cloneElement(el, {
        className: nextClass
      });
    }
    return child;
  });

  return (
    <div className={groupClasses}>
      {addonLeft && (
        <div className={`${styles.inputGroupAddon} ${styles.inputGroupAddonLeft}`}>
          {addonLeft}
        </div>
      )}
      
      {childrenWithProps}
      
      {addonRight && (
        <div className={`${styles.inputGroupAddon} ${styles.inputGroupAddonRight}`}>
          {addonRight}
        </div>
      )}
    </div>
  );
};

export default Object.assign(Form, {
  Group: FormGroup,
  Label: FormLabel,
  Input: FormInput,
  Textarea: FormTextarea,
  Select: FormSelect,
  Checkbox: FormCheckbox,
  Radio: FormRadio,
  Error: FormError,
  Hint: FormHint,
  Actions: FormActions,
  InputGroup: FormInputGroup
});
