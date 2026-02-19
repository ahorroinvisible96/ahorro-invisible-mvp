import React from 'react';
import styles from './OptionButton.module.css';

export interface OptionButtonProps {
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

export const OptionButton: React.FC<OptionButtonProps> = ({
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

export default OptionButton;
