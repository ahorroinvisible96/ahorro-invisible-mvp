# Ahorro Invisible MVP

Este es el MVP de Ahorro Invisible, una aplicación que ayuda a los usuarios a crear hábitos de ahorro a través de decisiones diarias simples.

## Descripción

Ahorro Invisible es una aplicación que permite a los usuarios:

- Crear objetivos de ahorro personalizados
- Tomar una decisión diaria simple que genera un impacto en sus ahorros
- Visualizar el progreso hacia sus objetivos
- Registrar acciones extra de ahorro
- Ver un historial de sus decisiones y ahorros

## Características principales

- **Onboarding**: Proceso de 3 preguntas para personalizar la experiencia
- **Creación de objetivos**: Definición de metas de ahorro con montos y plazos
- **Dashboard**: Visualización del progreso y acceso a funcionalidades principales
- **Pregunta diaria**: Una decisión simple cada día con impacto en el ahorro
- **Impacto/Progreso**: Visualización del impacto de cada decisión
- **Acción extra**: Registro de ahorros adicionales
- **Historial**: Registro cronológico de decisiones y acciones
- **Perfil y Ajustes**: Gestión de cuenta y configuraciones

## Tecnologías

- Next.js 14 con App Router
- React 19
- Tailwind CSS
- LocalStorage para persistencia (simulación de backend)
- Analytics integrado

## Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build

# Iniciar versión de producción
npm start
```

## Estructura del proyecto

- `/src/app`: Páginas y componentes de la aplicación
- `/src/components`: Componentes reutilizables
- `/src/services`: Servicios como analytics

## Notas importantes

- Este MVP utiliza localStorage para simular la persistencia de datos
- Los eventos de analytics se registran en la consola
- La aplicación sigue estrictamente los requisitos definidos en el Sync Pack
