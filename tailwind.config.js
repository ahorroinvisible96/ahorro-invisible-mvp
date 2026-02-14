/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores principales
        'ahorro': {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6', // Azul principal para gráficos
          600: '#2563EB', // Azul para botones activos
          700: '#1E293B', // Azul oscuro para sidebar (actualizado)
          800: '#1E3A8A',
          900: '#1E3A8A',
        },
        // Colores de fondo
        'background': {
          light: '#F5F5F0', // Fondo principal crema con líneas
          DEFAULT: '#F5F5F0',
          dark: '#1E293B', // Fondo sidebar
          blue: '#3B82F6', // Azul brillante para tarjeta motivacional
        },
        // Colores de texto
        'text': {
          primary: '#1F2937', // Negro para textos principales
          secondary: '#6B7280', // Gris para textos secundarios
          light: '#FFFFFF', // Blanco para textos sobre fondos oscuros
        },
        // Colores de acento
        'accent': {
          red: '#EF4444', // Para "Archivar" y alertas
          green: '#10B981', // Para indicadores positivos
          yellow: '#F59E0B', // Para advertencias
          blue: '#3B82F6', // Azul brillante para botones y acentos
        }
      },
      borderRadius: {
        'xl': '1rem', // 16px
        '2xl': '1.5rem', // 24px
        'pill': '9999px', // Para botones tipo pill
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
