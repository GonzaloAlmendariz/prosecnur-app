# Revamp de Carga: arquitectura de pestañas y matriz de ingreso

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-07-25
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Carga y acreditación](../historico/carga-acreditacion-2026-07.md)

Fecha: 2026-07-25

Estado: implementado y validado

## Objetivo

Reordenar `Procesamiento > Carga` sin cambiar los contratos del backend ni la
persistencia `.pulso`. La interfaz debe expresar de forma estable cinco cosas
que hoy aparecen mezcladas: plan del estudio, fuentes, revisión metodológica,
estructura del instrumento y datos resultantes.

Este documento registra el mapa encontrado, la decisión de arquitectura de
información, los límites de la primera implementación y la matriz que debe
probarse antes de declarar paridad.

## Hallazgo central

Los tres rótulos actuales —Manual, Plataforma y Desde Monitoreo— no representan
tres mecanismos simétricos. La vista combina cinco ejes independientes:

1. operación: crear, reemplazar, actualizar o integrar;
2. topología: una base, varias bases, hermanas independientes o base integrada;
3. origen: archivos, conector, corte de Monitoreo o exportación offline;
4. proveedor: SurveyMonkey o Kobo;
5. readiness: instrumento, data, códigos, extras, universo, repeats y base lista.

El resultado es una máquina de estados implícita distribuida entre React,
Zustand y el backend. La solución no es agregar más tarjetas, sino asignar cada
eje a un nivel estable de la jerarquía canónica.

## Contratos que no cambian

- Carga continúa siendo una **sección** de Procesamiento.
- Las nuevas superficies son **pestañas** de esa sección, direccionables con
  `?pestana=` según ADR 0044.
- Una base procesable continúa siendo un par instrumento + data.
- `independent_siblings`, base integrada y repeats conservan sus significados.
- Los repeats son derivados; nunca son una topología elegida por el usuario.
- Acreditación se declara deliberadamente en Monitoreo y se materializa como
  hermanas independientes; no se infiere por nombres ni se convierte en toggle.
- No se modifican endpoints, session state, secretos ni formato `.pulso` en esta
  iteración.

## Arquitectura decidida

La sección Carga adopta cinco pestañas estables:

| Clave | Etiqueta | Responsabilidad | Contenido principal |
|---|---|---|---|
| `plan` | Plan | Declarar la forma del estudio y ver su estado global | una/varias bases, conteo, readiness y siguiente acción |
| `fuentes` | Fuentes | Agregar, importar o actualizar insumos | archivos, SurveyMonkey, Kobo, Monitoreo, BasesPanel |
| `revision` | Revisión | Resolver decisiones metodológicas previas a Validación | códigos, variables extra, universo, compatibilidad |
| `estructura` | Estructura | Inspeccionar el instrumento de la base seleccionada | secciones, preguntas, reglas y selector madre/repeat |
| `datos` | Datos | Inspeccionar la base materializada | tabla, hojas, búsqueda, filtros y exportación |

Las cinco claves son permanentes. Una pestaña sin insumos muestra un estado
pendiente explicativo; no desaparece, porque los deep links y el recorrido de
QA deben ser reproducibles.

### Jerarquía visual

```text
Módulo Procesamiento
└── Sección Carga                      top bar existente
    ├── Plan                           rail contextual
    ├── Fuentes                        rail contextual
    ├── Revisión                       rail contextual
    ├── Estructura                     rail contextual
    └── Datos                          rail contextual
        └── panel/diálogo/inspector    solo para decisiones focales
```

No se agrega una barra de pasos horizontal. El rail contextual existente es la
navegación de pestañas; los selectores de origen y proveedor son controles
locales dentro de `Fuentes`.

## Auditoría visual previa al pulido

La primera implementación resolvió la arquitectura funcional y la navegación,
pero el recorrido con `acrconta` y `acnur_pdm` mostró que las cinco pestañas
todavía no se comportaban como herramientas visualmente distintas:

| Pestaña | Hallazgo | Dirección de pulido |
|---|---|---|
| Plan | La topología y el readiness ocupaban poco contenido y dejaban un lienzo vacío sin explicar la cobertura real de las bases. | Convertirla en tablero de topología y cobertura, con una fila operativa por base cuando exista estudio. |
| Fuentes | La mesa de adquisición ya conservaba todas las operaciones, pero necesitaba quedar reconocible como workbench y no recibir más tarjetas decorativas. | Preservar `BasesPanel` y los orígenes; limitar el cambio a composición y contexto local. |
| Revisión | Repetía el tablero completo de Plan debajo del universo y antes de la siguiente acción. | Usar una banda compacta de decisiones que concentre pendientes, estado y continuación. |
| Estructura | Apilaba el mapa de secciones y el mapa de preguntas en una sola columna extensa. | Convertirla en navegador local excluyente: `Secciones` o `Preguntas`, conservando filtros, reglas y detalle. |
| Datos | La tabla era correctamente data-first, pero una base única repetía su identidad en un selector externo y en el propio visor. | Mostrar selector solo cuando hay dos o más bases; con una base, entrar directamente a la tabla. |

La dirección conserva el rail y el suitebar como anclas estables. La
diferenciación ocurre en la superficie de trabajo, no mediante una nueva capa de
navegación ni mediante cambios de color sin consecuencia conceptual.

## Pulido perceptivo aplicado

- `Plan` usa una superficie propia de topología y cobertura. Cada base materializada
  muestra formulario, respuestas, origen y conteos; el estado vacío conserva la
  topología como **por definir**, con cero bases, hasta que exista una decisión o
  un insumo real.
- `Fuentes` conserva `BasesPanel`, los tres mecanismos y todas sus acciones. La
  composición la identifica como mesa de adquisición sin sumar otra jerarquía de
  tarjetas.
- `Revisión` reemplaza el readiness duplicado por una bandeja compacta. En
  multibase comunica cobertura exacta (`x/y`) y no pinta una cobertura parcial
  como lista. El universo depende de datos confirmados, no de la última pestaña
  visual elegida en Fuentes.
- `Estructura` presenta `Secciones` y `Preguntas` como vistas excluyentes con
  semántica de tabs, indicador compartido y navegación por teclado. En
  1024×600 compacta resumen y leyenda para mostrar preguntas en el primer
  viewport; en viewports amplios conserva el detalle completo.
- `Datos` abre directamente la tabla con una sola base. El selector externo se
  muestra únicamente cuando hay dos o más bases y, por tanto, existe una
  elección real.

## Mapa de capacidades preservado

### Manual

```text
XLSForm local
→ XLSX/CSV/SAV/ZIP
→ normalización y compatibilidad
→ códigos y variables extra
→ universo
→ repeats derivados cuando corresponde
→ inspección
→ Validación
```

El flujo simple y el multibase separado todavía tienen garantías técnicas
distintas. El revamp las hace visibles en una misma arquitectura, pero no
pretende corregir esas diferencias backend en esta iteración.

### Plataforma

| Topología | SurveyMonkey | Kobo |
|---|---|---|
| una base | importación directa | importación directa + repeats |
| separadas | carga manual | carga manual |
| integrada | auditoría y apilado N→1 | no soportado |
| independientes nuevas | flujo completo | sugerencias procedentes de Monitoreo |
| independientes existentes | refresh incremental | reemplazo completo |
| actualización offline | workbook/SAV | sin equivalente |

Workbook y SAV se presentan como actualización offline, no como conexión en
vivo. Google Sheets sigue fuera de Carga: es una superficie de Monitoreo.

### Desde Monitoreo

```text
acreditación declarada
→ revisiones publicadas
→ plan de ingreso
→ corte efectivo reconciliado
→ preview con pins
→ creación/reemplazo atómico
→ hermanas independientes
```

El handoff general de una base y el batch de acreditación son contratos
distintos. El revamp debe mantenerlos alcanzables, pero nunca presentarlos como
la misma operación.

## Decisiones de interacción

- El toolbar de la sección contiene navegación y comandos frecuentes, no una
  mutación estructural. La elección una/varias bases vive en `Plan`.
- `Fuentes` contiene el selector Manual/Plataforma/Desde Monitoreo y, cuando
  corresponde, el proveedor.
- `Revisión` concentra avisos que antes flotaban sobre toda la página. El rail
  señala atención con texto/estado, no solo con color.
- `Estructura` usa un selector de base únicamente en multibase.
- `Datos` conserva la tabla existente y la selección de base.
- Después de una promoción batch de Monitoreo, el destino recomendado es
  `Revisión`, no regresar silenciosamente a Manual.
- Los destinos usan la clave canónica `pestana`; Plan se canonicaliza como la
  ausencia de query (`/carga`) por ser el destino predeterminado. No se emiten
  `step`, `tab`, `insumos` ni otros alias legacy.

## Deuda observada que queda fuera de esta iteración

Prioridad contractual:

1. `route_selected` no exigido por todas las APIs de acreditación;
2. universo no reaplicado al reemplazar data en el CRUD manual multibase;
3. rename/remove/replace incompletos para relaciones repeat;
4. reconciliación multibase vinculada a `active_base` y no siempre a la base
   seleccionada en Carga;
5. diferencias de garantías entre Manual simple y Manual multibase;
6. dos handoffs de Monitoreo con copy demasiado parecido.

No se reparan inline porque implican backend, persistencia o decisiones de
dominio fuera del scope lock del revamp.

## Plan de implementación

### Iteración 1 — navegación y contrato

- modelo puro de pestañas y estados;
- componente basado en `ContextTabRail`;
- lectura/escritura de `?pestana=`;
- manifiesto y catálogo visual actualizados;
- deep links con query preservados por el runner `ui-quick-check`;
- pruebas semánticas y de modelo.

### Iteración 2 — redistribución de superficies

- mover la topología a `Plan`;
- dejar altas/importaciones en `Fuentes`;
- concentrar universo/extras/códigos/readiness en `Revisión`;
- separar estructura y tabla;
- conservar overlays y operaciones existentes.

### Iteración 3 — QA y paridad

- typecheck y Vitest focal;
- verificación de proyectos de referencia;
- recorridos visuales amplio y compacto;
- revisión independiente de contratos y verificador final.

## Matriz de aceptación

### Proyectos reales de referencia

| Proyecto | Cobertura de Carga | Riesgo que representa |
|---|---|---|
| `acrconta` | sí | acreditación multiactor, SAV e intake independiente |
| `acnur_pdm` | sí | Kobo, multibase, madre + repeat y universo |
| `acnur_acg` | sí | pipeline procesado hasta Analítica |
| `hsvg2026` | no | se verifica el manifiesto, pero no se usa como evidencia de Carga |

### Tipos de ingreso

1. Manual XLSX.
2. Manual CSV.
3. Manual SAV.
4. Manual ZIP con SAV.
5. Manual XLSX multihoja con repeat.
6. SurveyMonkey simple.
7. Kobo simple con repeats.
8. Multibase separado.
9. Base integrada Manual/SurveyMonkey.
10. Hermanas independientes SurveyMonkey.
11. Hermanas independientes Kobo sugeridas por Monitoreo.
12. Refresh incremental SurveyMonkey.
13. Reemplazo completo Kobo.
14. Actualización offline workbook.
15. Actualización offline SAV/ZIP.
16. Handoff general Monitoreo→Procesamiento.
17. Batch de acreditación multi-actor.

Las rutas que requieren credenciales reales no deben llamar servicios externos
durante QA. Se prueban mediante contratos, fixtures y estados de UI; la red solo
se ejercita cuando el usuario inicia deliberadamente una importación.

## Definición de terminado

- cinco pestañas visibles, direccionables y consistentes en single/multibase;
- ninguna capacidad anterior desaparece;
- ninguna pestaña crea o transforma bases al abrirse;
- el control de topología ya no vive en el toolbar;
- la primera vista útil no queda enterrada bajo un resumen gigante;
- 1440×900 y 1024×640 sin overflow ni scroll jail;
- `acrconta`, `acnur_pdm` y `acnur_acg` recorren `/carga` sin errores;
- typecheck, tests focales, QA contract y verificador final en verde.

## Evidencia de cierre

### Gates de código y contratos

- `pnpm --dir frontend typecheck`: verde.
- `pnpm --dir frontend test`: 216 archivos y 1641 pruebas en verde.
- suite backend focal de ingreso: 16 filtros `testthat` en verde para
  procesamiento multiactor, batch de acreditación, Kobo simple/repeats,
  Manual simple/repeats, handoff de Monitoreo, SAV, universo, base integrada,
  intake, SurveyMonkey multibase/refresh/workbook/SAV.
- `R_LIBS_USER=/tmp/prosecnur-r-lib make reference-project-verify`: 4 proyectos
  verificados, 0 fallidos (`acrconta`, `acnur_pdm`, `acnur_acg`, `hsvg2026`).

Las importaciones que requieren credenciales o red se validaron con fixtures,
contratos y estados de interfaz. No se efectuaron llamadas reales a Kobo ni
SurveyMonkey sin una acción deliberada y credenciales del usuario.

### Matriz visual reproducible

Se recorrieron las cinco pestañas en cinco viewports desktop por cada proyecto:
1710×1107, 1440×1000, 1366×768, 1280×720 y 1024×600. Resultado acumulado:
100 capturas, 0 overflows, 0 scroll jails, 0 errores de página/API/recursos y 0
proyectos ausentes.

La revisión humana posterior detectó dos contradicciones semánticas que el
inspector geométrico no podía inferir: readiness multibase calculada desde el
estado single-base y pérdida del batch de Monitoreo al reabrir un estudio ya
multibase. Después de repararlas se añadieron 22 capturas de regresión en
1440×1000 y 1024×600: las cinco pestañas de `acrconta` y `acnur_pdm`, más la
visibilidad explícita del selector `Bases / Desde Monitoreo` en `acrconta`.

| Proyecto | Informe final | Cobertura observada |
|---|---|---|
| `hsvg2026` | `tmp/visual-qa/quick/2026-07-25T23-01-59-998Z/report.json` | estados pendientes sin falsa readiness |
| `acnur_pdm` | `tmp/visual-qa/quick/2026-07-25T23-03-03-047Z/report.json` | Kobo multibase, madre/repeat, nombres extensos |
| `acrconta` | `tmp/visual-qa/quick/2026-07-25T23-04-15-446Z/report.json` | acreditación multiactor e intake independiente |
| `acnur_acg` | `tmp/visual-qa/quick/2026-07-25T23-05-15-969Z/report.json` | proyecto procesado hasta Analítica |

Regresiones posteriores a la revisión independiente:

- `acrconta`: `tmp/visual-qa/quick/2026-07-25T23-25-10-086Z/report.json`;
- `acnur_pdm`: `tmp/visual-qa/quick/2026-07-25T23-25-41-570Z/report.json`;
- selector multibase explícito: `tmp/visual-qa/quick/2026-07-25T23-27-53-285Z/report.json`.

Los tres informes registran `data-audit-ready` por pestaña, 0 overflow, 0
scroll jail y 0 errores de página, consola, API o recursos.

### Evidencia del pulido perceptivo

Tras la arquitectura funcional se repitió la matriz visual sobre el pulido:
cuatro proyectos, cinco pestañas y cinco viewports desktop. Son 100 capturas con
0 overflow, 0 scroll jail, 0 errores de página/API/recursos y 0 proyectos
ausentes.

| Proyecto | Informes del pulido | Riesgo observado |
|---|---|---|
| `acrconta` | `tmp/visual-qa/quick/2026-07-25T23-59-29-315Z/report.json`; `tmp/visual-qa/quick/2026-07-26T00-02-09-888Z/report.json` | acreditación multiactor, SAV y acceso explícito a Desde Monitoreo |
| `acnur_pdm` | `tmp/visual-qa/quick/2026-07-26T00-00-28-605Z/report.json`; `tmp/visual-qa/quick/2026-07-26T00-02-54-356Z/report.json` | Kobo madre/repeat, universo aplicado y selector real de base |
| `acnur_acg` | `tmp/visual-qa/quick/2026-07-26T00-03-39-868Z/report.json` | estudio procesado hasta Analítica y tabla ancha |
| `hsvg2026` | `tmp/visual-qa/quick/2026-07-26T00-04-44-966Z/report.json` | estados vacíos y topología no decidida |

La revisión humana independiente encontró tres contradicciones que el
inspector geométrico no podía inferir: Plan vacío inventaba una base, Revisión
trataba cobertura parcial como disponible y Preguntas enterraba la primera
tarjeta en 1024×600. También detectó que una elección visual de Monitoreo podía
ocultar el editor de universo. Todas se corrigieron y quedaron cubiertas por
pruebas de regresión.

Los dos estados perceptivos afectados se recapturaron después de la reparación:

- Plan vacío neutral: `tmp/visual-qa/quick/2026-07-26T00-15-19-366Z/report.json`;
- Estructura > Preguntas amplia/corta: `tmp/visual-qa/quick/2026-07-26T00-15-46-561Z/report.json`.

Ambos informes finales registran 0 issues, overflow, scroll jail, errores o
selectores ausentes. La matriz de ingreso backend se repitió con 16 archivos
`testthat` focales y el gate de proyectos reales verificó 4 proyectos, 0
omitidos y 0 fallidos. Los conectores con credenciales se mantuvieron sin red:
se verificaron mediante fixtures y contratos, no mediante importaciones reales.

### Hallazgos corregidos durante la matriz

1. El runner asignaba la ruta completa a `pathname` y escapaba `?pestana=`;
   ahora preserva pathname, query y hash como URL.
2. Los `<select>` nativos producían falsos positivos de overflow por medir la
   opción más larga; el inspector conserva la detección del rectángulo real y
   del overflow global.
3. Un proyecto con archivos pertenecientes a otro módulo podía parecer listo
   para Carga. La readiness ahora exige `instrumento_parsed` y
   `data_previewed`, y Datos muestra un estado vacío en vez de llamar el backend
   prematuramente.
4. En multibase, el rail consultaba únicamente los flags single-base y podía
   afirmar «sin respuestas» junto a tablas pobladas. Ahora cuenta formularios y
   respuestas por base y distingue cobertura completa de parcial.
5. El batch de acreditación estaba disponible solo antes de materializar las
   bases. `Fuentes` mantiene una elección explícita `Bases / Desde Monitoreo`
   también al reabrir o actualizar un estudio multibase.

### Compatibilidad legacy observada

La implementación previa que vuelve deliberada la acreditación exige
`monitoreo_profile.route_selected = TRUE` para proponer públicos. Un `.pulso`
antiguo con familia `acreditacion` pero sin esa clave no se infiere ni migra en
este revamp. Se mantiene como deuda de compatibilidad: resolverla requiere una
decisión explícita de migración/backfill y no debe reintroducir inferencia por
nombres.

### Comprobación en el proyecto solicitado

`ACRDCONTA.pulso` se abrió en el servidor local y `/carga?pestana=plan` mostró
los cinco destinos estables. La decisión «Varias bases» aparece exclusivamente
en Plan y el toolbar de Procesamiento conserva solo navegación de sección.
