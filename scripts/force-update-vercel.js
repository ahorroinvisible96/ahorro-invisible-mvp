/**
 * Script para forzar la actualización de archivos en Vercel
 * Este script crea un archivo de caché único y actualiza la configuración
 * para forzar a Vercel a reconstruir completamente la aplicación
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Ruta al directorio raíz del proyecto
const rootDir = path.join(__dirname, '..');

// Función para ejecutar comandos
function runCommand(command, options = {}) {
  console.log(`${colors.blue}Ejecutando:${colors.reset} ${command}`);
  
  try {
    return execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    console.error(`${colors.red}Error al ejecutar el comando:${colors.reset} ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Crear un archivo de caché único para forzar un rebuild completo
const cacheFile = path.join(rootDir, '.vercel', 'cache-version.txt');
const cacheDir = path.dirname(cacheFile);

// Crear directorio .vercel si no existe
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Escribir timestamp actual para forzar un cambio en cada build
fs.writeFileSync(cacheFile, new Date().toISOString());

// Actualizar el archivo vercel.json para forzar la reconstrucción
const vercelConfigPath = path.join(rootDir, 'vercel.json');
let vercelConfig = {};

if (fs.existsSync(vercelConfigPath)) {
  try {
    vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  } catch (error) {
    console.error(`${colors.red}Error al leer vercel.json:${colors.reset}`, error.message);
  }
}

// Añadir o actualizar la configuración de build
vercelConfig.buildCommand = "node scripts/clear-cache.js && next build";
vercelConfig.cleanUrls = true;
vercelConfig.headers = vercelConfig.headers || [];

// Asegurarse de que hay un encabezado para forzar la recarga
let hasNoCacheHeader = false;
for (const header of vercelConfig.headers || []) {
  if (header.source === '/(.*)\\.(?:js|css|json)') {
    hasNoCacheHeader = true;
    break;
  }
}

if (!hasNoCacheHeader) {
  vercelConfig.headers.push({
    source: '/(.*)\\.(?:js|css|json)',
    headers: [
      {
        key: 'Cache-Control',
        value: 'public, max-age=0, must-revalidate'
      }
    ]
  });
}

// Guardar la configuración actualizada
fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2));

console.log(`${colors.green}✅ Configuración de Vercel actualizada para forzar reconstrucción${colors.reset}`);

// Crear un archivo de versión para forzar la actualización
const buildVersionFile = path.join(rootDir, 'src', 'build-version.js');
const buildVersion = `export const BUILD_VERSION = "${new Date().toISOString()}";`;
fs.writeFileSync(buildVersionFile, buildVersion);

console.log(`${colors.green}✅ Archivo de versión creado para forzar actualización${colors.reset}`);

// Actualizar el archivo _app.js o layout.js para importar la versión
const layoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
if (fs.existsSync(layoutPath)) {
  let layoutContent = fs.readFileSync(layoutPath, 'utf8');
  
  // Verificar si ya importa la versión
  if (!layoutContent.includes('build-version')) {
    // Añadir la importación al principio del archivo
    layoutContent = `import { BUILD_VERSION } from '@/build-version';\n// Build version: ${new Date().toISOString()}\n${layoutContent}`;
    fs.writeFileSync(layoutPath, layoutContent);
    console.log(`${colors.green}✅ Archivo layout.tsx actualizado con la versión${colors.reset}`);
  } else {
    // Actualizar la versión existente
    layoutContent = layoutContent.replace(
      /\/\/ Build version: .*\n/,
      `// Build version: ${new Date().toISOString()}\n`
    );
    fs.writeFileSync(layoutPath, layoutContent);
    console.log(`${colors.green}✅ Versión actualizada en layout.tsx${colors.reset}`);
  }
}

console.log(`\n${colors.cyan}=== Preparación para forzar actualización en Vercel completada ===${colors.reset}`);
console.log(`\n${colors.yellow}Para aplicar los cambios, ejecuta:${colors.reset}`);
console.log(`${colors.green}npm run deploy:prod${colors.reset}`);
