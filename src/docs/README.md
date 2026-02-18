# Sistema de Diseño Ahorro Invisible

Este repositorio contiene el sistema de diseño completo para la aplicación Ahorro Invisible, una plataforma que ayuda a los usuarios a ahorrar dinero de forma inteligente.

## Estructura del Sistema de Diseño

El sistema de diseño está organizado en las siguientes secciones:

### 1. Tokens de Diseño

Los tokens de diseño son variables CSS que definen los valores fundamentales del sistema:

- **Colores**: Paleta de colores primarios, secundarios y de estado
- **Tipografía**: Familias tipográficas, tamaños, pesos y espaciado
- **Espaciado**: Sistema de espaciado consistente
- **Bordes y Sombras**: Radios de borde y sombras

### 2. Componentes Básicos

Componentes fundamentales que se utilizan en toda la aplicación:

- **Button**: Botones para acciones primarias y secundarias
- **Card**: Tarjetas para agrupar contenido relacionado
- **Badge**: Badges para mostrar estados y etiquetas
- **Progress**: Barras de progreso para mostrar avance

### 3. Componentes Avanzados

Componentes más complejos para interfaces sofisticadas:

- **Modal**: Ventanas modales para contenido flotante
- **Dropdown**: Menús desplegables y selectores
- **Table**: Tablas para mostrar datos estructurados
- **Form**: Componentes de formulario (inputs, selects, checkboxes, etc.)

### 4. Layout

Componentes para estructurar la aplicación:

- **AppLayout**: Layout principal con sidebar y contenido
- **Sidebar**: Barra lateral con navegación
- **MainContent**: Contenido principal con secciones y grid

### 5. Temas

Sistema de temas claro y oscuro:

- **ThemeToggle**: Componente para cambiar entre temas
- **API de Temas**: Funciones para gestionar temas programáticamente

## Cómo Usar

### Instalación

El sistema de diseño está integrado en la aplicación Ahorro Invisible. No es necesario instalarlo por separado.

### Uso de Componentes

```tsx
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function MyComponent() {
  return (
    <Card variant="primary" size="md">
      <Card.Header title="Mi Tarjeta" />
      <Card.Content>
        Contenido de la tarjeta
      </Card.Content>
      <Card.Footer>
        <Button variant="primary">Acción</Button>
      </Card.Footer>
    </Card>
  );
}
```

### Uso de Tokens

Los tokens están disponibles como variables CSS:

```css
.myElement {
  color: var(--color-primary-500);
  margin: var(--spacing-4);
  font-size: var(--font-size-sm);
}
```

## Documentación

Para más información, consulta los siguientes documentos:

- [Guía de Estilo](./StyleGuide.md): Documentación completa del sistema de diseño
- [Ejemplos de Componentes](./ComponentExamples.md): Ejemplos prácticos de uso de los componentes

## Contribución

Para contribuir al sistema de diseño, sigue estas pautas:

1. Asegúrate de que los nuevos componentes siguen los patrones existentes
2. Utiliza los tokens de diseño en lugar de valores hardcodeados
3. Documenta los componentes con ejemplos de uso
4. Asegúrate de que los componentes son accesibles

## Licencia

Este sistema de diseño es propiedad de Ahorro Invisible y está protegido por derechos de autor.
