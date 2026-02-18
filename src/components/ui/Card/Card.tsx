import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Variante de la tarjeta
   */
  variant?: 'default' | 'primary' | 'success' | 'highlight' | 'gradient';
  
  /**
   * Tamaño de la tarjeta (padding)
   */
  size?: 'sm' | 'md' | 'lg' | 'none';
  
  /**
   * Hacer la tarjeta interactiva (efectos hover)
   */
  interactive?: boolean;
  
  /**
   * Usar bordes más redondeados (border-radius-2xl)
   */
  rounded2xl?: boolean;
  
  /**
   * Aplicar sombra mediana
   */
  shadowMd?: boolean;
  
  /**
   * Aplicar sombra azul
   */
  shadowBlue?: boolean;
  
  /**
   * Ancho completo
   */
  fullWidth?: boolean;
  
  /**
   * Contenido de la tarjeta
   */
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      size = 'md',
      interactive = false,
      rounded2xl = false,
      shadowMd = false,
      shadowBlue = false,
      fullWidth = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const cardClasses = [
      styles.card,
      styles[variant],
      size !== 'none' ? styles[size] : styles.noPadding,
      interactive ? styles.interactive : '',
      rounded2xl ? styles.rounded2xl : '',
      shadowMd ? styles['shadow-md'] : '',
      shadowBlue ? styles['shadow-blue'] : '',
      fullWidth ? styles.fullWidth : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <div
        ref={ref}
        className={cardClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader = ({
  title,
  subtitle,
  action,
  className = '',
  children,
  ...props
}: CardHeaderProps) => {
  const headerClasses = [styles.header, className].filter(Boolean).join(' ');

  return (
    <div className={headerClasses} {...props}>
      <div>
        {title && <h3 className={styles.title}>{title}</h3>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = ({
  className = '',
  children,
  ...props
}: CardContentProps) => {
  const contentClasses = [styles.content, className].filter(Boolean).join(' ');

  return (
    <div className={contentClasses} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = ({
  className = '',
  children,
  ...props
}: CardFooterProps) => {
  const footerClasses = [styles.footer, className].filter(Boolean).join(' ');

  return (
    <div className={footerClasses} {...props}>
      {children}
    </div>
  );
};

export default Object.assign(Card, {
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter
});
