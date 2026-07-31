# Plan continuo de armonía y espaciado

**Fecha de inicio:** 30 de julio de 2026  
**Estado:** activo, dirigido  
**Owner:** `govern-visual-harmony`  
**Identidad de referencia:** `branding/identity.json` v1.3.0 (`frozen`)  
**Contrato:** Prosecnur Harmony Contract v0.1.0  

## Propósito

Convertir el espaciado de Prosecnur en un sistema legible y verificable, no en
una colección de ajustes locales. El resultado buscado es una app de escritorio
densa pero serena: bordes alineados, relaciones claras por proximidad, marcos
estables, datos visibles pronto y ningún vacío exterior sin dueño.

Este plan opera como un loop continuo:

```text
medir → elegir una divergencia causal → cambiar una superficie pequeña
      → verificar el mismo caso y un vecino → registrar → volver a medir
```

Cada iteración sí tiene una stopping rule observable. El objetivo general
permanece abierto y reinicia el ciclo después de cada gate hasta que el usuario
indique explícitamente detenerlo.

## Baseline recuperado

- Fuente canónica: `foundations.spacing` de `branding/identity.json`.
- Escala: base 4; pasos `4, 8, 12, 16, 20, 24, 32, 40, 48px`.
- Runtime inicial: sin familia global `--pulso-space-*`.
- CSS del frontend: 99 hojas; 95 contienen al menos un literal de box model.
- Censo estático conservador: 14.462 declaraciones literales de
  `margin/padding/gap`; 33,4% de los valores `px` muestreados caen en la escala
  nominal. El resto es mezcla de deriva, tamaños, radios y excepciones ópticas;
  no se redondea automáticamente.
- Multiplicadores principales: `PageFrame`, `Panel`, `PulsoButton`, `States`,
  `GlidingTabList`, `ModuleCommandBar` y `ContextTabRail`.
- Baseline visual: 18/18 combinaciones válidas en 9 rutas y `1440×1000` /
  `1024×600`; 0 errores API/consola/recursos, 0 overflow global y 0 scroll
  jails. La deuda comprobada es contractual: 14/18 celdas acumulan 22
  colecciones candidatas sin C1. En Hojas de ruta a 1024 el wordmark aparece
  completo y el reporte registra `issues=[]`; el title-strip compacta métricas
  secundarias, pero esa evidencia no demuestra clipping.
- Baseline técnico ajeno al eje: el typecheck parte rojo en
  `monitoreo/fuentes/ConectarFuente.tsx`; la suite parte con dos fallos de
  contrato de Fichas QR. No se corrigen dentro de este plan.

El scanner global `scan-spacing.mjs` reconoce `--space-*`, mientras la app debe
usar `--pulso-space-*` y el compilado externo usa `--prosecnur-space-*`.
Por eso todo censo automatizado pasa por un adaptador temporal de namespace y
publica por separado proporción, tokenización y excepciones; nunca convierte un
porcentaje crudo en veredicto.

## Harmony Contract v0.1.0

### 1. Retícula

| Elemento | Contrato recuperado | Regla |
|---|---:|---|
| Unidad base | 4px | Toda separación ordinaria usa la escala nominal. |
| Módulo de referencia | 72px | Sirve para comprobar ritmo mayor; no es padding ordinario. |
| Header global | 58px | Altura fija del shell. |
| Command bar | 52px | Una fila; nunca crece por wrapping. |
| Rail contextual | 240px | Rail expandido de inventario/master-detail. |
| Rail comprimido | 56px | Rail de pestañas, siempre dentro del flujo. |
| Fila de rail | 32/40px | Densa/normal; 24px solo en régimen denso declarado. |
| Breakpoints | 1320w, 900w, 720h, 700h | La compactación preserva el eje y un dueño de scroll. |

Los bloques de contenido resuelven sus bordes a un conjunto pequeño de rails.
Una desviación de contenido mayor a 1px exige explicación; los marcos de un
grupo `equal` toleran como máximo 2px entre miembros en el mismo viewport.

### 2. Escala y roles

| Token operativo | Valor | Uso dirigido |
|---|---:|---|
| `--pulso-space-1` | 4px | micro-gap, inset óptico tokenizable |
| `--pulso-space-2` | 8px | icono-texto, label-valor, grupo compacto |
| `--pulso-space-3` | 12px | fila, grupo de controles, header interno |
| `--pulso-space-4` | 16px | padding de card, gutter ordinario |
| `--pulso-space-5` | 20px | card cómoda, borde de documento corto |
| `--pulso-space-6` | 24px | panel y separación de grupo mayor |
| `--pulso-space-7` | 32px | sección a sección |
| `--pulso-space-8` | 40px | región mayor y empty state de panel |
| `--pulso-space-9` | 48px | pausa de página excepcional |

Reglas:

1. Un valor que ya coincide con la escala se tokeniza antes de cambiarlo.
2. Un literal fuera de escala no se redondea por cercanía: primero se clasifica
   como `magic`, excepción óptica, tamaño, radio o pin de regresión.
3. Los roles semánticos se construyen sobre estos pasos; no nace una segunda
   escala por módulo.
4. Excepciones gobernadas: `0`, hairlines `1/2px`, módulo 72px, mínimos de
   accesibilidad y compensaciones ópticas con owner y prueba.

### 3. Composición

- **Alineación:** contenido sobre rails compartidos; tolerancia 1px.
- **Proximidad:** gap entre grupos / gap dentro del grupo ≥ 1,5.
- **Repetición:** una variante tiene un solo padding, radio y ritmo interno.
- **Jerarquía:** el espacio acompaña el orden tipográfico; no lo contradice.
- **Balance:** la capacidad libre vive dentro de una superficie visible; fuera
  de ella es deriva hasta demostrar un owner.
- **Gestalt:** espacio y alineación agrupan; no se compensa un ritmo débil con
  cajas anidadas.
- **Disciplina suiza:** eje de lectura fuerte, asimetría balanceada y datos por
  delante del ornamento.

### 4. Catálogo y recetas

| Familia | Padding/gap dirigido | Capacidad | Overflow |
|---|---|---|---|
| Shell / command bar | tokens de chrome existentes; internos sobre escala | bounded | rail horizontal o menú |
| PageFrame document | ritmo de página y secciones intrínsecas | intrinsic | `scrollOwner=page/body` |
| PageFrame workbench | chrome fijo, cuerpo flexible | minmax | un panel declarado |
| Panel / card | padding de superficie + gap interno menor | intrinsic o grupo declarado | descendiente de datos |
| Fila/lista | gap compacto, alto estable por variante | bounded | lista/tabla |
| Control | alto semántico existente; gap tokenizado | bounded | no aplica |
| Estado vacío | misma caja de su variante | bounded | no aplica |
| Popover/dialog/inspector | padding de overlay; acciones separadas del cuerpo | bounded | cuerpo del overlay |
| Tabla/canvas | chrome compacto, máxima área útil | minmax | tabla/canvas declarado |

C1 no se declara globalmente en `Panel` o `PageFrame`: `equal` frente a
`intrinsic` pertenece al wrapper real de cada consumidor. Cada loop visual
materializa `data-qa-geometry-*` en la colección que modifica antes de pedir un
gate C1–C4.

### 5. Capacidad

Para cada grupo par o repetido se registra:

```text
grupo · miembros · ejes gobernados · tolerancia · intrinsic|minmax|bounded
estado 0/1/pocos/muchos · marco exterior · región de contenido
dueño de overflow · gap exterior · alcance primero/medio/último
```

- C2: el marco no deriva de `items.length`.
- C3: el vacío interior puede ser reserva; el vacío exterior exige dueño.
- C4: todo exceso llega al último elemento con un solo recorrido de scroll.
- C5: los vacíos se clasifican como legítimos, deuda de fixture o desconexión;
  este plan no inventa datos ni copy para llenar espacio.

## Builder briefs

### Identidad y tokens

- **Keep:** escala congelada 4–48 y todos sus valores.
- **Add operativo:** aliases `--pulso-space-base` y `--pulso-space-1..9`.
- **No change:** `identity.json`, outputs generados y valores del chrome.
- **Audit hook:** Vitest compara base, cantidad, nombres y valores con el JSON
  canónico; `sync-agentic-os --audit` gobierna el crecimiento de `tokens.css`.

### Implementación React/CSS

1. Tokenizar primero los valores ya equivalentes; esa vuelta es pixel-neutra.
2. Cambiar proporciones solo en una familia de superficies por iteración.
3. Probar el caso causal y al menos un consumidor vecino.
4. No tocar dos dueños de scroll ni dos regímenes responsive a ciegas.
5. Conservar paleta, navegación, semántica, persistencia y lógica de dominio.
6. No introducir un literal que reproduzca un token disponible.

## Oleadas pausadas

### Loop 0 — Fundación

Publicar aliases operativos, test de paridad, ownership y baseline. Pixel-neutro.

### Loop 1 — Shell, chrome y title-strip

Declarar primero los grupos de geometría del chrome compartido y comprobar que
la compactación del title-strip de Hojas de ruta a 1024 es intencional y
alcanzable. La readiness persistente del mapa se diagnostica aparte; no se
disfraza como un problema de spacing. Después se repiten las 18 celdas y se
preserva el scroll alcanzable de Procesamiento.

### Loop 2 — Kit compartido

Tokenizar sin delta `PageFrame`, `Panel` y `PulsoButton`; después medir y ajustar
un solo rol a la vez. `States` va en una iteración separada por sus 66
consumidores.

### Loop 3 — Familias de alta deriva

Orden inicial por concentración y riesgo:

1. Gráficos y Procesamiento.
2. Monitoreo por perfiles, sin mezclar modos en un mismo cambio.
3. Formularios, Hojas de ruta y Cálculo de muestra.
4. Bitácora, Fichas QR, Dashboard y Enciclopedia.
5. Home y Boot, cuando sus cambios ajenos actuales hayan cerrado.

### Loop 4 — Reauditoría transversal

Repetir censo, matriz visual y cobertura de los diez principios. El siguiente
loop nace del primer hallazgo causal restante, no del archivo con más líneas.

## Matriz visual

| Familia | Proyecto | Estados mínimos |
|---|---|---|
| Procesamiento | `acnur_acg` | poblado, etiqueta larga, scroll inicio/final |
| Dashboard | `acnur_pdm` | poblado, repeat, vacío honesto |
| Monitoreo acreditación | `acrconta` | multiactor, baja/alta cardinalidad |
| Cálculo de muestra | `hsvg2026` | marco real, 29 mil estudiantes |
| Shell/compartidos | mismos proyectos | warm start frío e hidratado |

Viewports de gate: `1710×1107`, `1440×1000`, `1366×768`, `1280×720` y
`1024×600`. Cada cambio visual compara al menos 1440×1000 y 1024×600 antes de
ampliar la matriz.

## Contrato de iteración

```text
Iteration N
- Failure or bottleneck:
- Geometry group and C1 contract:
- Focused change:
- Files changed:
- Validation command:
- Visual evidence (route/project/viewport/state):
- Result: better | worse | same
- Neighbor guard:
- Next action:
```

Una iteración se rechaza si empeora otro viewport, crea un segundo scroll,
traslada el vacío fuera de su superficie o necesita tocar un archivo excluido.
Tres iteraciones sin mejora bloquean esa línea y obligan a volver al contrato.

## Métricas del loop

- Adherencia proporcional de spacing: tendencia ascendente; objetivo ≥95% en
  superficies migradas, no como promedio que esconda módulos sin medir.
- Tokenización: ≥90% en cada superficie migrada.
- Proximidad: ratio ≥1,5 en grupos auditados.
- Frame delta: ≤2px por eje gobernado y viewport.
- Exterior voids: 0 sin explicación.
- Overflow reachability: 100% de primero/medio/último.
- C1: cero colecciones candidatas no declaradas dentro del alcance auditado.

## Registro inicial

### Iteration 0 — diagnóstico

- Failure or bottleneck: identidad con escala congelada, runtime sin aliases.
- Focused change: recuperar contrato, baseline estático y visual.
- Files changed: ninguno.
- Validation: validador de identidad, censo estático, typecheck y Vitest base.
- Result: mejor; causa contractual localizada.
- Next action: Loop 0, puente operativo pixel-neutro.

### Iteration 1 — puente operativo

- Failure or bottleneck: CSS de producto no puede consumir la escala canónica.
- Focused change: aliases 1:1 + test de paridad + baseline congelado.
- Geometry group: no aplica; no cambia markup ni geometría renderizada.
- Validation: identidad `VALID`; Vitest focalizado `5/5`; diff check limpio;
  auditoría agentic OS sin crecimiento de `tokens.css`.
- Baseline ajeno conservado: typecheck mantiene solo los dos `TS2367` de
  `ConectarFuente.tsx`; la auditoría conserva tres crecimientos ajenos ya
  presentes en Monitoreo.
- Result: mismo píxel, mejor gobierno.
- Next action: Loop 1, cobertura C1 del chrome y ritmo compartido del
  title-strip, sin asumir clipping.

### Iteration 2 — semántica del command bar

- Failure or bottleneck: las tres zonas de `ModuleCommandBar` aparecían como
  colección C1 no declarada aunque el contrato excluye toolbars y el propio
  componente documentaba esa intención; la raíz emitía `role="group"`.
- Geometry group and C1 contract: no se inventa un grupo; la banda interactiva
  declara su semántica real `role="toolbar"`, conserva `aria-label` y una fila.
- Focused change: corregir el rol accesible y fijarlo con un contrato Vitest.
- Files changed: `ModuleCommandBar.tsx` y
  `ModuleCommandBarGeometrySemantics.test.ts`.
- Validation: Vitest focalizado `13/13`; pruebas del runner geométrico `5/5`;
  `sync-agentic-os --check` y diff check verdes. Typecheck y auditoría conservan
  únicamente los fallos ajenos registrados en la Iteration 1.
- Visual evidence: `acnur_acg`, seis rutas, `1440×1000` y `1024×600`, 12/12
  capturas válidas. Omisiones C1 `18 → 14`; los cuatro falsos candidatos de
  command bar desaparecen. Los 12 `layoutRects` son idénticos antes/después;
  0 overflow global, 0 scroll jails y 0 errores API/página/recursos.
- Neighbor guard: el scroll interno alcanzable de Procesamiento a 1024 se
  conserva en `950×451`, `scrollHeight=751`.
- Result: mejor gobierno, mismo píxel.
- Next action: Loop 2, tokenización sin delta del kit compartido.

### Iteration 3 — adopción del kit compartido

- Failure or bottleneck: `PageFrame`, `Panel` y `PulsoButton` repetían como
  literales valores ya ratificados por la escala operativa.
- Geometry group and C1 contract: no aplica; no cambia markup, cardinalidad ni
  valores computados.
- Focused change: 12 sustituciones exactas: `8px → --pulso-space-2`,
  `12px → --pulso-space-3` y `16px → --pulso-space-4`. Los valores
  `5/6/9/10/14/18px` permanecen intactos.
- Files changed: `theme.css` y
  `sharedSpacingAdoption.contract.test.ts`.
- Validation: cinco archivos Vitest, `33/33`; el oráculo compara propiedad y
  valor exactos y cubre tres falsos positivos por prefijo; diff check limpio; `theme.css`
  conserva exactamente 30.216 líneas, igual a su baseline congelado.
- Visual evidence: post-check sobre las mismas 12 celdas de `acnur_acg`; los
  12 `layoutRects` son idénticos a la Iteration 2, con 0 overflow global,
  0 scroll jails y 0 errores API/página/recursos. Las 14 omisiones C1 ajenas al
  cambio permanecen estables.
- Result: 12 consumos operativos nuevos, mismo píxel.
- Next action: continuar la tokenización por chrome compartido antes de cambiar
  proporciones.

### Iteration 4 — chrome y rail contextual

- Failure or bottleneck: las recetas base y compactas del chrome repetían
  valores 4/8/12px ya disponibles, incluidos dos overrides por viewport y dos
  por densidad explícita.
- Geometry group and C1 contract: no cambia; esta vuelta es numéricamente 1:1.
- Focused change: 14 referencias nuevas a `--pulso-space-1/2/3` en
  `theme.css`, `chrome.css` y `ContextTabRail.css`; se preservan 2/6/10/18px.
- Validation: seis archivos Vitest, `50/50`; diff check limpio; los tres CSS
  conservan sus conteos de 30.216, 206 y 302 líneas.
- Visual evidence: 12/12 celdas de `acnur_acg` comparadas contra la Iteration 3;
  todos los `layoutRects` son idénticos, C1 permanece 14, y no aparece overflow,
  jail ni error nuevo.
- Result: mejor tokenización, mismo píxel en régimen ancho y compacto.
- Next action: migrar el primitivo `States` en una iteración propia por sus 66
  consumidores.

### Iteration 5 — EmptyState compartido

- Failure or bottleneck: la variante panel del estado vacío repetía cuatro
  valores canónicos pese a ser el primitivo con mayor alcance de importación.
- Focused change: `gap 8`, `padding 40/20` y `margin-top 4` pasan a
  `space-2/8/5/1`; Loading, Error e inline quedan intactos.
- Files changed: `states.css` y el contrato compartido.
- Validation: seis archivos Vitest, `53/53`; `states.css` conserva 205 líneas;
  propiedad y valor se comparan exactamente.
- Visual evidence: las 12 celdas vecinas de `acnur_acg` conservan todos sus
  `layoutRects`, 14 omisiones C1 estables y 0 overflow global/jails/errores. La
  equivalencia del estado panel se fija por contrato; el fixture no garantiza
  que esa variante esté visible en cada captura.
- Result: cuatro referencias canónicas nuevas sin delta numérico.
- Next action: `GlidingTabList`, otro multiplicador compartido, en scope propio.

### Iteration 6 — GlidingTabList y pillbars compartidas

- Failure or bottleneck: el switcher hermano y la pillbar de fase repetían tres
  valores canónicos dentro de recetas compartidas de navegación deslizante.
- Scope lock: solo `theme.css`, el contrato de adopción y esta bitácora; quedan
  fuera `GlidingTabList.tsx`, medición, movimiento, alturas, radios y los ritmos
  ópticos de 2/7/13px.
- Focused change: el padding horizontal de opción `8`, el gap de puntos `4` y
  el mínimo del `clamp()` de la pill `8` consumen `space-2/1/2` sin cambiar su
  valor computado.
- Validation: seis archivos Vitest, `61/61`; diff check limpio;
  `theme.css` conserva exactamente 30.216 líneas.
- Visual evidence: 12/12 celdas de `acnur_acg` repetidas en seis rutas a
  `1440×1000` y `1024×600`; todos los `layoutRects` son idénticos a la
  Iteration 5. Permanecen 14 omisiones C1, 0 overflow global, 0 scroll jails y
  0 errores API/página/recursos. El único aviso es el scroll vertical
  alcanzable y preexistente de Procesamiento a 1024 (`950×451`, contenido
  `751`). La inspección ocular de cuatro capturas representativas no encuentra
  clipping, solapes ni pérdida de jerarquía.
- Result: tres referencias canónicas nuevas y mismo píxel.
- Next action: re-auditar el siguiente multiplicador compartido antes de abrir
  una corrección geométrica de módulo.

### Iteration 7 — identidad repeat transversal

- Discovery wave: dos carriles de solo lectura. El censo estático priorizó
  `RepeatBadge`/`RepeatGrainNote` por sus ocho consumidores en Carga,
  Procesamiento, Validación, Analítica y Editor. El carril geométrico deduplicó
  las 14 omisiones del Loop 6: una sola firma accionable
  (`.pulso-focus-quicklook-grid`, 2 ocurrencias), cuatro firmas excluidas por
  ser chrome/estado/control (8 ocurrencias) y dos avisos de ruta sin grupo
  medido (4 ocurrencias).
- Scope lock: solo `repeat-identity.css`, el contrato compartido y esta
  bitácora. La firma C1 real queda reservada para el Loop 8; TSX, overlays y
  valores ópticos permanecen fuera.
- Focused change: el gap compacto `4` y el padding horizontal de grano `12`
  consumen `space-1/3`. Se preservan literalmente `1/2/3/5/6/7/9/10px`.
- Validation: siete archivos Vitest, `78/78`; diff check limpio;
  `repeat-identity.css` conserva exactamente 93 líneas y `theme.css`, 30.216.
- Visual evidence: ocho celdas sobre cuatro rutas consumidoras a `1440×1000`
  y `1024×600`. Las cuatro celdas comparables de Editor y Procesamiento tienen
  `layoutRects` idénticos al Loop 6. Validación y Analítica añaden cuatro
  celdas nuevas sin clipping, overflow global, scroll jails ni errores. El
  aviso vertical alcanzable de Procesamiento a 1024 permanece idéntico. Las 32
  omisiones C1 de la muestra ampliada son cobertura pendiente, no un delta de
  spacing ni una regresión geométrica (`geometryIssues=0`).
- Result: dos referencias canónicas nuevas en una identidad compartida por
  cuatro áreas funcionales, sin delta numérico.
- Next action: Loop 8, materializar y medir el único grupo C1 real del editor
  antes de considerar cualquier ajuste de tamaño.

### Iteration 8 — prueba falsable del quicklook C1

- Hypothesis: las cuatro tarjetas de `.pulso-focus-quicklook-grid` podían
  declararse `equal` sin cambio de layout.
- Baseline command: medición CLI `equal::.pulso-focus-quicklook-grid`, tolerancia
  2px, sobre `/editor-xlsform` a `1440×1000` y `1024×600`, antes de tocar markup.
- Evidence: a 1440 los cuatro miembros miden `75,59px` de alto (`Δ=0`); a 1024
  miden `61,30 / 61,30 / 75,59 / 75,59px` (`Δ=14,29`). El runner emite un
  `equal-frame-drift`; no hay clipping, overflow global, jail ni errores.
- Diagnosis: el grid de dos columnas usa filas implícitas `auto`; las dos filas
  responden de forma distinta al wrapping del contenido en compacto.
- Stopping rule applied: no se añadió una declaración C1 falsa ni se cambió
  código de producto en esta iteración.
- Result: hipótesis rechazada con una primera divergencia medible.
- Next action: Loop 9, prueba roja independiente y reparación mínima con filas
  flexibles iguales; después declarar C1 y volver a medir ambos viewports.

### Iteration 9 — reparación y declaración del quicklook C1

- Red regression: un autor independiente creó
  `FocusedWorkspaceGeometry.contract.test.ts`; falló primero por ausencia de la
  declaración C1 y de `grid-auto-rows: 1fr`. Al descubrir que `theme.css` está
  congelado, el test se redirigió a la hoja propia del editor y volvió a fallar
  por la regla ausente antes de implementar.
- Scope revision: `theme.css` queda sin crecimiento (30.216 líneas). El cambio
  de layout vive en `xlsform-v2.css`; `FocusedWorkspace.tsx` solo declara
  `xlsform/focus-quicklook` con contrato `equal`.
- Focused change: las filas implícitas del grid pasan de `auto` a `1fr`. No hay
  altura fija, copy de relleno, tipografía reducida ni cambio de contenido.
- Validation: ocho archivos Vitest, `80/80`; pruebas del runner geométrico,
  `5/5`; diff check limpio.
- Visual evidence: el contrato descubierto desde markup mide cuatro miembros de
  `75,59px` en ambos viewports. `heightDelta=0`; `widthDelta≤0,02px`; 0
  geometry issues, clipping, overflow global, scroll jails y errores. En
  compacto la primera fila gana `14,29px`, igualando la segunda; el grupo pasa
  de `143,89` a `158,19px` sin volver inaccesible contenido. Los `layoutRects`
  de la vista permanecen estables.
- C1 result: frente al Loop 6 sin selector CLI, las omisiones del Editor bajan
  de 5 a 4 por viewport. El pre-check del Loop 8 ya inyectaba el contrato por
  CLI y, por diseño, también contaba 4; su función es probar el drift y el
  cambio de fuente `cli → markup`, no servir de baseline para ese descenso. Las
  cuatro restantes son toolbar/metadata/form controls ya excluidos por
  contrato.
- Result: una divergencia real reparada y guard permanente materializado.
- Next action: re-auditar las 22 omisiones adicionales observadas en Validación
  y Analítica antes de declarar cualquier grupo nuevo.

### Iteration 10 — clasificación C1 de Validación y Analítica

- Discovery wave: dos carriles de solo lectura clasificaron las 22 omisiones
  añadidas por la muestra ampliada del Loop 7.
- Validación: una firma por viewport, `.pulso-validacion-kpi-grid` con tres
  tarjetas informativas. Es un grupo C1 real, candidato `equal`, pendiente de
  pre-medición con contenido variable.
- Analítica: diez omisiones por viewport deduplicadas en tres firmas. Los chips
  de command bar y las listas de tarjetas de edición quedan excluidos por ser
  chrome/controles. La lista de ocho secciones de revisión es un grupo C1 real
  de contrato `intrinsic`: sus contenidos varían entre 2 y 27 variables.
- Result: dos grupos reales priorizados; no se declararon toolbars ni controles
  para silenciar el detector.
- Next action: Loop 11, medir y materializar primero las secciones intrínsecas
  de Analítica sin tocar su layout; luego abordar los KPI de Validación.

### Iteration 11 — secciones intrínsecas de revisión de datos

- Pre-measurement: `intrinsic::.pulso-data-review-section-list` sobre Analítica
  a `1440×1000` y `1024×600`. Ocho miembros, 2–27 variables, alturas entre
  `311,84` y `3.349,97px`, ancho idéntico, contenido final alcanzable, 1px de
  vacío interior residual y 0 geometry issues/jails.
- Red regression: un test AST independiente localizó el tag exacto y falló por
  ausencia de `data-qa-geometry-group` antes de implementar.
- Focused change: el wrapper declara
  `analitica/data-review-sections` con contrato `intrinsic`; los hijos directos
  siguen siendo miembros implícitos. No cambia CSS, tamaño ni contenido.
- Validation: diez archivos Vitest, `86/86`; diff check limpio.
- Visual evidence: pre y post conservan exactamente los ocho rectángulos, el
  marco del grupo y todos los `layoutRects` en ambos viewports; la fuente pasa
  de `cli` a `markup`. Frente al Loop 7 sin selector temporal, la cobertura baja
  10→9 por viewport y desaparece solo la omisión de
  `.pulso-data-review-section-list`. Capturas ancha y compacta sin clipping,
  solapes, overflow global, scroll jails ni errores.
- Result: guard C1 permanente y pixel-neutral para secciones con capacidad
  intrínseca legítima.
- Next action: Loop 12, pre-medir el grupo KPI de Validación como `equal` antes
  de declarar o corregir su geometría.

### Iteration 12 — KPI pares de Validación

- Pre-measurement: `equal::.pulso-validacion-kpi-grid` sobre Validación a
  `1440×1000` y `1024×600`. Los tres miembros miden respectivamente
  `324×160px` y `204×109,19px`; `heightDelta=0`, `widthDelta=0`, contenido final
  alineado y 1px residual interior. El reporte completo queda `ok=true`.
- Red regression: un test AST independiente encontró el wrapper exacto y falló
  por ambos atributos ausentes antes de implementar.
- Focused change: `ExplorarTab.tsx` declara `validacion/explorar-kpis` con
  contrato `equal`; `PlotlyView`, cards y CSS permanecen intactos.
- Validation: once archivos Vitest, `87/87`; diff check limpio.
- Visual evidence: pre y post conservan el grupo, los seis rectángulos de
  miembro y todos los `layoutRects` exactamente. La fuente cambia de `cli` a
  `markup`; 0 misses, geometry issues, clipping, overflow global, scroll jails
  y errores en ambas capturas. La fila y el chart inferior mantienen jerarquía
  y separación.
- Result: Validación pasa de una omisión C1 por viewport a cobertura completa
  en el estado medido, sin delta visual.
- Next action: re-auditar las nueve firmas restantes de Analítica con prioridad
  en superficies no interactivas; chrome y controles siguen excluidos.

### Iteration 13 — semántica de la toolbar de revisión

- Re-audit: las nueve omisiones restantes de Analítica por viewport se reducen
  a dos firmas. Ocho son `.pulso-data-review-variable-list`, colecciones de
  cards que agrupan checkbox, input, restauración y disclosure; quedan
  excluidas como controles. La novena es `.pulso-data-review-command`, una
  barra real de chips de estado y dos botones.
- Red regression: el test AST de `DataReviewPane` se amplió y falló por ausencia
  de `role="toolbar"` en el tag exacto.
- Focused change: la barra declara `role="toolbar"` y
  `aria-label="Comandos de revisión de datos"`; no cambia chips, botones, CSS ni
  layout.
- Validation: once archivos Vitest, `88/88`; diff check limpio.
- Visual evidence: frente al Loop 11, geometría auditada y `layoutRects` son
  idénticos en ambos viewports. La cobertura baja 9→8; desaparece únicamente
  `pulso-data-review-command`. Permanecen solo las ocho listas de controles; 0
  geometry issues, clipping, overflow global, scroll jails y errores.
- Result: semántica accesible más fiel y un falso candidato C1 eliminado sin
  declarar geometría ficticia.
- Next action: volver al censo de multiplicadores compartidos; `Toaster` es el
  siguiente candidato pixel-neutral y requiere un loop de overlays propio.

### Iteration 14 — ritmo del Toaster global

- Visible baseline: Bitácora ejecuta “Exportar mapa” en ambos viewports y el
  runner exige `.pulso-toast`; el toast real “Mapa exportado” aparece pre/post,
  con `postClickWaitSelectorMatched=true` y reporte `ok=true`.
- Scope lock: solo `toaster.css`, contrato acumulado y bitácora. Posición,
  z-index, animación, colores, duración, copy y padding vertical óptico de 11px
  quedan fuera.
- Focused change: gap del host `8`, gap del deck `8` y padding horizontal `12`
  consumen `space-2/2/3`; no cambia ningún valor computado.
- Validation: doce archivos Vitest, `95/95`; diff check limpio;
  `toaster.css` conserva 169 líneas y `theme.css`, 30.216.
- Visual evidence: pre/post conservan `layoutRects`, 0 misses, issues, overflow,
  jails y errores. La captura compacta es byte a byte idéntica. La ancha no es
  hash-idéntica (`RMSE` normalizado `0,000905`) en presencia de la animación de
  entrada; por ello el hash no se usa como oráculo. La inspección directa no
  encuentra delta de marco, padding, wrapping, posición, clipping ni solape.
- Result: tres referencias canónicas nuevas en un overlay global realmente
  visible, sin delta geométrico observable.
- Next action: re-auditar `BasesInspectorMenu`, tercer multiplicador compartido
  del ranking, en un loop de popover separado.

### Iteration 15 — ritmo del inspector de bases multibase

- Baseline correction: la semilla territorial usada por los loops anteriores
  tiene una sola base y, por contrato, no renderiza `BasesInspectorMenu`. La
  captura válida usa una copia temporal de la semilla canónica
  `procesamiento_02_multibase_compatible`, con tres bases, sobre Validación. El
  runner exige el popover abierto y confirma
  `postClickWaitSelectorMatched=true` en `1440×1000` y `1024×600`.
- Scope lock: solo `bases-inspector.css`, contrato acumulado y bitácora. Quedan
  fuera ancla, ancho, altura, elevación, animación, foco, teclado, márgenes
  negativos y todos los ritmos ópticos `1/2/3/5/6/7/9/10px` no ratificados.
- Focused change: gap de lista `8`, gap de etiqueta `4`, gap del selector `8`
  y padding horizontal seleccionable `4` consumen
  `space-2/1/2/1`; los valores computados permanecen `8/4/8/4px`.
- Validation: trece archivos Vitest, `101/101`; diff check limpio;
  `bases-inspector.css` conserva 319 líneas y `theme.css`, 30.216.
- Visual evidence: pre/post aislados abren el panel real con tres bases; todos
  los reportes quedan `ok=true`, con 0 misses, issues geométricos, overflow,
  scroll jails y errores. En compacto el RMSE normalizado es `0,000194` para
  toda la pantalla y `0,000016` dentro del inspector; con fuzz de 5% el recorte
  tiene 0 píxeles distintos. En ancho, la superficie translúcida hereda pequeñas
  diferencias del contenido subyacente (`RMSE=0,005050` global y `0,013854` en
  el recorte), pero solo 87 de 190.240 píxeles superan fuzz de 10%; la inspección
  directa conserva ancla, marco, filas, wrapping y contenido alcanzable.
- Result: cuatro referencias canónicas nuevas en un popover compartido por
  Chrome, Validación y Codificación, sin deriva geométrica observable.
- Next action: reordenar el censo de primitivas compartidas tras Toaster e
  Inspector y abrir el Loop 16 sobre el siguiente multiplicador pixel-neutral.

### Iteration 16 — gap del PageFrame de Procesamiento

- Discovery wave: el carril estático encontró spacing canónico pendiente en el
  bootstrap, pero el carril visual rechazó `BootGate/warmup`: el estado termina
  antes de que `ui-quick-check` capture y no existe un fixture que lo congele.
  La alternativa reproducible es el override compartido del `PageFrame` de
  Procesamiento, visible en Carga, Validación, Codificación y Analítica.
- Scope lock: solo la regla
  `.pulso-main--processing .pulso-page-frame` en `theme.css`, el contrato
  acumulado y esta bitácora. Quedan fuera toolbar, rail, PageFrame global,
  markup, C1, tamaños, overflow y todo `boot.css`.
- Red regression: el contrato exacto se añadió primero y produjo
  `1 failed | 42 passed` porque la regla todavía declaraba `gap: 8px`.
- Focused change: ese único gap consume `--pulso-space-2`; no cambia su valor
  computado. `theme.css` conserva exactamente 30.216 líneas.
- Validation: trece archivos Vitest, `102/102`; typecheck y diff check verdes;
  sincronización del agentic OS verde.
- Visual evidence: Validación y Analítica, en `1440×1000` y `1024×600`, dan
  cuatro reportes pre/post `ok=true`, selector presente y 0 misses, issues,
  overflow, jails o errores. Todos los `layoutRects` y geometry audits son
  idénticos. Dos capturas son byte-equivalentes; las otras dos tienen RMSE
  normalizado `0,0000375` y `0,0000129`, sin delta perceptible de separación,
  marco, scroll ni jerarquía.
- Result: el ritmo de página de cuatro módulos de Procesamiento queda ligado a
  la escala canónica con una sola referencia nueva y sin declarar C1 ficticio.
- Next action: Loop 17, diseñar un scope visual estable para el bootstrap en
  Home —footer/recientes— antes de introducir el puente de tokens en
  `boot.css`; warmup continúa excluido hasta tener fixture determinista.

### Iteration 17 — puente de spacing del bootstrap Home

- Stable baseline: Home sin proyecto, con API y Vite locales, muestra
  `.boot-recents-head` y `.boot-footer` en `1440×1000` y `1024×600`. El runner
  de rutas no sirve aquí porque exige el puente de navegación de `AppSuite`;
  Playwright captura directamente ambos selectores y registra geometría,
  valores computados, overflow y errores.
- Scope lock: `boot.css`, `bootThemeTokens.contract.test.ts`, contrato acumulado
  y bitácora. Solo se autorizan el puente `space-1..4`, margin inferior de
  recientes `12` y gap del footer `12`. Quedan fuera `BootGate.tsx`, warmup,
  campos/acciones, breakpoints, tamaño, elevación y `theme.css`.
- Red regressions: el contrato de paridad falló por
  `token ausente en boot.css: --pulso-space-1`; el contrato de adopción falló
  en sus dos casos boot (`2 failed | 43 passed`).
- Focused change: el chunk de entrada replica `4/8/12/16px` y los dos valores
  visibles de 12px consumen `--pulso-space-3`. La prueba exige tanto presencia
  como paridad con `tokens.css`, evitando que la duplicación derive.
- Validation: catorce archivos Vitest, `108/108`; typecheck, diff check y
  sincronización del agentic OS verdes. `boot.css` queda en 1.415 líneas;
  `theme.css` conserva 30.216.
- Visual evidence: pre/post conservan exactamente rectángulos de recientes y
  footer, `margin-bottom=12px`, `gap=12px`, 0 overflow y 0 errores. Post expone
  `space-1..4 = 4/8/12/16px`. La captura compacta es byte-idéntica; la ancha
  tiene RMSE normalizado `0,0000124`, sin delta visible de marco, ritmo,
  wrapping o jerarquía.
- Result: el arranque ya comparte una escala comprobada con la suite y adopta
  sus dos primeros consumos en un estado realmente observable.
- Next action: re-auditar Home y primitivas estables ya habilitadas por el
  puente; warmup continúa fuera hasta contar con fixture determinista.

### Iteration 18 — respiración del estado vacío de Home

- Discovery wave: los censos estático y visual coincidieron en un único
  candidato estable dentro de Home: el margen inferior de 4px del icono de
  `.boot-empty`. El resto de valores cercanos pertenecen a controles, tamaño,
  padding óptico o estados sin disparador reproducible y quedan excluidos.
- Scope lock: solo `.boot-empty svg` en `boot.css`, el caso exacto del contrato
  acumulado y esta bitácora. Quedan fuera el `gap: 5px` del contenedor, campos,
  acciones, padding, dimensiones, breakpoints, warmup y todo `theme.css`.
- Red regression: el contrato se añadió antes del cambio y produjo
  `1 failed | 45 passed`, exigiendo literalmente
  `margin-bottom: var(--pulso-space-1)`.
- Focused change: una única declaración sustituye `4px` por `space-1`; el valor
  computado continúa siendo exactamente `4px`. `boot.css` conserva 1.415
  líneas y el contrato acumulado queda en 111.
- Validation: catorce archivos Vitest, `109/109`; typecheck, diff check y
  sincronización del agentic OS verdes. La auditoría conserva solo tres
  crecimientos congelados previos y ajenos en Monitoreo.
- Visual evidence: Home directo en `1440×1000` y `1024×600` registra
  `margin-bottom=4px`, `space-1=4px`, 0 overflow y 0 errores. La geometría de
  recientes, estado vacío, icono y footer se conserva. Frente al post del Loop
  17, el RMSE normalizado es `0,0000858` y `0,0001314`, limitado a ruido de
  render subpíxel; la inspección directa no encuentra desplazamiento, clipping,
  wrapping ni cambio jerárquico.
- Result: el primer ritmo interno del estado vacío del bootstrap queda ligado
  a la escala compartida sin alterar su composición visible.
- Next action: reabrir el censo de superficies compartidas y elegir el siguiente
  multiplicador estable; no tocar warmup ni controles sin fixture determinista.

### Iteration 19 — padding de las cardboxes del Dashboard

- Direction: entre los candidatos censados, `.dashboard-scope .dash-cardbox`
  es el único que ya cuenta con estado real, estable y visible en los dos
  viewports exactos. La primitiva se consume en Resumen, Relaciones, Base de
  datos y Dimensiones; el aviso compartido de Cálculo de muestra queda en el
  backlog hasta ratificar su ruta con evidencia equivalente.
- Scope lock: solo `frontend/src/features/dashboard/theme/tokens.css`, el caso
  exacto del contrato acumulado y esta bitácora. Se autoriza exclusivamente
  `padding: 12px` → `padding: var(--pulso-space-3, 12px)`. Quedan fuera headers,
  gaps, márgenes, gráficos Plotly, markup, tabs, controles, responsive y el
  resto de estilos del Dashboard.
- Main risk: el Dashboard también puede servirse fuera del shell principal;
  por eso el consumo debe conservar fallback local de 12px y la comprobación
  no puede depender del hash global de gráficos dinámicos.
- Minimum validation: regresión literal roja/verde, typecheck, diff check,
  conteo de líneas y captura real de `/tablero` con una copia escribible de la
  referencia canónica en `1440×1000` y `1024×600`.
- Fresh baseline: `/tmp/prosecnur-harmony-loop19/dashboard-cardbox-pre` queda
  `ok=true` en 2/2 capturas, con 0 issues, overflow, scroll jails, errores,
  misses de proyecto o de readiness. Las tres cardboxes de Resumen son visibles
  y la inspección directa no encuentra clipping ni contenido inaccesible.
- Red regression: el caso exacto se añadió antes del producto y produjo
  `1 failed | 46 passed` porque la regla todavía declaraba `padding: 12px`.
- Focused change: una sola declaración consume
  `var(--pulso-space-3, 12px)`; el fallback mantiene el contrato standalone y
  el valor computado continúa siendo 12px. `tokens.css` conserva 2.664 líneas.
- Validation: catorce archivos Vitest, `110/110`; typecheck, diff check y
  sincronización del agentic OS verdes. El contrato acumulado queda en 113
  líneas y `theme.css`/`boot.css` conservan 30.216/1.415.
- Visual evidence: post vuelve a quedar `ok=true` en 2/2, con 0 issues,
  overflow, scroll jails, errores o misses. Los PNG pre/post son byte a byte
  idénticos tanto en `1440×1000` como en `1024×600` (`RMSE=0`), y la inspección
  directa conserva padding, marcos, scroll, wrapping y jerarquía.
- External baseline: la auditoría mantiene `monitoreo_engine.R +6` y
  `router_monitoreo.R +104`; durante el loop el archivo ajeno
  `TelefonicoMonitoreoPage.tsx` pasó de `+135` a `+136`. Ninguno pertenece al
  scope ni fue editado por esta iteración.
- Status: `VERIFYING`; falta únicamente el gate independiente.
- Next action: tras aprobación, re-auditar el Dashboard para una segunda
  adopción solo si sigue siendo pixel-neutral y visible; el aviso de Cálculo de
  muestra permanece diferido hasta disponer de captura con scroll al selector.

## Veredicto de dirección

`DIRECTED`. La escala y la retícula ya están ratificadas; falta adopción. La
implementación avanza desde los multiplicadores compartidos hacia módulos, con
auditoría visual independiente entre oleadas. El contrato no autoriza un
reemplazo masivo ni un redondeo mecánico de literales.
