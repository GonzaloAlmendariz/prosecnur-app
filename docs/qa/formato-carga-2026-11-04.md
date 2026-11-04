# Formato en Carga (4 nov 2026, noche)

Segunda tanda del encargo de coordinación (Meta B) de la noche del 3 al 4 de noviembre: la pasada de formato en los
módulos que no la tuvieron. Receta de `formato-monitoreo-2026-11-02.md` y `formato-calculo-graficos-2026-11-02.md`.
Alcance de escritura: `frontend/src/features/carga/` y este doc. Decisiones «decididas por coordinación, revisables
por Gonzalo».

Carga ya tenía dos piezas: la letra por rol (`app/letraPorRol`, 614 → 0 el 1 nov) y el ratchet de « · » por archivo
(`puntoMedio.contract`, 43004147e, que limpió la página principal y el panel de bases y dejó 194 en 54 archivos).

## Medición (4 nov, 01:50)

Script del scratchpad (`medir.mjs`): sin comentarios ni tests.

| # | Patrón | Antes | Después | Dónde nacía |
|---|---|---|---|---|
| P1 | `font-size` en px | 0 | 0 | Ya por rol desde el 1 nov |
| P3 | « · » en código | 194 líneas en 54 archivos | **0** | `IndependentSiblingsWizard` 51, `smBasesModel` 17, `SmDecisionSuite` 9, `IntegratedInstrumentsWizard` 9, `variablesBaseModel` 8… y un `content: "·"` en `carga-sources.css` |
| P4 | `toLocaleString("es-PE")` en cifras | 40 | **0** | `smBasesModel` 12, `CargaPage` 9, `CargaUniverseFilter` 5. Daban la misma salida que `formatoConteo`: el cambio es de fuente, no de cifra. Quedan las tres fechas (`dateStyle`, `{ day: … }`) |
| P5 | Vacíos, cargas y errores con receta propia | ~55 recetas (`pulso-armon-vacio` 22, `pulso-plf-estado` 14, `pulso-sm-empty` 9, `pulso-platform-empty`, `pulso-origen-externo-vacio`…) y 5 esperas a mano | **0** | Declarada: la raya de celda vacía de Secciones (`pulso-carga-section-condition-empty`) |
| P6 | Estados con píldora propia | 3 con tono | **0** | `pulso-cf-estado` (Igual / Distinta / Solo en…), `pulso-origen-externo-estado` (Declarada / Otra base / Sin declarar), `pulso-sm-case-badge` («Casi completa») |
| P2 | Cajas propias con borde, radio y relleno | 214 | 211 | Ver «P2: línea base» |

### Decisiones (decididas por coordinación, revisables por Gonzalo)

- **Ningún « · » de Carga se LEE de un dato**: no hay `split` ni regex sobre el punto medio en el módulo. Los
  mensajes de error simulados en los tests conservan su «… · E_CODIGO» porque es el formato del backend.
- **Reglas de reescritura**: lista → coma; código o id junto a su nombre → paréntesis («Ventas (12345)»,
  «Publicada (rev_…)»); variable y su etiqueta → dos puntos («p1: Edad»); dos cifras enfrentadas → «frente a»
  («Válidos 279 frente a 281»); formatos admitidos → «.xlsx, .csv, .sav o .zip»; «Escalas distintas · Armonizar»
  → «Escalas distintas: armonizar». La clave interna de los cambios de fraseo (`Mexico · p1`) pasa a `Mexico/p1`:
  no se pinta, sólo identifica la fila.
- **Indicadores de celda**: `pulso-mapa-presencia` y `pulso-emparejamiento-insignia` (icono y texto dentro de una
  celda de matriz) son la gramática de tabla del Mapa de bases, no una píldora de estado: se quedan.
- **El vacío de Plan › bases** (`li.is-empty` con su botón propio «Añadir fuentes») pasa a `EstadoVacio` con la acción
  primaria del kit; la fila deja su grid de tres columnas.
- **Títulos de vacío sin punto final**: el kit separa título y descripción; las frases largas («Ninguna todavía.
  Combina…») se parten en título («Todavía no hay variables calculadas») y descripción.

## P2: línea base

Las 211 cajas propias son, en su mayoría, del asistente de SurveyMonkey (`independiente/`, `IntegratedInstrumentsWizard`),
de las tarjetas de base y de las matrices: objetos de una colección o pasos de un asistente, no bloques con título.
`carga-v2.css` está congelado a crecimiento y sólo bajó. Queda como línea base; el candidato claro para `Panel` es la
cabecera de cada pestaña del asistente independiente cuando se toque esa vista.

## Guard

- `features/carga/puntoMedio.contract.test.ts`: la foto pasa a vacía (meta 0).
- `features/carga/formatoDelModulo.contract.test.ts` (nuevo), meta 0: P4 sin `toLocaleString` de cifra, P5 sin recetas
  propias ni esperas sueltas, P6 sin las tres píldoras. Incluye el caso que demuestra que cada detector reconoce lo
  que prohíbe (y que no confunde `--pulso-status-empty`, un token, con una receta).

## Reglas que quedan en `app/theme.css`

`.pulso-sm-case-badge`, `.pulso-sm-case-empty`, `.pulso-sm-decision-empty` y `.pulso-question-detail-empty` viven en
`app/theme.css` y ya no las usa nadie (`.pulso-sm-empty` sí: la usan las páginas congeladas de Monitoreo). Se avisa a
coordinación para la poda.

## Vistas, de la más fea a la menos (capturas «después», `acnur_acg`, 1440×1000 y 1024×600)

Corrida «después» (`cap/carga-despues`): 10 capturas, 10 md5 distintos. Plan, Fuentes, Revisión y Estructura sin
hallazgos a 1440 ni a 1024. Todo lo que marca el runner está en Datos (`rotulosPartidos=40`, `cabecerasQueTapan=1`,
`columnasOcultas=2`), dentro de la grilla `pulso-processing-sheet-*`, que vive en `features/procesamiento/` y esta pasada
no tocó: coordenadas y marcas de tiempo crudas que se parten dentro de su celda.

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 1 | Estructura | Códigos de sección («DATO_»), su nota y la condición («si consent = '1'») salían en Courier: `ui-monospace, monospace` no existe en Chromium ni en Electron y cae al genérico | ☑ la pila completa del módulo (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) en las 8 declaraciones de `carga-v2.css`. `app/theme.css` tiene 4 más (fuera de alcance, avisado) |
| 2 | Datos | La grilla parte valores crudos dentro de la celda («2026-06-/13T10:38…») y su cabecera fija tapa 41 px de la primera fila | ☐ fuera de alcance (`procesamiento/ProcessingSheetViewer`) |
| 3 | Revisión › Base preparada fuera | Ahora el vacío es el del kit con su descripción larga en dos líneas; el estado «Sin declarar» es `EstadoChip` | ☑ |
| 4 | Estructura | «CONDICIONAL» en versalitas verdes: es una etiqueta del tipo de sección, no un estado | se queda |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P3 | ☑ | | 165 líneas por reglas de reescritura y un script que sólo toca líneas de código; 57 tests ajustados a la frase nueva |
| P4 | ☑ | | `formatoConteo` en 11 archivos |
| P5 | ☑ | | ~55 recetas y 5 esperas; −150 líneas de reglas huérfanas en `carga-v2.css`, `panelLateralFuentes.css`, `OrigenExternoPanel.css`, `EquivalenciasPanel.css` y `ArmonizacionFilaEditor.css` |
| P6 | ☑ | | Tres píldoras con tono a `EstadoChip` |
| P2 | línea base | — | |
| Capturas después | ☑ | | Ver arriba |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=carga` 113 suites, 1,465 tests |
