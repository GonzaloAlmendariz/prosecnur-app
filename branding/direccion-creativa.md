# Prosecnur — Dirección creativa de la identidad visual

Versión 1.2 · julio 2026. Documento de congelamiento: toda pieza de la identidad
(logo, sistema gráfico, componentes, motion, pantallas) se produce contra esta
dirección. Fuente de reconocimiento: `frontend/src/app/theme.css`,
`packaging/windows/brand/`, `api/R/pulso_pdf_theme.R`, `docs/ui-layout-grammar.md`.

## Concepto: «La señal ordenada»

Prosecnur convierte el pulso crudo del campo —encuestas, monitoreo, bases
vivas— en evidencia ordenada y defendible. La identidad expresa ese tránsito:
**ritmo contenido en geometría**. El resultado debe sentirse como un
instrumento profesional de precisión, no como un dashboard genérico:
moderno, dinámico, silencioso en el chrome y protagonista en el dato.

## Marca

- **Isotipo «Ecualizador del pulso»**: contenedor squircle navy (radio 24%)
  con cuatro pastillas blancas de extremos redondeados cuyo perfil traza un
  latido (alturas 18 / 26 / 20 / 32 sobre retícula de 64). Evoluciona el ADN
  existente (círculo + barras de `Layout.tsx`/`BootGate.tsx` y el icono de 4
  barras del instalador Windows) y **unifica los dos trazados divergentes**
  en uno canónico.
- **Wordmark**: «Prosecnur» en stack de sistema (SF Pro / Segoe UI), peso 800,
  tracking −0.02em, navy `#002457`. Sobre fondos oscuros, blanco.
- **Jerarquía de emisión**: Prosecnur es el producto; «PULSO PUCP» acompaña
  como subline institucional («Suite analítica · PULSO PUCP»).
- **Dos tintas máximo en la marca** (navy + blanco). El color vivo pertenece
  al sistema (espectro modular, azul señal), nunca al logo.

## Color

Proporción 60 / 30 / 10: superficies frías dominan, el navy estructura,
el acento (modular o señal) aparece de forma puntual e intencional.

| Rol | Nombre | HEX |
| --- | --- | --- |
| Primario de marca | Navy Pulso | `#002457` |
| Profundidad de marca (gradiente icono) | Navy 800 | `#013371` |
| Secundario dinámico (interactivo brillante, charts) | Azul Señal | `#2457D6` |
| Texto principal | Tinta | `#17212F` |
| Texto secundario | Pizarra | `#5F6B7A` |
| Texto terciario | Bruma | `#8792A2` |
| Superficies | Papel / Hielo / Niebla / Lienzo / Fondo profundo | `#FFFFFF` / `#FAFBFF` / `#F2F5FA` / `#F3F5F9` / `#E9EDF5` |
| Bordes | Borde / Borde fuerte | `#E2E7F0` / `#CBD5E4` |
| Éxito | Verde | `#16A34A` (fondo `#DCFCE7`, texto `#166534`) |
| Alerta | Ámbar | `#D97706` (fondo `#FFF4E0`, texto `#8A5000`) |
| Peligro | Carmesí | `#BE123C` (fondo `#FEF2F2`, texto `#991B1B`) |

**Espectro modular** (la dimensión dinámica de la identidad; cada módulo
tiñe su chrome, nunca el contenido): Editor `#6D5DFC` · Procesamiento
`#0F766E` · Dashboard `#2563EB` · Hojas de ruta `#C2410C` · Muestra
`#7C3AED` · Bitácora `#A16207` · Recopiladores `#0891B2` · Monitoreo `#BE123C`.

## Tipografía — «Voz nativa»

- **Principal**: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.
- **Secundaria (datos/código)**: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  siempre con `font-variant-numeric: tabular-nums` en métricas.
- **Escala**: Display 28/1.2/680 · Título 22/1.25/640 · Sección 17/1.3/600 ·
  Cuerpo 15/1.55/400 · Cuerpo medio 15/500 · Nota 13/1.45/400 · Pie 12/1.35/500 ·
  Micro 11/1.2/600 mayúsculas +0.06em.
- **Peso de trabajo de controles**: 500 en macOS, 600 en Windows
  (`data-platform="windows"`); la jerarquía se construye con tamaño y color,
  no con bold.

## Espaciado, geometría y grilla

- Base 4px: escala 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48.
- Radios: control 10 · tarjeta 14 · panel 16 · lens 20 · chip 999.
- Alturas de control: 28 (default) · 36 (toolbar/CTA). Check 16px.
- Rail lateral 240px, filas 32/40. Mínimos operativos 360/260/240.
- Jerarquía de contenedores: Shell → PageFrame (document / workbench /
  canvas / data), un solo dueño de scroll por pantalla («No Scroll Jail»).

## Iconografía

Lucide vía shim (`src/vendor/lucide-react.ts`), trazo 1.5, tamaños 16/18/20,
esquinas redondeadas, sin rellenos salvo estados activos. Los iconos heredan
el color del texto o el acento del módulo; nunca introducen colores nuevos.

## Motion — «Física Pulso»

CSS puro tokenizado; sin librerías JS de animación.

| Token | Valor | Uso |
| --- | --- | --- |
| `press` | 120ms | Presión de controles (scale 0.98) |
| `fast` | 160ms | Hover, focus ring, chips |
| `base` | 220ms | Aparición de contenido, fades con rise de 6–8px |
| `panel` | 280ms | Drawers, popovers, rutas |
| `slow` | 420ms | Celebraciones, gráficos, logo |

Easings: **salida** `cubic-bezier(.23,1,.32,1)` (dominante) · estándar
`cubic-bezier(.2,0,0,1)` · drawer `cubic-bezier(.32,.72,0,1)` · productivo
`cubic-bezier(.16,1,.3,1)` · in-out `cubic-bezier(.77,0,.175,1)`.
Rutas: enter y+8px, forward x+12px, back x−12px. Todo respeta
`prefers-reduced-motion`. Firma de marca: el isotipo entra con stagger de
pastillas (60ms entre barras, `slow` + productivo).

## Patrones maestros (v1.1 — destilados de lo mejor ya construido)

La identidad no inventa el chrome: **canoniza los ejemplares más profesionales
que ya viven en la app** y los eleva a norma para todos los módulos.

1. **Command bar de módulo** (ejemplar: `mon-commandbar`, Monitoreo): grid de
   3 zonas — contexto | rail de secciones | acciones —, material translúcido
   (doble gradiente blanco + `--pulso-material-bg` + `blur(18px) saturate(1.08)`),
   borde teñido con el acento del módulo, radio 18, altura mínima 46, controles
   de 32. El acento entra **reasignando `--pulso-primary`** en el scope del
   módulo, nunca regla por regla.
2. **Rail de secciones centrado** (ejemplar: `pulso-phase-pillbar`): pillbar
   material centrado (`margin-inline:auto`, radio 999, blur 16), pills de
   34px (32 en módulos densos); hover = fill que crece desde el centro
   (opacity + scaleX .94→1, base/salida); activo = gradiente del primario +
   texto blanco + sombra `0 5px 12px rgba(0,36,87,.19)`; número de fase 19×19
   tabular. Entrada con `x −6→0` (base/salida). Es el selector de secciones
   primario de TODO módulo.
3. **Sidebar de pestañas icon-compressed** (ejemplar: Procesamiento; decisión
   dec-sidebar-icon-tooltip, 2026-07-16): el 3er nivel está **SIEMPRE
   comprimido** (solo íconos, ~56px) — nunca se expande ni empuja el canvas.
   El reveal es una **burbuja flotante elegante** en hover/focus
   (`data-rail-tooltip` → `::before` a `left: calc(100% + 8px)`, radio 10,
   material blanco en capas, 11px/760, título + subtítulo en `pre-line`,
   z-index 420) que aparece **siempre — incluida la pestaña activa**. La
   identificación persistente la da el **título compacto de la pestaña activa
   al inicio del workbench** (ícono en tile + título + subtítulo, minimal).
   Activa = gradiente del primario en el tile. Accesibilidad: `aria-label`
   con título y detalle (sin `title` nativo, que pisaría la burbuja
   estilizada); la burbuja también sale con `:focus-visible`. En apilado
   angosto (<921px) el rail vive expandido EN FLUJO fijo, sin reaccionar al
   hover. El push por grid queda **deprecado** como patrón de 3er nivel.
4. **Switch maestro** (`pulso-switch`): 44×24, track cóncavo (gradiente
   `#eef2f7→#dfe6ef` + sombras internas), knob blanco de 18 elevado
   (`0 1px 2px rgba(15,23,42,.22)`), desliza `left 2→22` en fast/salida,
   encendido = gradiente del primario, presión `scale(.97)`, foco anillo 4px.
5. **KPI discreto** (ejemplar: banda canónica de Monitoreo de aulas): valor
   **21px/900** tabular — nunca gigante —, etiqueta 9.5px/900 mayúsculas,
   hairline de acento de 2px al pie de la tile; el color del módulo vive en el
   contenedor y el hairline, jamás en el número; el semántico (warn/danger)
   aparece solo cuando hay brecha real. Versión command-bar: 12px/820.
6. **Procedencia y herencia** (ejemplar: Gráficos v2): barra izquierda de 4px
   codificando el origen del valor (violeta = heredado del modo, verde =
   override del usuario) + `focus-within` con anillo; acento-por-rol vía token
   remapeado (`--layout-accent` por `data-role`); swatches de color 24×24 con
   borde interior de vidrio y hover `scale(1.08)`.
7. **Iconografía en dos capas**: capa 1 = alias semánticos de lucide en
   `src/lib/icons.ts` (nombre por concepto, un punto de cambio:
   `IconProcessing=Workflow`, `IconMonitor=Activity`, `IconSample=Calculator`,
   `IconCollector=QrCode`…); capa 2 = glifos SVG a mano SOLO para
   representaciones de dominio que lucide no puede dar (tipos de gráfico,
   gauges, diagramas de flujo). Nunca packs mezclados en la capa 1.
8. **Firmas de motion de feature**: la triada de PageFrame (cuerpo 190ms /
   header 150ms / toolbar 160ms, easing de salida) es la transición base de
   toda ruta; el «orbit-in + edge-draw» del dashboard (nodos 620ms productiva +
   aristas `stroke-dashoffset` 680ms) es la firma para diagramas y árboles.

## Materiales y elevación (v1.2)

- **Seis niveles de sombra fría** (base navy/pizarra, jamás negro puro):
  low (reposo) · soft (tarjetas) · med (hover-lift) · high (diálogos) ·
  raised (workbench) · popover (flotantes). Lo que empuja en flujo no flota;
  solo lo que se superpone usa niveles altos.
- **Vibrancy simulada Windows-safe**: gradiente blanco + superficie translúcida
  (`color-mix` 82/92/74%) + `backdrop-filter` progresivo (10/14/18 según
  jerarquía). Material SOLO en navegación y capas de comando; formularios
  densos en superficie sólida. Degrada con dignidad sin backdrop-filter.

## Datos y entregables (v1.2)

- **Una sola fuente cromática para CSS, PDF y Plotly**: el navy ancla las tres
  capas (`pulso_plotly_palette`, `pulso_pdf_tokens`, `--pulso-*`); los
  semánticos de chart son los del sistema.
- **Secuencial = intensidad del navy** (`#DBE8FF → #7AA2F8 → #2457D6 →
  #002457`); nunca arcoíris. Charts: grid sutil horizontal, ejes sin línea
  dura, sin 3D ni sombras ni degradados decorativos, un acento por gráfico,
  eje Y en 0 para barras, endpoint enfatizado en líneas, tabular-nums.
- **La capa Pulso PDF es normativa** (cabecera/pie/logo/hairlines/tablas
  zebra, escala en pt); el layout por motor es libre. PPT/XLSX heredan paleta
  y tipografía; el XLSX conserva los colores de tipo de pregunta canónicos.
- «Si un número aparece en pantalla, en un PDF y en un PPT, debe contar la
  misma historia con la misma paleta.»

## Identidad verbal — voz y tono (v1.2)

Prosecnur habla como un colega experto: claro antes que elegante, de tú en
español peruano neutro, técnico cuando aporta, sereno siempre. Las acciones
dicen lo que hacen (verbo + objeto: «Marcar 6 como revisadas», nunca
«Aceptar»); los errores explican qué pasó y cómo seguir (código `E_*` visible
pero al final, en mono); números es-PE (miles con coma, decimales con punto,
horas 24h, tabular en columnas); mayúscula solo inicial en controles, las
sostenidas reservadas a micro-etiquetas con tracking; vocabulario canónico
sin sinónimos improvisados (base procesable, cursos-horario, marco muestral,
recopilador, corte). La voz es parte del contrato visual.

## Economía del chrome (reglas duras heredadas del design system)

- **Sin franjas de título**: los módulos no llevan H1 visible (patrón
  `headerMode="sr-only"`); la identidad vive en el chrome — command bar, rail,
  contexto. Sin títulos interiores redundantes en paneles.
- **Datos en el primer viewport**: exploradores, filtros y resúmenes son
  herramientas subordinadas; con datos poblados, el primer viewport muestra
  filas/tarjetas/gráficos reales.
- **Acento inyectado por variable**: `--module-accent` / `--home-mod-accent` /
  reasignación de `--pulso-primary`; nunca hex de módulo hardcodeado por regla.
- **El acento es chrome, el semántico es significado**: éxito/alerta/peligro/info
  jamás se sustituyen por el color del módulo.

## Principios (contra los que se revisa cada pieza)

1. **Orden ante todo** — alineación a retícula de 4, ópticamente verificada.
2. **El color señala, no decora** — el acento identifica módulo o estado;
   el resto es frío y silencioso.
3. **Nativo en serio** — tipografía del sistema, geometría macOS-like,
   implementación Windows-safe (sin vibrancy real, pesos compensados).
4. **Movimiento con propósito** — rápido, con easing de salida; nada supera
   420ms; siempre con vía reducida.
5. **El dato es el protagonista** — números tabulares, jerarquía tipográfica
   clara, chrome que desaparece.
