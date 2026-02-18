/**
 * Script para desplegar la aplicación en Vercel
 * Ejecutar con: node scripts/deploy-vercel.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

// Función para verificar si Vercel CLI está instalado
function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Función principal
async function deploy() {
  console.log(`\n${colors.cyan}=== Despliegue de Ahorro Invisible en Vercel ===${colors.reset}\n`);
  
  // Verificar si Vercel CLI está instalado
  if (!checkVercelCLI()) {
    console.log(`${colors.yellow}Vercel CLI no está instalado. Instalando...${colors.reset}`);
    runCommand('npm install -g vercel');
  }
  
  // Verificar si el usuario está autenticado en Vercel
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
    console.log(`${colors.green}Usuario autenticado en Vercel${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}No autenticado en Vercel. Iniciando proceso de login...${colors.reset}`);
    runCommand('vercel login');
  }
  
  // Limpiar caché
  console.log(`\n${colors.cyan}Limpiando caché...${colors.reset}`);
  require('./clear-cache');
  
  // Preguntar si desplegar en producción o desarrollo
  console.log(`\n${colors.cyan}Opciones de despliegue:${colors.reset}`);
  console.log(`${colors.yellow}1.${colors.reset} Despliegue de desarrollo (preview)`);
  console.log(`${colors.yellow}2.${colors.reset} Despliegue de producción`);
  
  // En un entorno real, aquí se usaría una librería como 'inquirer' para preguntar al usuario
  // Para este script simple, asumimos despliegue de producción
  const isProd = true;
  
  // Ejecutar el despliegue
  console.log(`\n${colors.cyan}Iniciando despliegue en ${isProd ? 'producción' : 'desarrollo'}...${colors.reset}`);
  
  const deployCommand = isProd ? 'vercel --prod' : 'vercel';
  runCommand(deployCommand);
  
  console.log(`\n${colors.green}¡Despliegue completado con éxito!${colors.reset}`);
  console.log(`\n${colors.cyan}Recuerda verificar la aplicación en la URL proporcionada por Vercel.${colors.reset}`);
}

// Ejecutar la función principal
deploy().catch(error => {
  console.error(`${colors.red}Error durante el despliegue:${colors.reset}`, error);
  process.exit(1);
});
