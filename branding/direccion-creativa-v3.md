# Prosecnur — Dirección creativa v3

Versión vigente 3.1 · julio 2026 (re-editada 2026-07-24 por la indicación 5:
el shell canónico es el chrome horizontal — top bar de secciones + rail de
pestañas — uniformado y pulido; el sidebar unificado quedó revertido, ADR 0042).

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
- La UI v3 **ratifica el concepto del shell vigente** — top bar superior con
  las secciones del módulo y rail icon-compressed con las pestañas — y ordena
  su **uniformidad en los 8 módulos y su pulido macOS-like** (decisión humana
  del 24 de julio de 2026, indicación 5 y ADR 0042, que reemplaza la decisión
  sidebar del día anterior). Los patrones maestros #1–#3 de la v1.2 se
  re-ratifican y refinan.
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
| `ev-v3-guide` | dirección del dueño | `docs/plan-revamp-ui-2026-07-indicacion-5.md` + ADR 0042 | shell canónico horizontal, programa de uniformidad y pulido (la guía-sidebar quedó superseded como histórico) |
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
| Cálculo de muestra | `--pulso-module-sample` | `#7260AE` |
| Formularios | `--pulso-module-editor` | `#7172C1` |
| Hojas de ruta | `--pulso-module-routes` | `#AC563B` |
| Fichas QR | `--pulso-module-collectors` | `#106E8C` |
| Monitoreo | `--pulso-module-monitoring` | `#A0464E` |
| Procesamiento | `--pulso-module-processing` | `#0F766E` |
| Dashboard | `--pulso-module-dashboard` | `#4A6EB6` |

Cada familia conserva además sus roles derivados `-soft` y `-border`. El shell
los consume mediante los aliases contextuales `--module-accent`,
`--module-accent-soft` y `--module-accent-border`; así puede cambiar de módulo
sin reescribir componentes.

**Corrección de legibilidad del 24 de julio de 2026.** Fichas QR pasó de
`#0891B2` a `#106E8C` (decisión `dec-acento-collectors-aa` del manifiesto,
identidad 1.2.1). El valor anterior daba 3.68:1 sobre blanco: suficiente para
superficies de UI, insuficiente para el texto normal de AA, y el acento se
usaba como color de labels de 10 y 11px. El valor nuevo da 5.78:1 y mantiene
ΔE76 de 25.0 contra el teal de Procesamiento, casi los 26.9 del anterior. El
invariante no se reabre: siguen siendo ocho acentos y siguen siendo
distinguibles entre sí; lo que cambió es la legibilidad de uno, no la
estructura del espectro. Un acento nuevo debe cumplir **4.5:1 sobre blanco**
—porque en este sistema los acentos rotulan texto pequeño— y separarse con
holgura de sus vecinos.

**Techo de croma del 25 de julio de 2026.** Los ocho acentos quedan sujetos a
un techo de **0.12 de croma en OKLCH** (decisión `dec-techo-croma-modular`,
identidad 1.3.0). El tono de cada módulo es suyo y no se toca; lo que se
estandariza es cuánta saturación puede gastar. Antes del techo el croma iba de
0.086 —el teal de Procesamiento, que es la referencia— a 0.247 —el violeta de
Cálculo de muestra—, casi el triple, y por eso el mismo elemento se sentía
sobrio en un módulo y estridente en otro; con el techo el rango cae a 1.4×.
Cambiaron cinco: Formularios, Dashboard, Hojas de ruta, Cálculo de muestra y
Monitoreo. Procesamiento (0.086), Fichas QR (0.092) y Bitácora (0.121) ya
estaban en el techo o por debajo y conservan su hex exacto. Un techo más bajo
se probó y se descartó con evidencia: a 0.090 el carmesí de Monitoreo cae en
`#945155`, que ya no se lee como rojo sino como marrón sucio. El croma no se
iguala, se acota. Efecto colateral querido: Monitoreo dejó de coincidir con el
carmesí semántico de peligro, que era una colisión de rol. **Un acento nuevo
debe respetar el techo además del 4.5:1.**

**Roles permitidos:** contexto de módulo, rail y superficie de selección,
icono modular, tintes y bordes de procedencia, y foco contextual cuando el
control pertenece al módulo.

**Roles prohibidos:** contenido o superficies de datos, series de
visualización por defecto, y estados semánticos como éxito, alerta, peligro e
información. Esos roles conservan tokens propios y no cambian al navegar entre
módulos.

## Norte: «La señal ordenada, ahora habitable»

La v1.2 hizo reconocible la marca; la v3 hace habitable el sistema completo.
La señal no vive en gradientes, marcos decorativos ni dialectos por módulo:
vive en la continuidad de la command bar, la selección inequívoca, el acento
modular justo y el dato que aparece antes que el chrome.

La interfaz debe sentirse como un instrumento sereno que permanece estable
mientras el proyecto cambia de módulo, sección y pestaña.

## Territorios considerados

Los tres territorios fueron evaluados originalmente sobre el supuesto del
sidebar (revertido); su relación entre densidad, materialidad, tipografía y
señal modular sigue vigente aplicada al chrome horizontal. Los ejemplos
muestran Procesamiento como un estado del shell, no como una elección
cromática global. El comparador visual vive en
`branding/v3/shell-territories.html` (histórico, anatomía sidebar).

### A · Instrumento sereno — vigente (re-aplicado al chrome horizontal)

**Tesis:** una capa de navegación material, continua y silenciosa sostiene
un canvas sólido donde la información manda.

- Command bar con una sola superficie fría, hairline inferior y material
  simulado únicamente en navegación y flyouts.
- Selección por fondo suave + peso 600 + señal física (rail/gradiente del
  primario); nunca solo por color.
- Header global sin gradiente decorativo ni segunda navegación redundante.
- Densidad media-alta: controles 28/32, iconos 18, tipografía 13/12.5.
- El acento del módulo aparece en la selección, el icono de contexto y
  hairlines; los semánticos conservan su significado.
- La firma reconocible es la **traza contenida**: una línea activa que une
  contexto, sección seleccionada y KPIs sin convertirse en decoración.

Riesgo: si el material de la command bar gana demasiado contraste, vuelve a
competir con el dato. Condición de descarte: el primer viewport parece una
vitrina de navegación.

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

### Anatomía del shell (chrome horizontal canónico — ADR 0042)

```text
┌────────────────────────────────────────────────────────────────────┐
│ Header global: isotipo · dock de módulos (+ label del activo) ·    │
│ proyecto · sesión                                                  │
├────────────────────────────────────────────────────────────────────┤
│ Command bar del módulo:  contexto │ rail de SECCIONES │ acciones   │
├──────┬─────────────────────────────────────────────────────────────┤
│ rail │  Título compacto de la pestaña activa                       │
│ de   │                                                             │
│ pes- │              Superficie de trabajo                          │
│ tañas│        cada región posee su propio scroll                   │
│ (56) │                                                             │
└──────┴─────────────────────────────────────────────────────────────┘
```

#### Header global (identidad)

- Marca (isotipo canónico), dock de módulos icon-only con label visible del
  módulo activo, píldora de proyecto y estado de sesión. Nada más crece ahí.
- Superficie fría con hairline; sin gradientes apilados, sin papel
  cuadriculado, sin blur duplicado.
- Dock: semántica de links (`nav > ul > li > a`), tooltip por hover **y**
  foco, `aria-current="page"`, tile «Agregar» como acción diferenciada y
  estrategia de overflow declarada para catálogos de 9+ módulos.

#### Command bar del módulo (navegación de secciones)

- Tres zonas: contexto (módulo/mesa/perfil) | rail de secciones (pillbar) |
  acciones del módulo. Un solo componente compartido (`ModuleCommandBar`).
- Material translúcido contenido (la única capa con material junto a flyouts
  y popovers); borde teñido por `--module-accent`; altura mínima 46, controles
  de 32.
- Pills de sección: 32–34px, sentence case en datos, numeración SOLO con
  pipeline real (progreso), activo por gradiente del primario + peso + señal
  física — nunca solo color; `aria-current="page"` (links, no tabs ARIA).
- **Overflow con dignidad** (verificado a 1024×600): envolver controles →
  compactar labels → menú. Los chips de estado nunca desaparecen sin
  alternativa.

#### Rail de pestañas (tercer nivel, icon-compressed)

- Siempre comprimido (~56px), empuja el canvas, jamás overlay.
- Cada ítem: `aria-label` con título y detalle; burbuja flotante por hover
  **y** `:focus-visible` (radio 10, material blanco, título + subtítulo);
  Escape cierra.
- **Identificación persistente obligatoria**: título compacto de la pestaña
  activa al inicio del workbench (ícono en tile + título + subtítulo).
- Grupos con separadores visibles cuando hay 7+ destinos; dots de estado con
  leyenda (tooltip y/o badge con dato real). En apilado angosto (<921px) el
  rail vive expandido en flujo.

#### Command surface local (operación)

- Contiene únicamente KPIs, readiness, fase y acciones que operan sobre la
  vista; separada de la navegación (norma navegar/operar/identidad). Puede
  envolver de forma deliberada, pero no oculta estado ni compite con la
  superficie primaria.
- La banda multibase de Procesamiento es toolbar contextual, no navegación de
  shell.
- Superficie sólida Hielo/Papel con hairline; el mapa/canvas cartográfico
  conserva su área útil según las indicaciones 3–4.

### Navegación y semántica

- Módulo = dock del header + cards del Home.
- Sección = pill de la command bar; no usa número salvo progreso real.
- Pestaña = ítem del rail con nombre accesible completo + título compacto
  persistente.
- Tabs ARIA se reservan a paneles locales sin navegación; las rutas usan
  links con `aria-current="page"`.
- Política de foco: tras navegar se mantiene el foco en el control activado;
  el título de ventana y `aria-current` anuncian el nuevo contexto.

### Economía del chrome

- Material solo en command bar, flyouts, popovers y command surfaces.
- Formularios, tablas, cards de dato y editores usan superficies sólidas.
- No hay franja H1 visible por defecto; el H1 accesible puede ser `sr-only`.
- No hay segunda barra que repita la jerarquía de la command bar ni del rail
  (regla: nunca duplicar la navegación de un nivel en otro).
- El header global es delgado y de identidad (marca, dock, proyecto, sesión);
  no acumula acciones ni navegación de sección.
- Una vista poblada muestra datos reales en el primer viewport.
- El espacio vacío pertenece a una región y conserva su geometría.

### Tokens v3

Los nombres se codifican en `branding/identity.json` y se compilan antes de
entrar a `theme.css`; esa promoción es una unidad determinista separada.

```text
Espaciado
--pulso-space-1: 4px  …  --pulso-space-9: 48px

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
--commandbar-min-height: 46px
--commandbar-control-height: 32px
--section-pill-height: 32px
--tab-rail-width: 56px
--nav-item-height: 32px
--active-rail-width: 2px
--nav-icon-size: 18px
```

Los aliases operativos finales usan namespace `--pulso-*`; la compilación
externa usa `--prosecnur-*`. La escala de espaciado mantiene los nueve pasos
congelados en `branding/identity.json`; no se recorta ni se extiende desde CSS.
No se agregan hex a CSS de features.

### Patrones maestros v3

#### Se retiran

1. Overlays artesanales sin focus trap.
2. Fondos decorativos y gradientes apilados en el shell.
3. Implementaciones por-módulo del chrome (pills, toolbars y steppers ad-hoc):
   solo existe el componente compartido.
4. El shell sidebar tras flag (`AppSidebar`/`shellV3`), pendiente de retiro
   con confirmación del dueño (ADR 0042).

#### Sobreviven refinados (re-ratificados por ADR 0042)

1. Command bar de módulo de 3 zonas (patrón #1) — ahora obligatoria en los 8
   módulos.
2. Pillbar de secciones (patrón #2) — numeración solo con pipeline real.
3. Rail icon-compressed de pestañas (patrón #3) — con burbuja hover/foco y
   título compacto persistente obligatorio.
4. KPI discreto 21/900 con hairline de acento.
5. Switch maestro 44×24.
6. Procedencia y herencia por barra lateral semántica.
7. Física Pulso y firma de arranque del isotipo.
8. PageFrame y No Scroll Jail.
9. Espectro modular aplicado solo al chrome.

#### Se incorporan

1. `ModuleCommandBar`, `SectionPillbar` y rail de pestañas como componentes
   únicos compartidos, alimentados por el manifiesto.
2. `PulsoButton`.
3. `PulsoDialog` y `PulsoPopover` sobre Radix.
4. Progreso secuencial como estado del pillbar (numeración, badges, candados)
   o `StageStepper` compartido interno a la sección; nunca ambos a la vez.
5. Empty state y spinner únicos.
6. Gestor de módulos («+») como modal sobre la vista actual.

### Motion

- Press `120ms`, fast `160ms`, base `220ms`, panel `280ms`, slow `420ms`.
- Hover de pill: fill que crece desde el centro (opacity + scaleX .94→1).
- Burbuja del rail / flyouts: `160ms`, easing de salida, opacity + x de 6px.
- Navegación por teclado no espera animación.
- `prefers-reduced-motion` elimina desplazamiento y reduce la transición a
  cambio de estado inmediato.

### Color

- Se conserva la paleta v1.2 y el espectro de ocho módulos definido en
  `ev-v3-module-color`; A/B/C no sustituyen ni uniforman ese espectro.
- Command bar y header son 60/30: superficies frías y navy estructural.
- El 10% de acento cambia con el módulo y aparece solo en contexto, selección,
  icono, tintes/bordes de procedencia y foco contextual.
- Éxito, alerta, peligro e info no cambian con el módulo.
- Datos secuenciales: `#DBE8FF → #7AA2F8 → #2457D6 → #002457`.
- Una personalización de entregable puede reemplazar la paleta del artefacto,
  pero el default siempre es Pulso.

### Composición cartográfica

- El rectángulo sigue a la geografía: Lima se encuadra en vertical o casi
  cuadrado; una superficie grande pero panorámica no cuenta como dominante.
- El mapa es una región continua. Títulos, métricas y explicación se desplazan
  al inspector o se compactan antes de reducir el viewport cartográfico.
- La geometría focal ocupa la altura útil sin deformación; `viewBox`,
  `preserveAspectRatio` y layout se verifican juntos.
- Zoom, leyenda, información y acción principal tienen esquinas o regiones
  propias, sin colisión ni mosaico de popovers.
- La jerarquía es mapa → operación → evidencia → explicación. Se evita tratar
  cada dato como una tarjeta equivalente.

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

1. Home con ocho módulos, menú destructivo y gestor de módulos como modal.
2. Procesamiento/Analítica con doce destinos en el rail agrupado, en ventana
   de 600px de alto.
3. Monitoreo con cuatro perfiles, secciones canónicas y toolbar operativa
   separada, con labels largos.
4. Muestra/Hojas con recorrido y gating como progreso del pillbar y KPIs en
   la command surface sin colisión (fix de la evidencia de la indicación 2).
5. Dashboard con paleta secuencial Pulso y command bar canónica.
6. Vacío, carga, error y recuperación sin colapsar regiones.
7. Command bar con overflow a menú y rail con burbuja: teclado completo,
   Escape y foco restaurado.
8. Viewports 1440×1000, 1361×987, 1280×800, 1100×600, 1024×600 y
   900×800.
9. Windows con Segoe UI, peso 600 y DPI 125–150%.
10. `prefers-reduced-motion`.

## Gobierno por revisión

La dirección ejecutada es **A · Instrumento sereno**, aplicada al chrome
horizontal canónico (ADR 0042): command bar de 3 zonas (mínimo 46, controles
32, pills 32–34), rail de pestañas de 56px con burbuja y título compacto,
header global delgado. La instrucción de ejecutar el plan constituye
aprobación operativa.

Cada iteración entrega evidencia para revisión, corrección o veto del dueño;
no solicita permiso para continuar. Solo el dueño declara el cierre global del
bucle. El tema oscuro permanece diferido según el plan y la promoción
determinista de `branding/identity.json` se valida como una unidad propia.
