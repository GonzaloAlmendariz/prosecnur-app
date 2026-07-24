# Prosecnur — Dirección creativa v3

Versión vigente 3.0 · julio 2026.

Estado: **Vigente y en ejecución por instrucción del dueño**.
Modo de identidad: **evolución**. La marca, el isotipo y los activos congelados
de v1.2 se conservan; esta dirección v3 gobierna desde ahora el shell y la
convergencia visual. El dueño la revisa dentro del bucle y puede corregirla o
vetarla sin que exista un permiso intermedio.

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
- Cada módulo conserva su acento distintivo actual. Cambiar de módulo cambia
  la señal contextual del shell, no los colores semánticos ni la paleta del
  contenido.
- El sistema se completa con roles explícitos de espaciado, tipografía,
  capas, navegación y estados.
- Windows sigue siendo el release bloqueante; macOS define la gramática, no
  una dependencia de plataforma.

### Evidencia que gobierna

| ID | Tipo | Fuente | Decisión que controla |
| --- | --- | --- | --- |
| `ev-v3-index` | precedencia | `docs/plan-revamp-ui-2026-07-INDICE.md` | contrato vigente, arbitrajes y gobierno por revisión |
| `ev-v3-plan` | decisión | `docs/plan-revamp-ui-2026-07.md` | UI v3, fases, loop y reglas duras |
| `ev-v3-guide` | dirección del dueño | `docs/plan-revamp-ui-2026-07-guia-sidebar.md` | geometría 248/64, esquina, scroll, semántica y teclado |
| `ev-v3-baseline` | hecho | baseline visual del 23 de julio de 2026 | divergencia real entre módulos y chrome |
| `ev-v3-brand` | artefacto canónico | `branding/direccion-creativa.md`, ADR 0038 y `branding/logo/` | equity que no cambia |
| `ev-v3-layout` | contrato | `docs/ui-layout-grammar.md` | PageFrame, breakpoints y No Scroll Jail |
| `ev-v3-runtime` | hecho | app real con proyecto canónico | workflows densos, estados y restricciones |
| `ev-v3-module-color` | decisión humana | aclaración del 23 de julio de 2026 + `frontend/src/lib/modules.ts` | conservar los ocho acentos modulares canónicos |

Cuando una regla v1.2 o el plan base contradicen la decisión actual, manda la
precedencia de `ev-v3-index`. La regla reemplazada se conserva como evidencia
histórica y se registra en el ADR del shell; no se borra silenciosamente.

### Decisión humana vigente: espectro modular

La v3 conserva como invariante los ocho acentos distintivos actuales. Este
invariante ya está decidido. La dirección ejecutada es A · Instrumento sereno;
los territorios B y C quedan como alternativas históricas, no como decisiones
pendientes. Ningún territorio elige una paleta modular nueva ni vuelve todos
los módulos navy.

| Módulo | Token canónico actual | Acento |
| --- | --- | --- |
| Bitácora | `--pulso-module-encyclopedia` | `#A16207` |
| Cálculo de muestra | `--pulso-module-sample` | `#7C3AED` |
| Formularios | `--pulso-module-editor` | `#6D5DFC` |
| Hojas de ruta | `--pulso-module-routes` | `#C2410C` |
| Fichas QR | `--pulso-module-collectors` | `#0891B2` |
| Monitoreo | `--pulso-module-monitoring` | `#BE123C` |
| Procesamiento | `--pulso-module-processing` | `#0F766E` |
| Dashboard | `--pulso-module-dashboard` | `#2563EB` |

Cada familia conserva además sus roles derivados `-soft` y `-border`. El shell
los consume mediante los aliases contextuales `--module-accent`,
`--module-accent-soft` y `--module-accent-border`; así puede cambiar de módulo
sin reescribir componentes.

**Roles permitidos:** contexto de módulo, rail y superficie de selección,
icono modular, tintes y bordes de procedencia, y foco contextual cuando el
control pertenece al módulo.

**Roles prohibidos:** contenido o superficies de datos, series de
visualización por defecto, y estados semánticos como éxito, alerta, peligro e
información. Esos roles conservan tokens propios y no cambian al navegar entre
módulos.

## Norte: «La señal ordenada, ahora habitable»

La v1.2 hizo reconocible la marca; la v3 hace habitable el sistema completo.
La señal no vive en gradientes, rails repetidos o marcos decorativos: vive en
la continuidad del sidebar, el rail activo de dos píxeles, el acento modular
justo y el dato que aparece antes que el chrome.

La interfaz debe sentirse como un instrumento sereno que permanece estable
mientras el proyecto cambia de módulo, sección y pestaña.

## Territorios considerados

Los tres territorios respetan el sidebar unificado, la marca, la paleta y la
geometría obligatoria. Cambian la relación entre densidad, materialidad,
tipografía y señal modular. Los ejemplos muestran Procesamiento como un estado
del shell, no como una elección cromática global. El comparador visual vive en
`branding/v3/shell-territories.html`.

### A · Instrumento sereno — vigente

**Tesis:** una columna de navegación material, continua y silenciosa sostiene
un canvas sólido donde la información manda.

- Sidebar con una sola superficie fría, un hairline vertical y material
  simulado únicamente en navegación y flyouts.
- Selección por rail de 2px + fondo suave + peso 600; nunca solo por color.
- Header del sidebar de 52px, sin gradiente decorativo ni segunda navegación.
- Densidad media-alta: filas 28/24, iconos 18, tipografía 13/12.5.
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

**Dirección adoptada:** A · Instrumento sereno. Conserva el ADN de «La señal
ordenada», cumple la guía y reduce la deriva sin convertir la v3 en una marca
nueva.

## Sistema propuesto de «Instrumento sereno»

Esta sección es normativa desde la instrucción de ejecución del dueño.

### Anatomía del shell

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ Marca + contexto     │ Toolbar operativa local opcional            │
│ 248px / 64px         ├──────────────────────────────────────────────┤
│ Archivo · Home       │                                              │
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

- Ancho: `248px`.
- Padding exterior: `8px`.
- Zona superior: header único de `52px` con isotipo squircle de `28px`, módulo
  activo y chevron del switcher; no contiene acciones crecientes.
- Zona central: `flex: 1; min-height: 0; overflow-y: auto`;
  `scrollbar-gutter: stable`.
- Sección: fuente de datos en sentence case; fila de `28px`, texto
  `13px/500`; cualquier mayúscula es solo CSS.
- Subfila: `24px`, indent `28px`, texto `12.5px`; máximo dos niveles.
- Activo: rail físico de `2px`, superficie `--module-accent-soft`, texto
  principal y peso 600; `aria-current="page"`.
- Utilidades: filas normales separadas por hairline; no forman parte del árbol
  de destinos.

#### Sidebar colapsado

- Ancho: `64px`.
- Cada sección conserva icono, nombre accesible y estado activo.
- El flyout se abre por hover **y** foco; puede persistir al mover el puntero o
  foco dentro; Escape lo cierra y restaura el foco.
- El flyout contiene labels completos; nunca depende solo del tooltip.
- No se oculta ningún destino por falta de alto: la zona central scrollea.

#### Contrato anti-deformación

- Solo existen dos anchos persistentes: `248px` y `64px`.
- Ambos estados empujan el lienzo; el sidebar persistente nunca se superpone.
- El flyout transitorio de `240px` es la única superposición de navegación y
  nunca provoca reflow.
- A `1024×600`, el lienzo expandido conserva al menos `712px`.
- Las rutas de canvas total pueden declarar `railMode: "collapsed"` en el
  manifiesto; no usan lógica ad hoc.
- Las secciones cartográficas pueden declarar la misma preferencia: Hojas usa
  rail colapsado al entrar en Territorio y Manzanas, sin crear un tercer ancho.
- Una superficie primaria cartográfica conserva al menos `500×250px` útiles a
  `1024×600` en su rail recomendado, con intersección `0` entre overlays.

#### Chrome global y command surface local

- En workbenches ricos no existe una franja global persistente sobre el
  lienzo: proyecto/archivo, guardado y Home viven en el sidebar.
- Los `52px` corresponden al header del sidebar, no a una fila horizontal que
  reste alto al canvas; la superficie de trabajo comienza en `y=0`.
- La command surface local contiene únicamente KPIs, readiness, fase y
  acciones que operan sobre la vista. Puede envolver de forma deliberada, pero
  no oculta estado ni compite con la superficie primaria.
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
- No hay header horizontal de archivo/Home sobre los workbenches.
- Una vista poblada muestra datos reales en el primer viewport.
- El espacio vacío pertenece a una región y conserva su geometría.

### Tokens v3

Los nombres se codifican en `branding/identity.json` y se compilan antes de
entrar a `theme.css`; esa promoción es una unidad determinista separada.

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
--sidebar-width: 248px
--sidebar-collapsed-width: 64px
--sidebar-header-height: 52px
--nav-item-height: 28px
--subnav-item-height: 24px
--active-rail-width: 2px
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
4. Progreso secuencial en el propio sidebar mediante numeración, badges y
   candados; no se duplica con un stepper en el canvas.
5. Empty state y spinner únicos.

### Motion

- Press `120ms`, fast `160ms`, base `220ms`, panel `280ms`, slow `420ms`.
- Sidebar expandir/colapsar: `180ms`, easing de salida.
- Filas al expandir: stagger discreto de `60ms`.
- Flyout: `160ms`, easing de salida, opacity + x de 6px.
- Navegación por teclado no espera animación.
- `prefers-reduced-motion` elimina desplazamiento y reduce la transición a
  cambio de estado inmediato.

### Color

- Se conserva la paleta v1.2 y el espectro de ocho módulos definido en
  `ev-v3-module-color`; A/B/C no sustituyen ni uniforman ese espectro.
- Sidebar y header son 60/30: superficies frías y navy estructural.
- El 10% de acento cambia con el módulo y aparece solo en contexto, selección,
  icono, tintes/bordes de procedencia y foco contextual.
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

## Pruebas representativas de convergencia

1. Home con ocho módulos, menú destructivo y picker.
2. Procesamiento/Analítica con doce destinos en ventana de 600px de alto.
3. Monitoreo con cuatro perfiles y labels largos.
4. Muestra/Hojas con recorrido, progreso y gating visibles solo en el sidebar.
5. Dashboard con paleta secuencial Pulso.
6. Vacío, carga, error y recuperación sin colapsar regiones.
7. Sidebar 248/64 y flyout con teclado, Escape y foco restaurado.
8. Viewports 1440×1000, 1361×987, 1280×800, 1100×600, 1024×600 y
   900×800.
9. Windows con Segoe UI, peso 600 y DPI 125–150%.
10. `prefers-reduced-motion`.

## Gobierno por revisión

La dirección ejecutada es **A · Instrumento sereno**, con la anatomía
`248/64/52`, filas `28/24`, rail activo de `2px`, flyout de `240px` y sin
drawer. La instrucción de ejecutar el plan constituye aprobación operativa.

Cada iteración entrega evidencia para revisión, corrección o veto del dueño;
no solicita permiso para continuar. Solo el dueño declara el cierre global del
bucle. El tema oscuro permanece diferido según el plan y la promoción
determinista de `branding/identity.json` se valida como una unidad propia.
