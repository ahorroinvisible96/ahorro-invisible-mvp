import React, { useState, useRef, useEffect } from 'react';
import styles from './Dropdown.module.css';

// Icono SVG para el dropdown
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-5 h-5'}>
    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" />
  </svg>
);

export interface DropdownItem {
  /**
   * Valor único del item
   */
  value: string;
  
  /**
   * Texto a mostrar
   */
  label: React.ReactNode;
  
  /**
   * Icono opcional
   */
  icon?: React.ReactNode;
  
  /**
   * Indica si el item está deshabilitado
   */
  disabled?: boolean;
}

export interface DropdownProps {
  /**
   * Texto del trigger
   */
  placeholder?: string;
  
  /**
   * Valor seleccionado
   */
  value?: string;
  
  /**
   * Función que se ejecuta al seleccionar un item
   */
  onChange?: (value: string) => void;
  
  /**
   * Lista de items
   */
  items: DropdownItem[];
  
  /**
   * Alinear el menú a la derecha
   */
  alignRight?: boolean;
  
  /**
   * Ancho completo
   */
  fullWidth?: boolean;
  
  /**
   * Deshabilitar el dropdown
   */
  disabled?: boolean;
  
  /**
   * Elemento personalizado para el trigger
   */
  customTrigger?: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  placeholder = 'Seleccionar',
  value,
  onChange,
  items,
  alignRight = false,
  fullWidth = false,
  disabled = false,
  customTrigger,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Encontrar el item seleccionado
  const selectedItem = items.find(item => item.value === value);
  
  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Manejar clic en el trigger
  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };
  
  // Manejar selección de item
  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled && onChange) {
      onChange(item.value);
      setIsOpen(false);
    }
  };
  
  // Clases del dropdown
  const dropdownClasses = [
    styles.dropdown,
    fullWidth ? 'w-full' : '',
    className
  ].filter(Boolean).join(' ');
  
  // Clases del menú
  const menuClasses = [
    styles.menu,
    alignRight ? styles.menuRight : '',
    fullWidth ? styles.menuFullWidth : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div className={dropdownClasses} ref={dropdownRef}>
      {customTrigger ? (
        <div onClick={handleTriggerClick}>
          {customTrigger}
        </div>
      ) : (
        <button
          type="button"
          className={styles.trigger}
          onClick={handleTriggerClick}
          disabled={disabled}
        >
          <span>{selectedItem ? selectedItem.label : placeholder}</span>
          <ChevronDownIcon className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ''}`} />
        </button>
      )}
      
      {isOpen && (
        <div className={menuClasses}>
          {items.map((item, index) => (
            <React.Fragment key={item.value}>
              <div
                className={`
                  ${styles.item}
                  ${item.value === value ? styles.itemActive : ''}
                  ${item.disabled ? styles.itemDisabled : ''}
                `}
                onClick={() => handleItemClick(item)}
              >
                {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                {item.label}
              </div>
              {index < items.length - 1 && <div className={styles.divider} />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export interface DropdownMenuProps {
  /**
   * Elemento trigger
   */
  trigger: React.ReactNode;
  
  /**
   * Contenido del menú
   */
  children: React.ReactNode;
  
  /**
   * Alinear el menú a la derecha
   */
  alignRight?: boolean;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  children,
  alignRight = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Manejar clic en el trigger
  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };
  
  // Clases del dropdown
  const dropdownClasses = [
    styles.dropdown,
    className
  ].filter(Boolean).join(' ');
  
  // Clases del menú
  const menuClasses = [
    styles.menu,
    alignRight ? styles.menuRight : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div className={dropdownClasses} ref={dropdownRef}>
      <div onClick={handleTriggerClick}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className={menuClasses}>
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownItem: React.FC<{
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({
  children,
  icon,
  active = false,
  disabled = false,
  onClick
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };
  
  return (
    <div
      className={`
        ${styles.item}
        ${active ? styles.itemActive : ''}
        ${disabled ? styles.itemDisabled : ''}
      `}
      onClick={handleClick}
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      {children}
    </div>
  );
};

export const DropdownDivider: React.FC = () => {
  return <div className={styles.divider} />;
};

export const DropdownHeader: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return <div className={styles.header}>{children}</div>;
};

export default Object.assign(Dropdown, {
  Menu: DropdownMenu,
  Item: DropdownItem,
  Divider: DropdownDivider,
  Header: DropdownHeader
});
