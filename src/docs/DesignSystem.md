# 🎨 Design System — Ahorro Invisible
> Referencia completa de todo lo que existe en la app y cuándo usarlo.

---

## 1. COLORES

### Colores de marca (los más importantes)
| Token | Valor | Uso |
|---|---|---|
| `--color-brand-purple` | `#a855f7` | Botones primarios, acentos principales |
| `--color-brand-purple-hover` | `#9333ea` | Estado hover de lo anterior |
| `--color-brand-purple-light` | `#c084fc` | Textos de acento suave |
| `--color-brand-purple-muted` | `rgba(168,85,247, 0.15)` | Fondos de badge, chips de tag |
| `--color-brand-blue` | `#2563eb` | Segundo color de botones, gráficos |
| `--color-brand-blue-light` | `#60a5fa` | Textos secundarios azules, barras de progreso |

### Gradientes de marca
| Token | Uso |
|---|---|
| `--grad-brand` | Gradiente 90° horizontal — botones primarios, CTAs |
| `--grad-brand-hover` | Versión hover del gradiente |
| `--grad-brand-135` | Gradiente 135° diagonal — iconos, avatares |
| `--grad-hero` | Gradiente púrpura-azul profundo — hero cards principales |

### Colores semánticos (estados)
| Token | Color | Cuándo usarlo |
|---|---|---|
| `--color-success` | `#22c55e` 🟢 | Decisión completada, objetivo alcanzado, toast success |
| `--color-success-light` | `#4ade80` | Texto verde en tarjetas oscuras |
| `--color-success-muted` | `rgba(34,197,94, 0.12)` | Fondo de estado completado |
| `--color-error` | `#ef4444` 🔴 | Errores de formulario, botón eliminar |
| `--color-error-light` | `#f87171` | Texto de error en fondos oscuros |
| `--color-error-muted` | `rgba(239,68,68, 0.10)` | Fondo de caja de error |
| `--color-warning` | `#f59e0b` 🟡 | Alerta de racha en riesgo, pendiente |
| `--color-warning-light` | `#fbbf24` | Texto warning en fondos oscuros |
| `--color-info` | `#60a5fa` 🔵 | Toast info, badges informativos |
| `--color-streak` | `#fb923c` 🔥 | Todo lo relacionado con la racha diaria |

### Colores de gamificación (niveles)
| Token | Color | Nivel |
|---|---|---|
| `--color-level-bronze` | `#d97706` | Bronce (50€+) |
| `--color-level-silver` | `#94a3b8` | Plata (100€+) |
| `--color-level-gold` | `#eab308` | Oro (500€+) |
| `--color-level-diamond` | `#60a5fa` | Diamante (1000€+) |

### Escala de grises (Slate)
| Token | Valor | Uso típico |
|---|---|---|
| `--slate-50` / `--slate-100` | `#f8fafc` / `#f1f5f9` | NO SE USA (modo dark) |
| `--slate-300` | `#cbd5e1` | Texto terciario |
| `--slate-400` | `#94a3b8` | Texto secundario, iconos |
| `--slate-500` | `#64748b` | Placeholders, borders suaves |
| `--slate-700` | `#334155` | Borders de tarjetas oscuras |
| `--slate-800` | `#1e293b` | Fondo de inputs, modales |
| `--slate-900` | `#0f172a` | Fondo de widgets, tarjetas |
| `--slate-950` | `#0d0d14` | Fondo base de la app |

---

## 2. TIPOGRAFÍA

> Fuente: **Inter** (Google Fonts). Todos los pesos son semánticos.

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--type-hero` | 32px / 800 | Extra Bold | Solo pantallas auth (login, signup) |
| `--type-display` | 28px / 800 | Extra Bold | Métricas grandes, totales ahorrados |
| `--type-h1` | 22px / 700 | Bold | Título principal de cada pantalla |
| `--type-h2` | 18px / 700 | Bold | Título de card, modal, widget |
| `--type-h3` | 15px / 600 | SemiBold | Subtítulos, nombres de objetivo |
| `--type-body-strong` | 14px / 600 | SemiBold | Texto con énfasis, labels de fila |
| `--type-body` | 14px / 400 | Regular | Texto principal, descripciones |
| `--type-small` | 13px / 400 | Regular | Texto secundario, mensajes error |
| `--type-btn` | 14px / 600 | SemiBold | Todos los botones |
| `--type-label` | 11px / 600 | SemiBold + UPPERCASE | Labels de formulario, secciones |
| `--type-caption` | 12px / 400 | Regular | Timestamps, copyright, microcopy |
| `--type-nav` | 10px / 500 | Medium | Labels del menú inferior |
| `--type-metric-label` | 10px / 600 | SemiBold + UPPERCASE | Etiquetas de métricas en header |

---

## 3. BORDES (Border-radius)

> **Regla clave:** el radio aumenta cuanto mayor es el elemento.

| Token | Valor | Alias semántico | Usado en |
|---|---|---|---|
| `--radius-sm` | 8px | `--radius-input`, `--radius-badge` | Inputs, badges pequeños, dropdown items |
| `--radius-md` | 12px | `--radius-btn` | Botones, chips, cards secundarias |
| `--radius-lg` | 16px | `--radius-card` | Modales, tarjetas de objetivo (GoalCard) |
| `--radius-xl` | 20px | `--radius-widget` | Widgets principales del dashboard |
| `--radius-2xl` | 28px | `--radius-hero` | PrimaryGoalHero, ProfileHero |
| `--radius-full` | 9999px | `--radius-pill` | Pills, avatares, badges circulares |
| `--radius-icon` | 10px | — | Contenedores de icono (icon wrap) |

---

## 4. SOMBRAS

| Token | Uso |
|---|---|
| `--shadow-sm` | Tarjetas pequeñas, hover suave |
| `--shadow-md` | Widgets y cards estándar |
| `--shadow-lg` | Modales, overlays flotantes |
| `--shadow-glow-purple` | Glow debajo de botones primarios en hover |
| `--shadow-glow-blue` | Glow de elementos de acción secundarios |
| `--shadow-glow-brand` | Glow general de elementos de marca |
| `--shadow-widget` | Sombra estándar de widgets del dashboard |
| `--shadow-widget-hover` | Sombra aumentada en hover de widget |

---

## 5. TRANSICIONES Y ANIMACIONES

### Velocidades
| Token | Valor | Cuándo |
|---|---|---|
| `--transition-fast` | 150ms ease | Hover de botones, badges |
| `--transition-normal` | 200ms ease | Apertura de dropdowns, focus de inputs |
| `--transition-slow` | 300ms ease | Entrada de modales, collapses |
| `--duration-slower` | 500ms | Animaciones de entrada de página |

### Keyframes disponibles
| Nombre | Efecto | Usado en |
|---|---|---|
| `fadeIn` | Aparece con opacidad | Páginas, overlays |
| `slideUp` | Sube desde abajo | Widgets del dashboard (staggered) |
| `slideIn` | Baja desde arriba | Dropdowns, toasts |
| `pulse` | Pulso de opacidad | Puntos de estado "Pendiente" |
| `shimmer` | Barrido brillante | WidgetSkeleton (loading) |
| `wave` | Agita el emoji 👋 | Header de bienvenida |
| `gradientShift` | Mueve el gradiente | Fondo animado del hero |
| `widgetEnter` | Fade + translateY | Entrada staggered de widgets |

---

## 6. Z-INDEX (capas de la app)

| Token | Valor | Qué hay ahí |
|---|---|---|
| `--z-dropdown` | 20 | Menús desplegables (History, filtros) |
| `--z-sidebar` | 50 | Sidebar de navegación desktop |
| `--z-modal-overlay` | 100 | Fondo oscuro detrás de modales |
| `--z-modal` | 101 | El propio modal encima del overlay |
| `--z-bottomnav` | 200 | Barra de navegación inferior (BottomNav) |
| `--z-daily-modal` | 500 | Modal especial de decisión diaria |
| `--z-toast` | 1000 | Notificaciones Toast — siempre encima de todo |

---

## 7. BOTONES — Componente `<Button>`

### Variantes
| Variante | Apariencia | Cuándo usarlo |
|---|---|---|
| `primary` | Gradiente púrpura→azul, texto blanco | Acción principal de la pantalla |
| `secondary` | Fondo slate oscuro, borde sutil | Acción secundaria, "Cancelar" |
| `outline` | Transparente con borde visible | Alternativa visual a secondary |
| `ghost` | Sin fondo ni borde, solo texto | Links dentro de contenido |
| `danger` | Rojo sólido / gradiente rojo | Eliminar, reiniciar, archivar |
| `heroPrimary` | Blanco sólido con texto oscuro | Solo dentro de hero cards (PrimaryGoal) |
| `heroSecondary` | Blanco 15% transparente | Solo dentro de hero cards |

### Tamaños
| Tamaño | Padding | Cuándo |
|---|---|---|
| `sm` | 7px 12px | Acciones secundarias, botones de fila compacta |
| `md` | 11px 20px | Estándar — la mayoría de botones |
| `lg` | 14px 28px | CTAs grandes, botones en pantalla completa |

### Props adicionales
| Prop | Efecto |
|---|---|
| `fullWidth` | Ocupa el 100% del ancho disponible |
| `icon` | Añade un icono a la izquierda del texto |
| `iconOnly` | Solo muestra el icono (botón cuadrado) |
| `loading` | Muestra spinner, bloquea clicks |
| `disabled` | Opacidad reducida, sin interacción |

---

## 8. BADGES — Componente `<Badge>`

Los badges son etiquetas de estado, nunca botones.

### Variantes de color
| Variante | Color | Cuándo |
|---|---|---|
| `default` | Gris slate | Estado neutro, sin información concreta |
| `primary` | Púrpura marca | Tag principal, "PRINCIPAL" en objetivos |
| `blue` | Azul info | Información extra, categorías |
| `success` | Verde | "Completado", decisión tomada |
| `danger` | Rojo | Error, alerta crítica |
| `warning` | Ámbar | "Pendiente", advertencia |
| `streak` | Naranja fuego | Racha activa, días consecutivos |
| `bronze` / `silver` / `gold` / `diamond` | Colores de nivel | Solo en contexto de gamificación |

### Props adicionales
| Prop | Efecto |
|---|---|
| `pill` | Borde completamente redondeado (--radius-full) |
| `uppercase` | Texto en mayúsculas + letter-spacing |
| `bold` | Peso 700 |
| `dot` | Añade un punto de color a la izquierda |
| `dotPulse` | El punto anima con pulso (solo con `dot`) |
| `icon` | Icono/emoji antes del texto |

---

## 9. TOASTS — Componente `<Toast>` / `useToast()`

Las notificaciones aparecen en la esquina inferior centrada, encima del BottomNav.

### Cómo usarlo
```tsx
const { addToast } = useToast();
addToast('Texto del mensaje', 'success');  // 4 tipos disponibles
```

### Tipos de toast
| Tipo | Color del borde | Icono | Cuándo usarlo |
|---|---|---|---|
| `success` | Verde | ✓ | Acción completada: crear objetivo, guardar nombre, decisión registrada |
| `error` | Rojo | ✗ | Error crítico, fallo al guardar |
| `info` | Azul | ⓘ | Cambio de estado neutral: archivar, reiniciar decisión |
| `warning` | Ámbar | ⚠ | Advertencia: acción con consecuencias, no crítica |

> Auto-dismiss en 3.5 segundos.

---

## 10. SKELETON — Componente `<WidgetSkeleton>` / `<Skeleton>`

Reemplaza cualquier texto "Cargando..." mientras los datos se cargan.

### Uso
```tsx
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';

// En lugar de: <div>Cargando...</div>
<WidgetSkeleton />
```

### Variantes
| Variante | Cuándo |
|---|---|
| `<Skeleton />` | Línea de texto genérica |
| `<Skeleton circle />` | Avatar o icono circular |
| `<Skeleton width="X%" />` | Línea de ancho controlado |
| `<WidgetSkeleton />` | Bloque completo de widget (header + 3 líneas) |

---

## 11. EMPTY STATE — Componente `<EmptyState>`

Reemplaza cualquier mensaje inline de "Sin datos" o "No hay X".

### Uso
```tsx
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';

<EmptyState
  icon="🎯"
  title="Sin objetivos activos"
  description="Crea tu primer objetivo para empezar a ahorrar."
  action={{ label: 'Crear objetivo', onClick: () => setModalMode('create') }}
/>
```

### Props
| Prop | Tipo | Descripción |
|---|---|---|
| `icon` | string (emoji) | Emoji grande encima del título |
| `title` | string | Frase principal (H3) |
| `description` | string | Subtexto explicativo (body) |
| `action` | `{ label, onClick }` | Botón CTA opcional |

---

## 12. ESTRUCTURA DE WIDGETS (patrón de 4 capas)

Todo widget del dashboard sigue esta estructura interna:

```
.wrapper          ← Posición relativa, tamaño
  .bgGradient     ← Capa 1: fondo con gradiente oscuro
  .glowOverlay    ← Capa 2: efecto glow difuso (blur radial)
  .borderLayer    ← Capa 3: borde glassmorphism semitransparente
  .content        ← Capa 4: contenido real (z-index 1)
```

**¿Cuándo usar `<WidgetWrapper>`?**
Para widgets nuevos simples. Los widgets complejos (DailyDecision, PrimaryGoalHero, SavingsEvolution) tienen su propio wrapper equivalente.

---

## 13. REGLAS GENERALES

### ❌ Prohibido
- Hardcodear colores hex en componentes (ej: `color: '#a855f7'`) — usar tokens
- Usar z-index numéricos manuales — usar `var(--z-*)`
- Usar border-radius numéricos — usar `var(--radius-*)`
- Mostrar texto plano "Cargando..." — usar `<WidgetSkeleton>`
- Mostrar div inline de "sin datos" — usar `<EmptyState>`
- Crear botones con `<button style={{...}}>` — usar `<Button variant="...">`

### ✅ Correcto
- Nuevos colores → añadir token en `src/styles/tokens/colors.css`
- Nuevo componente UI → añadir carpeta en `src/components/ui/` + exportar en `index.ts`
- Notificaciones → `useToast()` siempre disponible (en el layout raíz)
- Loading states → `<WidgetSkeleton />` o `<Skeleton />`
- Estados vacíos → `<EmptyState icon title description action />`

---

*Archivo generado automáticamente — última actualización: Mayo 2026*
*Ver también: `src/docs/StyleGuide.md` para reglas de CSS avanzadas*
