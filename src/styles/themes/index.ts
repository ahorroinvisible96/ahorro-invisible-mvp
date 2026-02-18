// Sistema de temas para Ahorro Invisible
import './light.css';
import './dark.css';

export type Theme = 'light' | 'dark' | 'system';

// Obtener el tema del sistema
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light'; // Fallback a tema claro
};

// Obtener el tema actual
export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  
  const storedTheme = localStorage.getItem('theme') as Theme | null;
  
  if (!storedTheme || storedTheme === 'system') {
    return getSystemTheme();
  }
  
  return storedTheme;
};

// Aplicar tema al documento
export const applyTheme = (theme: Theme): void => {
  if (typeof window === 'undefined') return;
  
  const root = document.documentElement;
  const actualTheme = theme === 'system' ? getSystemTheme() : theme;
  
  root.setAttribute('data-theme', actualTheme);
  localStorage.setItem('theme', theme);
};

// Cambiar tema
export const toggleTheme = (): void => {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
};

// Inicializar tema
export const initTheme = (): void => {
  if (typeof window === 'undefined') return;
  
  // Escuchar cambios en el tema del sistema
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (!storedTheme || storedTheme === 'system') {
      applyTheme('system');
    }
  };
  
  // Aplicar tema inicial
  applyTheme(getTheme());
  
  // Agregar listener para cambios en el tema del sistema
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    // Fallback para navegadores antiguos
    mediaQuery.addListener(handleChange);
  }
};
