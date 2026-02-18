import React, { useState, useMemo } from 'react';
import styles from './Table.module.css';

// Iconos SVG
const ChevronUpDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-4 h-4'}>
    <path fillRule="evenodd" d="M11.47 4.72a.75.75 0 011.06 0l3.75 3.75a.75.75 0 01-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 01-1.06-1.06l3.75-3.75zm-3.75 9.75a.75.75 0 011.06 0L12 17.69l3.22-3.22a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0l-3.75-3.75a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-4 h-4'}>
    <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-4 h-4'}>
    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'w-12 h-12'}>
    <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
  </svg>
);

export interface TableColumn<T> {
  /**
   * Clave única para la columna
   */
  key: string;
  
  /**
   * Título de la columna
   */
  title: React.ReactNode;
  
  /**
   * Función para renderizar el contenido de la celda
   */
  render?: (value: any, record: T, index: number) => React.ReactNode;
  
  /**
   * Alineación del texto
   */
  align?: 'left' | 'center' | 'right';
  
  /**
   * Ancho de la columna
   */
  width?: string | number;
  
  /**
   * Indica si la columna es ordenable
   */
  sortable?: boolean;
}

export interface TableProps<T> {
  /**
   * Datos de la tabla
   */
  data: T[];
  
  /**
   * Columnas de la tabla
   */
  columns: TableColumn<T>[];
  
  /**
   * Clave única para cada fila
   */
  rowKey: string | ((record: T) => string);
  
  /**
   * Tamaño de la tabla
   */
  size?: 'compact' | 'normal' | 'large';
  
  /**
   * Filas alternadas
   */
  striped?: boolean;
  
  /**
   * Efecto hover en las filas
   */
  hoverable?: boolean;
  
  /**
   * Bordes en todas las celdas
   */
  bordered?: boolean;
  
  /**
   * Paginación
   */
  pagination?: boolean | {
    pageSize?: number;
    current?: number;
    total?: number;
    onChange?: (page: number, pageSize: number) => void;
  };
  
  /**
   * Función para ordenar los datos
   */
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  
  /**
   * Clave actual de ordenación
   */
  sortKey?: string;
  
  /**
   * Orden actual
   */
  sortOrder?: 'asc' | 'desc';
  
  /**
   * Mensaje cuando no hay datos
   */
  emptyText?: React.ReactNode;
  
  /**
   * Clases adicionales
   */
  className?: string;
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  size = 'normal',
  striped = false,
  hoverable = true,
  bordered = false,
  pagination = false,
  onSort,
  sortKey,
  sortOrder,
  emptyText = 'No hay datos',
  className = '',
}: TableProps<T>) {
  // Estado para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Configuración de paginación
  const paginationConfig = useMemo(() => {
    if (!pagination) return null;
    
    const config = typeof pagination === 'object' ? pagination : {};
    return {
      pageSize: config.pageSize || pageSize,
      current: config.current || currentPage,
      total: config.total || data.length,
      onChange: config.onChange || ((page, size) => {
        setCurrentPage(page);
        setPageSize(size);
      })
    };
  }, [pagination, pageSize, currentPage, data.length]);
  
  // Datos paginados
  const paginatedData = useMemo(() => {
    if (!paginationConfig) return data;
    
    const { pageSize, current } = paginationConfig;
    const start = (current - 1) * pageSize;
    const end = start + pageSize;
    
    return data.slice(start, end);
  }, [data, paginationConfig]);
  
  // Manejar clic en encabezado para ordenar
  const handleHeaderClick = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return;
    
    const key = column.key;
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    
    onSort(key, newOrder);
  };
  
  // Obtener clave de fila
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return record[rowKey] || index.toString();
  };
  
  // Clases de la tabla
  const tableClasses = [
    styles.table,
    styles[`table${size.charAt(0).toUpperCase() + size.slice(1)}`],
    striped ? styles.tableStriped : '',
    hoverable ? styles.tableHoverable : '',
    bordered ? styles.tableBordered : '',
    className
  ].filter(Boolean).join(' ');
  
  // Renderizar paginación
  const renderPagination = () => {
    if (!paginationConfig) return null;
    
    const { current, total, pageSize, onChange } = paginationConfig;
    const totalPages = Math.ceil(total / pageSize);
    
    // Calcular rango de páginas a mostrar
    const range = 2;
    const pages = [];
    const startPage = Math.max(1, current - range);
    const endPage = Math.min(totalPages, current + range);
    
    // Agregar primera página
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push('...');
      }
    }
    
    // Agregar páginas intermedias
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    // Agregar última página
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    
    return (
      <div className={styles.pagination}>
        <div className={styles.paginationInfo}>
          Mostrando {Math.min((current - 1) * pageSize + 1, total)} a {Math.min(current * pageSize, total)} de {total} registros
        </div>
        
        <div className={styles.paginationControls}>
          <button
            className={styles.paginationButton}
            disabled={current === 1}
            onClick={() => onChange(current - 1, pageSize)}
          >
            <ChevronLeftIcon />
          </button>
          
          {pages.map((page, index) => (
            <button
              key={index}
              className={`
                ${styles.paginationButton}
                ${page === current ? styles.paginationButtonActive : ''}
              `}
              disabled={page === '...'}
              onClick={() => page !== '...' && onChange(page as number, pageSize)}
            >
              {page}
            </button>
          ))}
          
          <button
            className={styles.paginationButton}
            disabled={current === totalPages}
            onClick={() => onChange(current + 1, pageSize)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    );
  };
  
  // Renderizar mensaje de tabla vacía
  const renderEmpty = () => {
    if (typeof emptyText === 'string') {
      return (
        <div className={styles.empty}>
          <DocumentIcon className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No hay datos</div>
          <p className={styles.emptyDescription}>{emptyText}</p>
        </div>
      );
    }
    
    return (
      <div className={styles.empty}>
        {emptyText}
      </div>
    );
  };
  
  return (
    <div className={styles.tableContainer}>
      <table className={tableClasses}>
        <thead className={styles.thead}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  ${styles.th}
                  ${column.sortable ? styles.thSortable : ''}
                  ${styles[`tdAlign${column.align ? column.align.charAt(0).toUpperCase() + column.align.slice(1) : 'Left'}`]}
                `}
                style={{ width: column.width }}
                onClick={() => handleHeaderClick(column)}
              >
                {column.title}
                {column.sortable && (
                  <span className={`
                    ${styles.sortIcon}
                    ${sortKey === column.key && sortOrder === 'asc' ? styles.sortIconAsc : ''}
                  `}>
                    <ChevronUpDownIcon />
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody className={styles.tbody}>
          {paginatedData.length > 0 ? (
            paginatedData.map((record, index) => (
              <tr key={getRowKey(record, index)} className={styles.tr}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      ${styles.td}
                      ${styles[`tdAlign${column.align ? column.align.charAt(0).toUpperCase() + column.align.slice(1) : 'Left'}`]}
                    `}
                  >
                    {column.render
                      ? column.render(record[column.key], record, index)
                      : record[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                {renderEmpty()}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {pagination && data.length > 0 && renderPagination()}
    </div>
  );
}

export default Table;
