import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

// Icono SVG para el botón de cerrar
const CloseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-6 h-6'}>
    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

export interface ModalProps {
  /**
   * Controla si el modal está abierto
   */
  isOpen: boolean;
  
  /**
   * Función para cerrar el modal
   */
  onClose: () => void;
  
  /**
   * Título del modal
   */
  title?: React.ReactNode;
  
  /**
   * Tamaño del modal
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /**
   * Cerrar al hacer clic fuera del modal
   */
  closeOnOverlayClick?: boolean;
  
  /**
   * Cerrar al presionar la tecla Escape
   */
  closeOnEsc?: boolean;
  
  /**
   * Mostrar botón de cerrar
   */
  showCloseButton?: boolean;
  
  /**
   * Contenido del modal
   */
  children: React.ReactNode;
  
  /**
   * Contenido del footer
   */
  footer?: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  children,
  footer,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Manejar cierre con tecla Escape
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden'; // Prevenir scroll en el body
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = ''; // Restaurar scroll
    };
  }, [isOpen, closeOnEsc, onClose]);
  
  // Manejar clic fuera del modal
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // No renderizar si el modal no está abierto
  if (!isOpen) return null;
  
  // Clases del modal
  const modalClasses = [
    styles.modal,
    styles[`modal${size.charAt(0).toUpperCase() + size.slice(1)}`],
    className
  ].filter(Boolean).join(' ');
  
  // Crear portal para renderizar el modal fuera del flujo normal del DOM
  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={modalClasses} ref={modalRef}>
        {(title || showCloseButton) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showCloseButton && (
              <button 
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Cerrar"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}
        
        <div className={styles.content}>
          {children}
        </div>
        
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
