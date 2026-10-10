# Privacidad en analítica · Ahorro Invisible (5C.4)

Complementa a [`tracking_plan.md`](./tracking_plan.md). Código: [`src/lib/posthog.ts`](../../src/lib/posthog.ts),
[`src/services/analyticsCatalog.ts`](../../src/services/analyticsCatalog.ts). Verificación: `npm run analytics:check`.

## Por qué

La app muestra en pantalla importes de ahorro, objetivos con título libre y el nombre del usuario.
Cualquier captura "automática" (grabación de sesión, heatmaps, autocapture de clics/textos) podría
llevarse esa información a PostHog. Por eso la captura automática queda **desactivada en código**,
sin depender de la configuración remota del proyecto de PostHog.

## Configuración de PostHog (forzada en `initPosthog`)

| Opción | Valor | Motivo |
|---|---|---|
| `autocapture` | `false` | Evita capturar textos de botones/inputs |
| `capture_pageview` | `false` | Las vistas se emiten a mano (`*_viewed`) con propiedades controladas |
| `capture_pageleave` | `false` | `$pageleave` arrastra URL completa y no aporta a los KPIs |
| `disable_session_recording` | `true` | Session Replay grabaría importes y títulos en pantalla |
| `enable_heatmaps` | `false` | Idem (coordenadas + elementos) |
| `capture_dead_clicks` | `false` | Idem |
| `capture_exceptions` | `false` | Los mensajes de excepción pueden contener datos del usuario |
| `disable_surveys` | `true` | Sin texto libre de encuestas en PostHog |
| `person_profiles` | `identified_only` | Sin perfiles anónimos |
| `before_send` | `sanitizeUrls` | Quita query string y hash de cualquier propiedad `*url*` / `*referrer*` (p. ej. `?code=` del callback de Auth) |

`analytics:check` falla si falta `disable_session_recording: true`, `autocapture: false`,
`capture_pageview: false`, `enable_heatmaps: false` o `before_send`.

## Qué se envía y qué no

| Se envía | No se envía nunca |
|---|---|
| UUID de Supabase (`user_id`, `distinct_id`) | Email, nombre, teléfono, contraseña |
| `is_internal` (booleano, calculado en el navegador) | El email usado para calcularlo |
| Importes **de ahorro** registrados (`amount`, `target_amount`…) | Ingreso exacto (solo `income_band`) |
| Claves de catálogo (`question_id`, `answer_key`, `option_key`) | Texto libre: respuestas custom (→ `__custom__`), notas, títulos |
| `error_code` normalizado, `error_field` (nombre del campo) | `error_message`, valor del campo erróneo |
| IDs de servidor **solo** en `*_confirmed` | IDs locales en intenciones/vistas |

Capas de defensa:

1. **Catálogo tipado**: `track()` solo acepta eventos del catálogo; `analytics:check` exige que cada
   propiedad emitida esté declarada en él y en el tracking plan.
2. **`scrubProps()`**: elimina claves de `FORBIDDEN_PROP_KEYS` y cualquier string con forma de email.
3. **`analytics:check`**: bloquea IDs en eventos no confirmados, propiedades con nombre de riesgo
   (`url`, `title`, `name`, `note`, `text`, `email`, `message`…) y argumentos sospechosos
   (`String(err)`, `.message`, `email`, `note`, `title`) en llamadas a `analytics.*`.
4. **`before_send`**: último filtro de URLs antes de salir del navegador.

## Configuración remota recomendada (proyecto PostHog)

Aunque el código ya lo fuerza, conviene dejarlo coherente en el panel:

- Session Replay: **off**. Heatmaps / Web analytics autocapture: **off**.
- "Discard client IP data": **on**.
- Retención de eventos según política de datos del producto.
