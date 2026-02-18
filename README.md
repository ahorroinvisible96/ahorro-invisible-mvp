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

## Sistema de Diseño

La aplicación implementa un sistema de diseño completo con:

- **Tokens CSS**: Variables para colores, tipografía, espaciado y efectos
- **Componentes Core**: Button, Card, Badge, Progress con múltiples variantes
- **Layout Global**: AppLayout, Sidebar, MainContent para estructura consistente
- **Temas**: Soporte para tema claro y oscuro con detección de preferencias del sistema
- **Componentes Avanzados**: Modal, Dropdown, Table, Form
- **Documentación**: Guía de estilo completa en `/src/docs`

## Tecnologías

- Next.js 14 con App Router
- React 19
- CSS Modules + Variables CSS
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
  - `/src/components/ui`: Componentes del sistema de diseño
  - `/src/components/layout`: Componentes de layout global
- `/src/styles`: Estilos globales y tokens CSS
  - `/src/styles/tokens`: Variables CSS para el sistema de diseño
  - `/src/styles/themes`: Temas claro y oscuro
- `/src/services`: Servicios como analytics
- `/src/docs`: Documentación del sistema de diseño

## Despliegue en Vercel

La aplicación está configurada para ser desplegada en Vercel:

1. Asegúrate de tener una cuenta en [Vercel](https://vercel.com)
2. Instala la CLI de Vercel: `npm i -g vercel`
3. Ejecuta `vercel login` y sigue las instrucciones
4. Desde la raíz del proyecto, ejecuta `vercel` para un despliegue de desarrollo o `vercel --prod` para producción
5. Sigue las instrucciones en pantalla para completar el despliegue

También puedes desplegar directamente desde GitHub:
1. Sube el proyecto a un repositorio de GitHub
2. Importa el proyecto en Vercel desde la interfaz web
3. Configura las variables de entorno si es necesario
4. Despliega

## Notas importantes

- Este MVP utiliza localStorage para simular la persistencia de datos
- Los eventos de analytics se registran en la consola
- La aplicación sigue estrictamente los requisitos definidos en el Sync Pack
- El sistema de diseño está implementado con CSS Modules y variables CSS
- La aplicación es responsive y soporta temas claro y oscuro
