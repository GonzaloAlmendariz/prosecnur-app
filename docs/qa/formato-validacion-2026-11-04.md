# Formato en Validación (4 nov 2026, madrugada)

Encargo de coordinación (Meta B): la pasada de formato en el resto de Validación (reglas del formulario, criterios
de revisión, cierre de base y los controles que comparten), con el explorador ya rehecho en E8. Receta de
`formato-codificacion-2026-11-04.md` y `formato-calculo-graficos-2026-11-02.md`: P1 letra por rol, P3 sin « · »,
P4 cifras por `lib/formatoNumero`, P5 vacíos y cargas del kit, P6 estados como `EstadoChip` y P2 bloques como
`Panel`. Alcance de escritura: `frontend/src/features/validacion/` y sus tests. Decisiones tomadas por la sesión,
**revisables por Gonzalo**.

Guard: `frontend/src/features/validacion/formatoDelModulo.contract.test.ts`, meta 0 en P1, P3, P4, P5 y P6, con
detectores que se prueban a sí mismos.

## Medición (4 nov, 03:00)

Script reproducible del scratchpad (`val2/medir.py`): cuenta sin comentarios y sin tests. El explorador
(`tabs/explorar/`) entra en el guard porque es del mismo módulo.

| # | Patrón | Antes | Después | Dónde nacía |
|---|---|---|---|---|
| P1 | `font-size` en px (CSS y plantillas) | 105 | **0** | `validacion-v2.css` 97 y una hoja escrita como texto dentro de `ReglaDrillPanel.tsx` |
| P1b | `fontSize` numérico en línea (JSX) | 225 | **0** | `ReglaDrillPanel` 46, `LimpiezaTab` 39, `ReglaEditor` 33, `InstrumentoTab` 25, `FiltroCascada` 20, `RuleNarrative` 16, `PlotlyView` 14, `VariableChip` 13 |
| P3 | « · » en código | 57 | **0** | `FiltroCascada` 6, `ReglaEditor` 5, `operationalControlsModel` 4, `RolesDeclarados` 3 y 25 en el explorador (casi todos en `<title>` de gráficos). Lo que queda está en comentarios |
| P4 | `toLocaleString` suelto / conteos `.length` sin miles | 3 / 18 | 0 / 0 | La cola de Limpieza, los casos detectados de una regla y las variables del selector pueden pasar de mil |
| P5 | Vacíos con clase propia / esperas como texto | 5 / 5 | 0 / 0 | `crossbar-vacio`, `pulso-option-picker-empty` ×3, `pulso-rel-empty`, `pulso-criterios-empty`; «Leyendo…»/«Cargando…» sueltos |
| P6 | Estados con píldora propia | 7 | **0** | `pulso-rel-status` (4 estados de las reglas de coherencia) y `pulso-operational-chip` (3) |
| P2 | `<Panel>` / cajas propias con borde, radio y relleno | 4 / 64 | 4 / 64 | Ver «P2: siguiente tanda» |

### Regla de P1 (la de Material de campo)

≥ 18 px → `kpi`; 15–17 → `title`; 12–14.5 → `subtitle` si el bloque es seminegrita, `body` si no; 10.6–11.5 →
`eyebrow` si va en mayúsculas, `caption` si no; ≤ 10.5 → `micro`. Se aplicó con un codemod que lee cada bloque CSS
y cada objeto de estilo (también los anidados), y en un ternario sólo toca las ramas, nunca la condición. Reparto,
contado en el diff: 114 `caption`, 92 `micro`, 58 `body`, 43 `subtitle`, 8 `eyebrow`, 4 `title`, 2 `kpi`.

### Decisiones (revisables por Gonzalo)

- **P3.** Una lista va con coma o `enumerar` («2 casos excluidos y 14 celdas corregidas»); la precisión entre
  paréntesis («SurveyMonkey (sm_id)», «10 (10.0%)»); una ruta de sección con «›»; un aviso con punto y coma; un
  rótulo y su valor con dos puntos («Campo: 30 jun.–6 jul.», «Similitud: 90%»). Las filas de cifras que se
  separaban con «·» (Decisiones, filtro activo, cabecera del explorador) llevan una línea fina. La fórmula del IQR
  usa «×» («Q1 − 1.5 × IQR»).
- **P4.** Los `toFixed(1)` de porcentaje se quedan: nunca llegan a mil y conservan el «.0». Los cuartiles del rango
  de un filtro, que pueden ser montos, pasan por `formatoDecimal`.
- **P5.** Se declara la pantalla de preparación del explorador (`pulso-validacion-explorar-loading*`): enseña los
  pasos y una silueta, como la de Codificación. `is-vacio` de la ficha del explorador es la marca de celda vacía de
  una lista de datos, no un vacío de bloque.
- **P6.** `pulso-vv2-pill` son botones y `pulso-cvm-chip` fichas de datos: no son estados.

## Vistas, de la más fea a la menos (después, 1440×1000 y 1024×600)

Capturas contra una pila propia con `--url`, sin arranque por corrida: `acnur_acg` (con base, 8 capturas, 8 md5
distintos) y `hsvg2026` (sin base, 8 distintas). Ninguna corrida da rótulos partidos, textos fuera, cabeceras que
tapan ni geometría.

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 1 | Reglas del formulario | Tarjetas dentro de tarjetas (Controles operativos, Qué es un caso, Variables fuera de auditoría), cada una con su borde | **P2 hecho en los tres pasos**: Plan, Auditoría y Resultados son `Panel` (`PasoDeValidacion`: «Paso N de 3» de antetítulo, estado como `EstadoChip`); la lista de reglas pierde su caja dentro del paso 3; las tarjetas de preparación miden su texto al apilarse. Controles operativos y Qué es un caso siguen siendo fichas dentro del paso |
| 2 | Criterios de revisión | La cabecera, la sugerencia y el vacío son tres cajas distintas con tres bordes (sólido, punteado y punteado) | **P2 hecho**: la barra es `Panel` con el conteo de título y Nuevo criterio / Ejecutar de acciones (Ejecutar deja su verde a mano por `pulso-secondary`); las sugerencias, `Panel` sutil con antetítulo «Sugeridos», sin la caja punteada; el vacío ya era `EstadoVacio` |
| 3 | Cierre de base | Cola y panel de decisión con caja propia; el aviso de auditoría es una tira ámbar suelta | P2, siguiente tanda |
| 4 | Explorar | Rehecho en E8; aquí sólo P1, P3 y P4 | hecho |

## Lo que destapó la captura

- **Readiness de los vacíos** (arreglado). Con `hsvg2026`, que no trae base, Explorar, Criterios, Cierre e
  Instrumento devolvían su vacío o su error sin `data-audit-ready`. El runner se detenía en
  «sin-marca-de-readiness» y el QA no podía juzgar esa vista. Ahora cada vacío se envuelve en `VacioListo`
  (`components/VacioListo.tsx`) con la marca de su pestaña.
- **EstadoChip en un grupo intrínseco** (rodeado; se pide al kit). La auditoría de geometría mide los hijos
  elemento y no ve el rótulo de texto del chip, así que leía el punto de 7 px como el fondo del chip: un
  `capacity-drift` de 5.3 px en los controles operativos. Aquí cada chip del grupo va envuelto. El arreglo de raíz
  es del kit (`components/EstadoChip`: rótulo en su propio `<span>`) y queda para coordinación.
- **Selector de cruces** (abierto, de E8). Con rótulos largos la opción desborda de 17 a 106 px a la derecha
  (`crossbar-opcion`, 460 px de ancho). El texto del gráfico ya va en su propio elemento, pero el desborde sigue:
  falta medir en vivo qué hijo no encoge.
- **«·» que escribe el backend.** El título de una semilla («Periodo de campo · «time_consent_start» fuera de…»)
  viene de `api/R`, fuera del alcance de este módulo.
- **El rótulo del warm start en `/validacion`** dice «Abriendo el proyecto»: `destinoWarmup` reconoce la ruta del
  módulo (`/procesamiento`), no la de sus secciones. Es de `app/BootGate.tsx`.

## P2: siguiente tanda

64 cajas propias (47 en `validacion-v2.css`, 12 en el explorador, 4 en `ruleDetail.css`, 1 en `crossBar.css`) y
32 `<section>` con cabecera propia. Hoy hay 4 `Panel`, todos en el explorador. El orden sigue el ranking: Reglas
del formulario, Criterios y Cierre.

## Bitácora

- 4 nov, 03:00: medición, P1, P3, P4, P5 y P6 con el guard; captura después con los dos proyectos.
- 4 nov, 04:30: selector de cruces medido en vivo y arreglado (popovers 12 → 0), semillas sin «·» en el R, destino del warm
  start en las rutas de sección, y P2 de Reglas del formulario.
