/**
 * Script para forzar la limpieza de caché en Vercel
 * Este script se ejecuta durante el proceso de build
 */

const fs = require('fs');
const path = require('path');

// Crear un archivo de caché único para forzar un rebuild completo
const cacheFile = path.join(__dirname, '..', '.vercel', 'cache-version.txt');
const cacheDir = path.dirname(cacheFile);

// Crear directorio .vercel si no existe
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Escribir timestamp actual para forzar un cambio en cada build
fs.writeFileSync(cacheFile, new Date().toISOString());

console.log('✅ Caché de Vercel limpiada correctamente');
