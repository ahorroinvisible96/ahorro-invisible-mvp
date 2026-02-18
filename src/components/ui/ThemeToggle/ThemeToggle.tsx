import React, { useState, useEffect, useRef } from 'react';
import { getTheme, applyTheme, Theme } from '@/styles/themes';
import styles from './ThemeToggle.module.css';

// Iconos SVG
const SunIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
  </svg>
);

const ComputerIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M2.25 5.25a3 3 0 013-3h13.5a3 3 0 013 3V15a3 3 0 01-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 01-.53 1.28h-9a.75.75 0 01-.53-1.28l.621-.622a2.25 2.25 0 00.659-1.59V18h-3a3 3 0 01-3-3V5.25zm1.5 0v9.75c0 .83.67 1.5 1.5 1.5h13.5c.83 0 1.5-.67 1.5-1.5V5.25c0-.83-.67-1.5-1.5-1.5H5.25c-.83 0-1.5.67-1.5 1.5z" clipRule="evenodd" />
  </svg>
);

interface ThemeToggleProps {
  /**
   * Clases adicionales
   */
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>('light');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inicializar tema
    const theme = getTheme();
    setCurrentTheme(theme);
    
    // Cerrar dropdown al hacer clic fuera
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
    setIsOpen(false);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <SunIcon className={`${styles.icon} ${styles.iconTransition} ${styles.iconVisible}`} />;
      case 'dark':
        return <MoonIcon className={`${styles.icon} ${styles.iconTransition} ${styles.iconVisible}`} />;
      case 'system':
        return <ComputerIcon className={`${styles.icon} ${styles.iconTransition} ${styles.iconVisible}`} />;
      default:
        return <SunIcon className={`${styles.icon} ${styles.iconTransition} ${styles.iconVisible}`} />;
    }
  };

  const toggleClasses = [
    styles.themeToggle,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        type="button"
        className={toggleClasses}
        onClick={handleToggle}
        aria-label="Cambiar tema"
      >
        {getThemeIcon()}
      </button>
      
      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div
            className={`${styles.dropdownItem} ${currentTheme === 'light' ? styles.dropdownItemActive : ''}`}
            onClick={() => handleThemeChange('light')}
          >
            <SunIcon className={styles.dropdownItemIcon} />
            <span className={styles.dropdownItemText}>Claro</span>
          </div>
          
          <div
            className={`${styles.dropdownItem} ${currentTheme === 'dark' ? styles.dropdownItemActive : ''}`}
            onClick={() => handleThemeChange('dark')}
          >
            <MoonIcon className={styles.dropdownItemIcon} />
            <span className={styles.dropdownItemText}>Oscuro</span>
          </div>
          
          <div
            className={`${styles.dropdownItem} ${currentTheme === 'system' ? styles.dropdownItemActive : ''}`}
            onClick={() => handleThemeChange('system')}
          >
            <ComputerIcon className={styles.dropdownItemIcon} />
            <span className={styles.dropdownItemText}>Sistema</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
