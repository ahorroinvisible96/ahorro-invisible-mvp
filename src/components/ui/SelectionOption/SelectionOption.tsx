import React from 'react';
import styles from './SelectionOption.module.css';

export interface SelectionOptionProps {
  /**
   * Valor de la opción
   */
  value: string;
  
  /**
   * Etiqueta a mostrar
   */
  label: string;
  
  /**
   * Si está seleccionada
   */
  selected?: boolean;
  
  /**
   * Función al hacer clic
   */
  onClick?: () => void;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const SelectionOption: React.FC<SelectionOptionProps> = ({
  value,
  label,
  selected = false,
  onClick,
  className = '',
}) => {
  const optionClasses = [
    styles.option,
    selected ? styles.selected : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={optionClasses}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default SelectionOption;
