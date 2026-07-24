# Prosecnur — Dirección creativa v3

Versión propuesta 3.0 · julio 2026.

Estado: **Propuesta, pendiente del gate humano de territorio y congelamiento**.
Modo de identidad: **evolución**. La identidad v1.2 sigue siendo la identidad
congelada y operativa hasta que esta propuesta sea aprobada, codificada en
`branding/identity.json` y compilada de forma determinista.

## Brief aprobado para la evolución

El pedido explícito de ejecutar `docs/plan-revamp-ui-2026-07.md` aprueba el
brief de la evolución v3:

- Prosecnur sigue siendo un instrumento profesional de precisión para
  investigación por encuestas, local-first, desktop-first y dual-platform.
- Se conservan sin redibujo el isotipo, las diez variantes de
  `branding/logo/`, la marca de dos tintas, la jerarquía Prosecnur · PULSO PUCP,
  la arquitectura No Scroll Jail y el warm start de proyectos `.pulso`.
- La UI v3 migra la navegación de módulo, sección y pestaña a un **sidebar
  unificado**. Esta decisión humana del 23 de julio de 2026 reemplaza el rail
  centrado como navegación primaria y el rail icon-only expandido de la v1.2.
- El chrome se vuelve silencioso de verdad; los datos y las tareas ganan el
  primer viewport.
- El sistema se completa con roles explícitos de espaciado, tipografía,
  capas, navegación y estados.
- Windows sigue siendo el release bloqueante; macOS define la gramática, no
  una dependencia de plataforma.

### Evidencia que gobierna

| ID | Tipo | Fuente | Decisión que controla |
| --- | --- | --- | --- |
| `ev-v3-plan` | decisión | `docs/plan-revamp-ui-2026-07.md` | UI v3, sidebar unificado, fases y métricas |
| `ev-v3-guide` | referencia | `Art_app/docs/guia-general-ui-alto-sidebar-secciones-pestanas.md` | geometría, scroll, semántica y teclado |
| `ev-v3-baseline` | hecho | baseline visual del 23 de julio de 2026 | divergencia real entre módulos y chrome |
| `ev-v3-brand` | artefacto canónico | `branding/direccion-creativa.md`, ADR 0038 y `branding/logo/` | equity que no cambia |
| `ev-v3-layout` | contrato | `docs/ui-layout-grammar.md` | PageFrame, breakpoints y No Scroll Jail |
| `ev-v3-runtime` | hecho | app real con proyecto canónico | workflows densos, estados y restricciones |

Cuando una regla v1.2 contradice la decisión actual, manda `ev-v3-plan`. La
regla reemplazada se conserva como evidencia histórica y se registra en el ADR
del shell; no se borra silenciosamente.

## Norte: «La señal ordenada, ahora habitable»

La v1.2 hizo reconocible la marca; la v3 hace habitable el sistema completo.
La señal no vive en gradientes, rails repetidos o marcos decorativos: vive en
la continuidad del sidebar, el rail activo de tres píxeles, el acento modular
justo y el dato que aparece antes que el chrome.

La interfaz debe sentirse como un instrumento sereno que permanece estable
mientras el proyecto cambia de módulo, sección y pestaña.

## Territorios considerados

Los tres territorios respetan el sidebar unificado, la marca, la paleta y la
geometría obligatoria. Cambian la relación entre densidad, materialidad,
tipografía y señal modular. El comparador visual vive en
`branding/v3/shell-territories.html`.

### A · Instrumento sereno — recomendado

**Tesis:** una columna de navegación material, continua y silenciosa sostiene
un canvas sólido donde la información manda.

- Sidebar con una sola superficie fría, un hairline vertical y material
  simulado únicamente en navegación y flyouts.
- Selección por rail de 3px + fondo suave + peso 600; nunca solo por color.
- Header contextual de 44px, sin gradiente decorativo ni segunda navegación.
- Densidad media-alta: filas 36/34, iconos 18, tipografía 14 y micro 11.
- El acento del módulo aparece en la selección, el icono de contexto y
  hairlines; los semánticos conservan su significado.
- La firma reconocible es la **traza contenida**: una línea activa que une
  contexto, destino seleccionado y KPIs sin convertirse en decoración.

Riesgo: si el material del sidebar gana demasiado contraste, vuelve a competir
con el dato. Condición de descarte: el primer viewport parece una vitrina de
navegación.

### B · Cartografía modular

**Tesis:** la app se entiende como un mapa de trabajo; los módulos son
territorios y el sidebar expresa relaciones y procedencia.

- Secciones con más aire y agrupación espacial.
- El acento modular tiene mayor presencia en bordes, conectores y estados de
  procedencia.
- Toolbars y paneles usan una señal de ruta más explícita.
- Favorece Monitoreo, Hojas de ruta y Muestra, donde el territorio es parte del
  dominio.

Riesgo: eleva la carga cromática y puede convertir el chrome en protagonista.
Condición de descarte: dos módulos parecen productos distintos.

### C · Mesa editorial

**Tesis:** la jerarquía nace de tipografía, ritmo y reglas; el color casi
desaparece del chrome.

- Sidebar mate, casi monocromático, con labels y metadatos como principal
  señal.
- Menos contenedores, menos blur y más hairlines.
- Excelente para documentos, validación y análisis prolongado.
- El contenido adopta una voz de mesa de trabajo editorial.

Riesgo: reduce el reconocimiento modular y puede sentirse austero en Windows.
Condición de descarte: el módulo activo no se reconoce en menos de dos
segundos.

### Evaluación común

Escala 0–100; el puntaje documenta trade-offs y no sustituye la decisión
humana.

| Criterio | Peso | A · Instrumento sereno | B · Cartografía modular | C · Mesa editorial |
| --- | ---: | ---: | ---: | ---: |
| Ajuste estratégico | 25 | 24 | 20 | 22 |
| Usabilidad y dato en primer viewport | 25 | 24 | 20 | 23 |
| Resiliencia macOS/Windows | 15 | 14 | 11 | 13 |
| Distintividad reconocible | 15 | 13 | 15 | 11 |
| Accesibilidad y teclado | 10 | 10 | 8 | 9 |
| Coste de implementación/gobierno | 10 | 8 | 6 | 8 |
| **Total** | **100** | **93** | **80** | **86** |

**Recomendación de dirección:** A · Instrumento sereno. Conserva el ADN de
«La señal ordenada», cumple mejor la guía y reduce la deriva sin convertir la
v3 en una marca nueva.

## Sistema propuesto de «Instrumento sereno»

Esta sección se vuelve normativa únicamente después de la aprobación humana.

### Anatomía del shell

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ Marca + contexto     │ Proyecto · estado · acciones contextuales   │
│ 224px / 56px         ├──────────────────────────────────────────────┤
│                      │ Toolbar local opcional                       │
│ SECCIÓN              ├──────────────────────────────────────────────┤
│  ◫ Pestaña           │                                              │
│  ◇ Pestaña activa    │              Superficie de trabajo           │
│                      │                                              │
│ OTRA SECCIÓN         │        cada región posee su propio scroll    │
│                      │                                              │
│──────────────────────│                                              │
│ Buscar · Ajustes     │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

#### Sidebar expandido

- Ancho: `224px`.
- Padding exterior: `8px`.
- Zona superior: marca de 40px + selector de contexto de 36px, separadas por
  `8px`; no contiene acciones crecientes.
- Zona central: `flex: 1; min-height: 0; overflow-y: auto`;
  `scrollbar-gutter: stable`.
- Sección: fuente de datos en sentence case; visual `11px/600`, mayúsculas por
  CSS, tracking `0.06em`; `16px` antes y `6px` después.
- Pestaña: `34px` de alto, icono `18px`, gap `8px`, label `14px/500`.
- Activo: rail físico de `3px`, superficie `--module-accent-soft`, texto
  principal y peso 600; `aria-current="page"`.
- Utilidades: filas de `36px` separadas por hairline; no forman parte del árbol
  de destinos.

#### Sidebar colapsado

- Ancho: `56px`.
- Cada sección conserva icono, nombre accesible y estado activo.
- El flyout se abre por hover **y** foco; puede persistir al mover el puntero o
  foco dentro; Escape lo cierra y restaura el foco.
- El flyout contiene labels completos; nunca depende solo del tooltip.
- No se oculta ningún destino por falta de alto: la zona central scrollea.

#### Drawer

- Se activa a `≤900px` de ancho.
- Ancho: `min(288px, calc(100vw - 24px))`.
- Es modal para teclado, con backdrop discreto, focus trap, Escape y
  restauración. El canvas no cambia de dueño de scroll.

#### Header contextual

- Altura base: `44px`; compacto `40px`.
- Contiene únicamente proyecto/contexto, estado de sesión y acciones que
  operan sobre la vista.
- La banda multibase de Procesamiento es toolbar contextual, no navegación de
  shell.
- Superficie sólida Hielo/Papel con hairline; sin papel cuadriculado, orbes,
  gradientes apilados ni blur duplicado.

### Navegación y semántica

- Módulo = selector de contexto en la zona superior + destino en el Home.
- Sección = categoría del sidebar; no usa número salvo progreso real.
- Pestaña = link con icono + label dentro de la sección activa.
- Tabs ARIA se reservan a paneles locales sin navegación.
- Estructura base: `aside > nav > section > ul > li > a`.
- Política de foco: tras navegación por sidebar se mantiene el foco en el link
  activado; el título de ventana y `aria-current` anuncian el nuevo contexto.
- En colapsado, flechas recorren el flyout cuando adopta semántica de widget;
  una lista simple conserva navegación nativa por Tab.

### Economía del chrome

- Material solo en sidebar, flyouts, popovers y command surfaces.
- Formularios, tablas, cards de dato y editores usan superficies sólidas.
- No hay franja H1 visible por defecto; el H1 accesible puede ser `sr-only`.
- No hay segunda barra para repetir la jerarquía del sidebar.
- Una vista poblada muestra datos reales en el primer viewport.
- El espacio vacío pertenece a una región y conserva su geometría.

### Tokens v3

Los nombres se codificarán en `branding/identity.json` después del gate y se
compilarán antes de entrar a `theme.css`.

```text
Espaciado
--space-1: 4px  …  --space-8: 32px

Tipografía
--pulso-type-display
--pulso-type-title
--pulso-type-section
--pulso-type-body
--pulso-type-note
--pulso-type-caption
--pulso-type-micro
--pulso-tracking-micro: .06em

Capas
--z-toolbar: 1000
--z-flyout: 1400
--z-modal: 1500
--z-boot: 1600

Navegación
--sidebar-width: 224px
--sidebar-collapsed-width: 56px
--nav-item-height: 36px
--subnav-item-height: 34px
--active-rail-width: 3px
--sidebar-icon-size: 18px
```

Los aliases operativos finales usarán namespace `--pulso-*`; la compilación
externa usa `--prosecnur-*`. No se agregan hex a CSS de features.

### Patrones maestros v3

#### Se retiran como navegación primaria

1. Pillbar centrado de secciones.
2. Rail icon-only de tercer nivel en estado expandido.
3. ModuleSwitcher icon-only en el header.
4. Overlays artesanales sin focus trap.
5. Fondos decorativos y gradientes apilados en el shell.

#### Sobreviven refinados

1. KPI discreto 21/900 con hairline de acento.
2. Switch maestro 44×24.
3. Procedencia y herencia por barra lateral semántica.
4. Burbuja de ayuda para estado colapsado, con hover y foco.
5. Física Pulso y firma de arranque del isotipo.
6. PageFrame y No Scroll Jail.
7. Espectro modular aplicado solo al chrome.

#### Se incorporan

1. `AppSidebar`, `SidebarSection` y `SidebarTab`.
2. `PulsoButton`.
3. `PulsoDialog` y `PulsoPopover` sobre Radix.
4. `StageStepper` para secuencias reales dentro del canvas.
5. Empty state y spinner únicos.

### Motion

- Press `120ms`, fast `160ms`, base `220ms`, panel `280ms`, slow `420ms`.
- Sidebar expandir/colapsar: `220ms`, easing drawer.
- Flyout: `160ms`, easing de salida, opacity + x de 6px.
- Drawer: `280ms`, easing drawer.
- Navegación por teclado no espera animación.
- `prefers-reduced-motion` elimina desplazamiento y reduce la transición a
  cambio de estado inmediato.

### Color

- Se conserva la paleta v1.2 y el espectro de ocho módulos.
- Sidebar y header son 60/30: superficies frías y navy estructural.
- El 10% de acento aparece en selección, foco contextual e icono de módulo.
- Éxito, alerta, peligro e info no cambian con el módulo.
- Datos secuenciales: `#DBE8FF → #7AA2F8 → #2457D6 → #002457`.
- Una personalización de entregable puede reemplazar la paleta del artefacto,
  pero el default siempre es Pulso.

### Voz

- Secciones y tabs se guardan en sentence case; las mayúsculas son CSS.
- Acciones: verbo + objeto.
- Labels de dominio en español peruano neutro.
- Hashes e IDs largos se truncan visualmente con copia explícita.
- No se exponen `snake_case`, headers de origen en inglés ni pluralizaciones
  mecánicas cuando existe una voz de superficie.

### Tema oscuro

No se promete en el freeze inicial de la v3. Se decide después de reducir los
hex de features por debajo del umbral del plan. El shell debe usar roles
semánticos desde el inicio para no bloquearlo, pero un tema oscuro incompleto
no se presenta como feature.

## Pruebas representativas antes del freeze

1. Home con ocho módulos, menú destructivo y picker.
2. Procesamiento/Analítica con doce destinos en ventana de 600px de alto.
3. Monitoreo con cuatro perfiles y labels largos.
4. Muestra/Hojas con steppers reales dentro del canvas.
5. Dashboard con paleta secuencial Pulso.
6. Vacío, carga, error y recuperación sin colapsar regiones.
7. Sidebar 224/56/drawer con teclado, Escape y foco restaurado.
8. Viewports 1440×1000, 1280×800, 1100×600 y 900×800.
9. Windows con Segoe UI, peso 600 y DPI 125–150%.
10. `prefers-reduced-motion`.

## Gate humano pendiente

La dirección recomendada es **A · Instrumento sereno**.

Antes de escribir el shell v3 se requiere una respuesta humana explícita que:

1. seleccione A, B, C o indique un híbrido deliberado;
2. apruebe o ajuste las medidas 224/56/44 y el drawer de 288px;
3. confirme que el tema oscuro permanece diferido;
4. autorice promover `branding/identity.json` de v1.2 frozen a v3 propuesta,
   validarla, congelarla y compilar sus derivados.

El silencio no constituye aprobación.
