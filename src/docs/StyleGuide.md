# Sistema de Diseño — Ahorro Invisible

> **Versión:** 2.0 (post-refactor P1+P2+P3)
> **Stack:** Next.js 15 + CSS Modules + Geist Sans
> **Modo:** Dark-first PWA

---

## Índice

1. [Tokens de Diseño](#tokens-de-diseño)
2. [Componentes Base](#componentes-base)
3. [Layout](#layout)
4. [Z-Index Scale](#z-index-scale)
5. [Reglas Obligatorias](#reglas-obligatorias)
6. [Accesibilidad](#accesibilidad)

---

## Tokens de Diseño

Todos los tokens viven en `src/styles/tokens/`:
- `colors.css` — Colores semánticos y gradientes
- `typography.css` — Escala tipográfica de 12 niveles (Geist Sans)
- `spacing.css` — Espaciados
- `effects.css` — Radios, sombras, transiciones, animaciones, z-index

### Colores Semánticos

```css
/* Texto */
--color-text-primary: #f1f5f9;
--color-text-secondary: rgba(148, 163, 184, 0.75);
--color-text-muted: rgba(148, 163, 184, 0.50);

/* Estado */
--color-success: #22c55e;
--color-success-light: #4ade80;
--color-error: #ef4444;
--color-error-light: #f87171;
--color-warning: #f59e0b;
--color-warning-light: #fbbf24;
--color-info: #60a5fa;

/* Fondos */
--widget-bg: rgba(15, 23, 42, 0.4);
--widget-card-bg: rgba(15, 23, 42, 0.7);
--widget-border: rgba(51, 65, 85, 0.4);
```

### Gradientes

```css
--grad-hero: linear-gradient(135deg, #4338ca, #7c3aed 50%, #6d28d9);
--grad-primary: linear-gradient(90deg, #2563eb, #a855f7);
--grad-bar: linear-gradient(90deg, #3b82f6, #a855f7);
```

### Radios (effects.css)

```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 28px;
--radius-full: 9999px;
--radius-widget: 20px;
--radius-icon: 10px;
```

### Transiciones

```css
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;
```

---

## Componentes Base

### Button

```tsx
import { Button } from '@/components/ui/Button/Button';

<Button variant="primary" size="md" fullWidth>Guardar</Button>
<Button variant="outline" icon={<PlusIcon size={14} />}>Añadir</Button>
<Button variant="danger" loading>Eliminando...</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
<Button variant="heroPrimary">CTA sobre gradiente</Button>
```

| Prop | Tipo | Default |
|---|---|---|
| `variant` | `primary \| secondary \| outline \| ghost \| danger \| heroPrimary \| heroSecondary` | `primary` |
| `size` | `sm \| md \| lg` | `md` |
| `fullWidth` | `boolean` | `false` |
| `icon` | `ReactNode` | — |
| `iconOnly` | `boolean` | `false` |
| `loading` | `boolean` | `false` |

### Badge

```tsx
import { Badge } from '@/components/ui/Badge/Badge';

<Badge variant="success" pill bold dot dotPulse>Completado</Badge>
<Badge variant="warning" size="sm" pill dot dotPulse>Pendiente</Badge>
<Badge variant="primary" uppercase>Fase 1</Badge>
```

| Prop | Tipo | Default |
|---|---|---|
| `variant` | `default \| primary \| blue \| success \| danger \| warning \| streak \| bronze \| silver \| gold \| diamond` | `default` |
| `size` | `sm \| md \| lg` | `md` |
| `pill` | `boolean` | `false` |
| `uppercase` | `boolean` | `false` |
| `bold` | `boolean` | `false` |
| `dot` | `boolean` | `false` |
| `dotPulse` | `boolean` | `false` |
| `icon` | `ReactNode` | — |

### Modal

```tsx
import { Modal } from '@/components/ui/Modal/Modal';
import { Button } from '@/components/ui/Button/Button';

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirmar acción"
  size="sm"
  footer={
    <div style={{ display: 'flex', gap: 10 }}>
      <Button variant="secondary" onClick={close} fullWidth>Cancelar</Button>
      <Button variant="primary" onClick={confirm} fullWidth>Confirmar</Button>
    </div>
  }
>
  <p>¿Estás seguro de esta acción?</p>
</Modal>
```

| Prop | Tipo | Default |
|---|---|---|
| `isOpen` | `boolean` | — |
| `onClose` | `() => void` | — |
| `title` | `ReactNode` | — |
| `size` | `sm \| md \| lg \| xl \| full` | `md` |
| `closeOnOverlayClick` | `boolean` | `true` |
| `closeOnEsc` | `boolean` | `true` |
| `showCloseButton` | `boolean` | `true` |
| `footer` | `ReactNode` | — |

### WidgetWrapper

```tsx
import { WidgetWrapper } from '@/components/ui/WidgetWrapper/WidgetWrapper';

<WidgetWrapper glowColor="purple" glowColorSecondary="blue" variant="widget">
  {/* contenido del widget */}
</WidgetWrapper>
```

Reemplaza el patrón repetido: `wrapper > blurBlue + blurPurple + card`.

| Prop | Tipo | Default |
|---|---|---|
| `glowColor` | `purple \| blue \| green \| red \| none` | `purple` |
| `glowColorSecondary` | `purple \| blue \| green \| none` | `blue` |
| `variant` | `widget \| hero \| card` | `widget` |

### EmptyState

```tsx
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';

<EmptyState
  icon="📊"
  title="Sin resultados para este filtro"
  description="Prueba a cambiar el periodo o categoría."
  action={{ label: "Ver todo", onClick: handleReset }}
/>
```

### Skeleton

```tsx
import { Skeleton, WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';

// Línea simple
<Skeleton width="80%" height={16} />

// Múltiples líneas
<Skeleton lines={3} height={14} />

// Círculo (avatar)
<Skeleton circle height={40} />

// Widget completo pre-configurado
<WidgetSkeleton />
```

### Toast

```tsx
// 1. Envolver la app con ToastProvider (en layout.tsx)
import { ToastProvider } from '@/components/ui/Toast/Toast';
<ToastProvider>{children}</ToastProvider>

// 2. Usar el hook en cualquier componente
import { useToast } from '@/components/ui/Toast/Toast';

const { addToast } = useToast();
addToast('Decisión guardada', 'success');
addToast('Error al guardar', 'error');
addToast('Procesando...', 'info', 5000);
```

### FormInput

```tsx
import { FormInput } from '@/components/ui/FormInput/FormInput';

<FormInput
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  placeholder="tu@email.com"
/>
```

Incluye automáticamente: `useId()` para label/input, `aria-invalid`, `aria-describedby`, `role="alert"` en error, `:focus-visible`.

---

## Layout

### Estructura general

```
<Sidebar />          ← solo desktop (>768px)
<MainContent>
  <HeaderStatusBar />
  <widgets...>
</MainContent>
<BottomNav />        ← solo mobile (<768px)
```

### Breakpoints

| Breakpoint | Ancho | Comportamiento |
|---|---|---|
| Mobile | < 768px | BottomNav visible, Sidebar oculto, single-column |
| Tablet | 768px | Transición: brand panel oculto en auth |
| Desktop | ≥ 1024px | Sidebar visible, two-column en auth |

---

## Z-Index Scale

Definida en `src/styles/tokens/effects.css`:

```css
--z-base: 1;
--z-dropdown: 50;
--z-sticky: 100;
--z-bottomnav: 200;
--z-daily-modal: 500;
--z-sidebar: 600;
--z-modal-overlay: 900;
--z-toast: 1000;
```

**Regla:** Nunca usar `z-index` numéricos. Siempre usar `var(--z-*)`.

---

## Reglas Obligatorias

### ❌ Nunca hacer

1. **Colores hex/rgb en línea**: Usar `var(--color-*)` o `var(--widget-*)`
2. **border-radius numéricos**: Usar `var(--radius-*)`
3. **transition sin token**: Usar `var(--transition-*)`
4. **z-index numéricos**: Usar `var(--z-*)`
5. **Botones custom por widget**: Usar `<Button>`
6. **Modales custom por widget**: Usar `<Modal>`
7. **Badges custom por widget**: Usar `<Badge>`
8. **Inline styles en TSX**: Mover a CSS Module
9. **CSS global sin scope**: Usar `*.module.css`

### ✅ Siempre hacer

1. Usar CSS Modules (`Component.module.css`)
2. Importar componentes base para botones, badges, modales
3. Usar `WidgetWrapper` para contenedores de widgets
4. Añadir `:focus-visible` a elementos interactivos
5. Usar `useId()` en formularios para vincular label/input
6. Usar `role="alert"` en mensajes de error
7. Verificar contraste WCAG AA (ratio ≥ 4.5:1 para texto)

---

## Accesibilidad

### Focus visible
Todos los botones e inputs deben tener un estilo `:focus-visible` distinguible:

```css
.button:focus-visible {
  outline: 2px solid var(--color-primary-400);
  outline-offset: 2px;
}
```

### Label/Input association
```tsx
const inputId = useId();
<label htmlFor={inputId}>Email</label>
<input id={inputId} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} />
{error && <span id={`${inputId}-error`} role="alert">{error}</span>}
```

### Touch targets
Mínimo 44×44px para elementos interactivos en mobile.

