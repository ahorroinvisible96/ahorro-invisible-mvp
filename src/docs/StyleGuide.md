# Sistema de Diseño Ahorro Invisible

## Índice

1. [Introducción](#introducción)
2. [Tokens de Diseño](#tokens-de-diseño)
   - [Colores](#colores)
   - [Tipografía](#tipografía)
   - [Espaciado](#espaciado)
   - [Bordes y Sombras](#bordes-y-sombras)
3. [Componentes](#componentes)
   - [Básicos](#componentes-básicos)
   - [Avanzados](#componentes-avanzados)
4. [Layout](#layout)
5. [Temas](#temas)
6. [Buenas Prácticas](#buenas-prácticas)

## Introducción

Este documento describe el sistema de diseño de Ahorro Invisible, una aplicación para ayudar a los usuarios a ahorrar dinero de forma inteligente. El sistema de diseño proporciona un conjunto de componentes, tokens y patrones para crear interfaces consistentes y de alta calidad.

## Tokens de Diseño

Los tokens de diseño son variables que definen los valores fundamentales del sistema de diseño. Estos tokens se utilizan en toda la aplicación para mantener la consistencia visual.

### Colores

#### Colores Primarios

```css
--color-primary-50: #eef4ff;
--color-primary-100: #e0eaff;
--color-primary-200: #c7d7fe;
--color-primary-300: #a5bcfd;
--color-primary-400: #819dfc;
--color-primary-500: #2F63FF; /* Color principal azul */
--color-primary-600: #2B57F2;
--color-primary-700: #1E40AF;
--color-primary-800: #1e3a8a;
--color-primary-900: #172554;
--color-primary-950: #0f172a;
```

#### Colores de Fondo

```css
--color-background-main: #F5F5F0; /* Fondo principal crema */
--color-background-sidebar: #0B1E3B; /* Fondo sidebar azul oscuro */
--color-background-card: #FFFFFF; /* Fondo de tarjetas */
--color-background-badge: #f0fdf4; /* Fondo de badge sistema activo */
```

#### Colores de Texto

```css
--color-text-primary: #1F2937; /* Texto principal */
--color-text-secondary: #6B7280; /* Texto secundario */
--color-text-tertiary: #9CA3AF; /* Texto terciario */
--color-text-inverted: #FFFFFF; /* Texto sobre fondos oscuros */
--color-text-success: #16a34a; /* Texto verde éxito */
--color-text-danger: #ef4444; /* Texto rojo error/peligro */
```

#### Colores de Estado

```css
--color-success-50: #f0fdf4;
--color-success-500: #22c55e; /* Verde para badge activo */
--color-success-600: #16a34a;
--color-danger-500: #ef4444; /* Rojo para errores/alertas */
--color-warning-500: #f59e0b; /* Amarillo para advertencias */
```

#### Gradientes

```css
--gradient-primary: linear-gradient(135deg, #2F63FF 0%, #2B57F2 50%, #1E40AF 100%);
--gradient-sidebar: linear-gradient(90deg, #0B1E3B 0%, #1a2f4a 100%);
--gradient-bar: linear-gradient(180deg, #60A5FA 0%, #2F63FF 100%);
```

### Tipografía

#### Familias Tipográficas

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

#### Tamaños de Fuente

```css
--font-size-xs: 0.75rem;      /* 12px - Texto muy pequeño, etiquetas */
--font-size-sm: 0.875rem;     /* 14px - Texto secundario */
--font-size-base: 1rem;       /* 16px - Texto base */
--font-size-lg: 1.125rem;     /* 18px - Títulos de sección */
--font-size-xl: 1.25rem;      /* 20px */
--font-size-2xl: 1.5rem;      /* 24px - Títulos de tarjetas */
--font-size-3xl: 1.875rem;    /* 30px */
--font-size-4xl: 2.25rem;     /* 36px - Título principal */
```

#### Pesos de Fuente

```css
--font-weight-normal: 400;
--font-weight-medium: 500;    /* Texto medio */
--font-weight-semibold: 600;  /* Títulos, etiquetas */
--font-weight-bold: 700;      /* Texto destacado */
```

#### Altura de Línea

```css
--line-height-none: 1;
--line-height-tight: 1.25;
--line-height-snug: 1.375;
--line-height-normal: 1.5;
--line-height-relaxed: 1.625;
--line-height-loose: 2;
```

#### Espaciado entre Letras

```css
--letter-spacing-tighter: -0.05em;
--letter-spacing-tight: -0.025em;
--letter-spacing-normal: 0em;
--letter-spacing-wide: 0.025em;
--letter-spacing-wider: 0.05em;  /* Etiquetas, badges */
--letter-spacing-widest: 0.1em;  /* Texto en mayúsculas */
```

### Espaciado

```css
--spacing-0: 0;
--spacing-px: 1px;
--spacing-0-5: 0.125rem; /* 2px */
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px - Espaciado base */
--spacing-6: 1.5rem;    /* 24px - Padding de tarjetas */
--spacing-8: 2rem;      /* 32px - Margen entre secciones */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
--spacing-64: 16rem;    /* 256px - Ancho del sidebar */
```

### Bordes y Sombras

#### Radios de Borde

```css
--border-radius-none: 0;
--border-radius-sm: 0.125rem;  /* 2px */
--border-radius-md: 0.25rem;   /* 4px */
--border-radius-lg: 0.5rem;    /* 8px */
--border-radius-xl: 0.75rem;   /* 12px - Cards */
--border-radius-2xl: 1rem;     /* 16px - Cards destacadas */
--border-radius-full: 9999px;  /* Badges, botones circulares */
```

#### Sombras

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-blue-sm: 0 1px 2px rgba(47, 99, 255, 0.1);
--shadow-blue-md: 0 4px 12px rgba(47, 99, 255, 0.15);
--shadow-blue-lg: 0 14px 30px rgba(47, 99, 255, 0.35);
```

## Componentes

### Componentes Básicos

#### Button

El componente `Button` se utiliza para acciones primarias y secundarias en la interfaz.

```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md">
  Guardar Cambios
</Button>
```

**Variantes:**
- `primary`: Botón principal con fondo azul
- `secondary`: Botón secundario con borde azul
- `outline`: Botón con borde y sin fondo
- `ghost`: Botón sin borde ni fondo
- `danger`: Botón rojo para acciones destructivas

**Tamaños:**
- `sm`: Pequeño
- `md`: Mediano (por defecto)
- `lg`: Grande

#### Card

El componente `Card` se utiliza para agrupar contenido relacionado.

```tsx
import { Card } from '@/components/ui/Card';

<Card variant="default" size="md">
  <Card.Header title="Título de la tarjeta" />
  <Card.Content>
    Contenido de la tarjeta
  </Card.Content>
  <Card.Footer>
    <Button variant="primary">Acción</Button>
  </Card.Footer>
</Card>
```

**Variantes:**
- `default`: Tarjeta estándar con borde claro
- `primary`: Tarjeta con borde azul
- `success`: Tarjeta con borde verde
- `highlight`: Tarjeta con borde izquierdo azul
- `gradient`: Tarjeta con fondo degradado azul

**Tamaños:**
- `sm`: Padding pequeño
- `md`: Padding mediano (por defecto)
- `lg`: Padding grande
- `none`: Sin padding

#### Badge

El componente `Badge` se utiliza para mostrar estados, etiquetas o categorías.

```tsx
import { Badge } from '@/components/ui/Badge';

<Badge variant="success" size="md" withDot>
  SISTEMA ACTIVO
</Badge>
```

**Variantes:**
- `default`: Badge estándar con borde claro
- `primary`: Badge azul claro con texto azul
- `success`: Badge verde claro con texto verde
- `danger`: Badge rojo claro con texto rojo
- `warning`: Badge amarillo claro con texto amarillo
- `solid`: Badge azul con texto blanco

**Tamaños:**
- `sm`: Pequeño
- `md`: Mediano (por defecto)
- `lg`: Grande

#### Progress

El componente `Progress` se utiliza para mostrar el progreso de una tarea o proceso.

```tsx
import { Progress } from '@/components/ui/Progress';

<Progress 
  value={30} 
  variant="primary" 
  size="md"
  showLabel
/>
```

**Variantes:**
- `default`: Barra de progreso estándar
- `primary`: Barra de progreso azul
- `success`: Barra de progreso verde
- `danger`: Barra de progreso roja
- `warning`: Barra de progreso amarilla
- `gradient`: Barra de progreso con degradado

**Tamaños:**
- `xs`: Extra pequeño
- `sm`: Pequeño
- `md`: Mediano (por defecto)
- `lg`: Grande
- `xl`: Extra grande

### Componentes Avanzados

#### Modal

El componente `Modal` se utiliza para mostrar contenido en una ventana flotante.

```tsx
import { Modal } from '@/components/ui/Modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título del modal"
  size="md"
  footer={
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button variant="primary" onClick={handleSave}>
        Guardar
      </Button>
    </div>
  }
>
  Contenido del modal
</Modal>
```

**Tamaños:**
- `sm`: Pequeño
- `md`: Mediano (por defecto)
- `lg`: Grande
- `xl`: Extra grande
- `full`: Pantalla completa

#### Dropdown

El componente `Dropdown` se utiliza para mostrar una lista de opciones.

```tsx
import { Dropdown } from '@/components/ui/Dropdown';

<Dropdown
  placeholder="Seleccionar"
  value={value}
  onChange={setValue}
  items={[
    { value: 'option1', label: 'Opción 1' },
    { value: 'option2', label: 'Opción 2' },
    { value: 'option3', label: 'Opción 3' },
  ]}
/>
```

También se puede usar como menú contextual:

```tsx
import { Dropdown } from '@/components/ui/Dropdown';

<Dropdown.Menu
  trigger={<Button variant="outline">Acciones</Button>}
  alignRight
>
  <Dropdown.Item onClick={() => console.log('Editar')}>
    Editar
  </Dropdown.Item>
  <Dropdown.Divider />
  <Dropdown.Item onClick={() => console.log('Eliminar')}>
    Eliminar
  </Dropdown.Item>
</Dropdown.Menu>
```

#### Table

El componente `Table` se utiliza para mostrar datos tabulares.

```tsx
import { Table } from '@/components/ui/Table';

<Table
  data={data}
  columns={[
    {
      key: 'name',
      title: 'Nombre',
      render: (value) => <strong>{value}</strong>,
    },
    {
      key: 'email',
      title: 'Email',
    },
    {
      key: 'actions',
      title: 'Acciones',
      align: 'right',
      render: (_, record) => (
        <Button variant="outline" size="sm">
          Ver
        </Button>
      ),
    },
  ]}
  rowKey="id"
  pagination={{
    pageSize: 10,
    total: data.length,
  }}
/>
```

#### Form

El componente `Form` se utiliza para crear formularios.

```tsx
import { Form } from '@/components/ui/Form';

<Form onSubmit={handleSubmit}>
  <Form.Group>
    <Form.Label htmlFor="name" required>Nombre</Form.Label>
    <Form.Input
      id="name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      error={errors.name}
    />
    <Form.Hint>Introduce tu nombre completo</Form.Hint>
  </Form.Group>
  
  <Form.Group>
    <Form.Label htmlFor="email" required>Email</Form.Label>
    <Form.Input
      id="email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      error={errors.email}
    />
  </Form.Group>
  
  <Form.Group>
    <Form.Checkbox
      id="terms"
      label="Acepto los términos y condiciones"
      checked={terms}
      onChange={(e) => setTerms(e.target.checked)}
      error={errors.terms}
    />
  </Form.Group>
  
  <Form.Actions>
    <Button variant="outline" type="button">
      Cancelar
    </Button>
    <Button variant="primary" type="submit">
      Enviar
    </Button>
  </Form.Actions>
</Form>
```

## Layout

### AppLayout

El componente `AppLayout` es el layout principal de la aplicación. Incluye el sidebar y el contenido principal.

```tsx
import { AppLayout } from '@/components/layout';

<AppLayout
  title="Título de la página"
  subtitle="Subtítulo de la página"
>
  <AppLayout.Section title="Sección 1">
    Contenido de la sección 1
  </AppLayout.Section>
  
  <AppLayout.Section title="Sección 2">
    <AppLayout.Grid columns={2}>
      <Card>Contenido 1</Card>
      <Card>Contenido 2</Card>
    </AppLayout.Grid>
  </AppLayout.Section>
</AppLayout>
```

### Sidebar

El componente `Sidebar` es la barra lateral de la aplicación. Incluye el logo, el menú principal y la información del usuario.

```tsx
import { Sidebar } from '@/components/layout';

<Sidebar
  userName="Nombre de usuario"
  onLogout={handleLogout}
/>
```

### MainContent

El componente `MainContent` es el contenido principal de la aplicación.

```tsx
import { MainContent } from '@/components/layout';

<MainContent
  title="Título de la página"
  subtitle="Subtítulo de la página"
  withPattern
>
  <MainContent.Section title="Sección 1">
    Contenido de la sección 1
  </MainContent.Section>
  
  <MainContent.Grid columns={2}>
    <Card>Contenido 1</Card>
    <Card>Contenido 2</Card>
  </MainContent.Grid>
</MainContent>
```

## Temas

La aplicación soporta temas claro y oscuro. Los temas se pueden cambiar usando el componente `ThemeToggle`.

```tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle';

<ThemeToggle />
```

También se puede cambiar el tema programáticamente:

```tsx
import { applyTheme } from '@/styles/themes';

// Aplicar tema claro
applyTheme('light');

// Aplicar tema oscuro
applyTheme('dark');

// Aplicar tema del sistema
applyTheme('system');
```

## Buenas Prácticas

### Uso de Tokens

- Siempre utiliza los tokens de diseño en lugar de valores hardcodeados.
- Utiliza las variables CSS para colores, espaciado, tipografía, etc.

```css
/* Mal */
.element {
  color: #2F63FF;
  margin: 16px;
  font-size: 14px;
}

/* Bien */
.element {
  color: var(--color-primary-500);
  margin: var(--spacing-4);
  font-size: var(--font-size-sm);
}
```

### Componentes

- Utiliza los componentes del sistema de diseño en lugar de crear nuevos.
- Si necesitas un componente nuevo, sigue el patrón de los componentes existentes.
- Utiliza las props de los componentes para personalizar su apariencia.

### Responsive

- Utiliza el sistema de grid para crear layouts responsive.
- Utiliza los breakpoints de Tailwind CSS para adaptar la interfaz a diferentes tamaños de pantalla.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card>Contenido 1</Card>
  <Card>Contenido 2</Card>
  <Card>Contenido 3</Card>
</div>
```

### Accesibilidad

- Utiliza etiquetas semánticas para mejorar la accesibilidad.
- Asegúrate de que todos los elementos interactivos tienen un buen contraste.
- Utiliza atributos ARIA cuando sea necesario.

```tsx
<button
  aria-label="Cerrar"
  className="..."
  onClick={onClose}
>
  <CloseIcon />
</button>
```

### Performance

- Utiliza componentes ligeros y optimizados.
- Evita renderizados innecesarios.
- Utiliza lazy loading para componentes pesados.

```tsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<div>Cargando...</div>}>
  <HeavyComponent />
</Suspense>
```
