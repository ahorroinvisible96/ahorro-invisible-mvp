# Instrucciones de Despliegue en Vercel

Este documento proporciona instrucciones detalladas para desplegar la aplicación Ahorro Invisible en Vercel.

## Requisitos Previos

1. Cuenta en [Vercel](https://vercel.com)
2. [CLI de Vercel](https://vercel.com/cli) instalada (opcional para despliegue desde línea de comandos)
3. [Git](https://git-scm.com/) instalado (opcional para despliegue desde GitHub)

## Opción 1: Despliegue desde la Interfaz Web de Vercel

### Paso 1: Preparar el Repositorio

1. Sube el código a un repositorio de GitHub, GitLab o Bitbucket
2. Asegúrate de que el repositorio contenga todos los archivos necesarios, incluyendo:
   - `vercel.json`
   - `package.json` con los scripts de build configurados
   - `.vercelignore`

### Paso 2: Importar el Proyecto en Vercel

1. Inicia sesión en [Vercel](https://vercel.com)
2. Haz clic en "Add New..." y selecciona "Project"
3. Conecta tu cuenta de GitHub, GitLab o Bitbucket si aún no lo has hecho
4. Selecciona el repositorio que contiene el proyecto Ahorro Invisible
5. Vercel detectará automáticamente que es un proyecto Next.js

### Paso 3: Configurar el Proyecto

1. **Configuración del Framework**: Vercel debería detectar automáticamente Next.js
2. **Directorio Raíz**: Deja el valor predeterminado si el proyecto está en la raíz del repositorio
3. **Comando de Build**: Verifica que sea `npm run vercel-build` (ya configurado en package.json)
4. **Directorio de Salida**: Deja el valor predeterminado `.next`
5. **Variables de Entorno**: No se requieren para este MVP

### Paso 4: Desplegar

1. Haz clic en "Deploy"
2. Espera a que se complete el proceso de despliegue
3. Una vez completado, Vercel proporcionará una URL para acceder a la aplicación

## Opción 2: Despliegue desde la Línea de Comandos

### Paso 1: Instalar la CLI de Vercel

```bash
npm install -g vercel
```

### Paso 2: Iniciar Sesión en Vercel

```bash
vercel login
```

### Paso 3: Desplegar el Proyecto

Desde el directorio raíz del proyecto:

```bash
# Para un despliegue de desarrollo (preview)
vercel

# Para un despliegue de producción
vercel --prod
```

### Paso 4: Seguir las Instrucciones en Pantalla

La CLI te guiará a través del proceso de configuración si es la primera vez que despliegas el proyecto.

## Verificación del Despliegue

Una vez desplegada la aplicación, verifica que:

1. La aplicación se carga correctamente en la URL proporcionada por Vercel
2. El sistema de diseño se muestra correctamente (componentes, temas, etc.)
3. La funcionalidad principal funciona como se espera
4. No hay errores en la consola del navegador

## Solución de Problemas

### Problemas con el CSS

Si los estilos no se cargan correctamente:

1. Verifica que los archivos CSS se están importando correctamente
2. Comprueba que las variables CSS están definidas y accesibles
3. Asegúrate de que los componentes están utilizando las clases CSS correctas

### Problemas con el Tema Oscuro/Claro

Si el cambio de tema no funciona:

1. Verifica que los archivos de tema se están importando correctamente
2. Comprueba que el script de inicialización del tema se ejecuta al cargar la aplicación
3. Asegúrate de que las variables CSS del tema se aplican correctamente

### Caché de Vercel

Si los cambios no se reflejan después de un nuevo despliegue:

1. Fuerza una reconstrucción completa con `vercel --prod --force`
2. Borra la caché del navegador
3. Verifica que el script `clear-cache.js` se está ejecutando durante el build

## Comandos Útiles

```bash
# Ver los despliegues actuales
vercel ls

# Eliminar un despliegue
vercel remove [deployment-name]

# Ver logs de un despliegue
vercel logs [deployment-url]

# Configurar variables de entorno
vercel env add
```

## Recursos Adicionales

- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Next.js](https://nextjs.org/docs)
- [Guía de Despliegue de Next.js en Vercel](https://nextjs.org/docs/deployment)
