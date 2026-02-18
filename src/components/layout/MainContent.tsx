import React from 'react';
import styles from './MainContent.module.css';

export interface MainContentProps {
  /**
   * Contenido principal
   */
  children: React.ReactNode;
  
  /**
   * Mostrar patrón de fondo
   */
  withPattern?: boolean;
  
  /**
   * Título del encabezado
   */
  title?: React.ReactNode;
  
  /**
   * Subtítulo del encabezado
   */
  subtitle?: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const MainContent: React.FC<MainContentProps> = ({
  children,
  withPattern = true,
  title,
  subtitle,
  className = '',
}) => {
  const mainClasses = [
    styles.mainContent,
    withPattern ? styles.withPattern : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <main className={mainClasses}>
      <div className={styles.container}>
        {(title || subtitle) && (
          <header className={styles.header}>
            {title && <h1 className={styles.headerTitle}>{title}</h1>}
            {subtitle && <p className={styles.headerSubtitle}>{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </main>
  );
};

export interface SectionProps {
  /**
   * Título de la sección
   */
  title?: React.ReactNode;
  
  /**
   * Contenido de la sección
   */
  children: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  className = '',
}) => {
  const sectionClasses = [
    styles.section,
    className
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClasses}>
      {title && <h2 className={styles.sectionTitle}>{title}</h2>}
      {children}
    </section>
  );
};

export interface GridProps {
  /**
   * Número de columnas
   */
  columns?: 1 | 2 | 3 | 4 | 12;
  
  /**
   * Contenido del grid
   */
  children: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  columns = 1,
  children,
  className = '',
}) => {
  const gridClasses = [
    styles.grid,
    styles[`grid${columns}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

export default Object.assign(MainContent, {
  Section,
  Grid
});
