# Formato en Codificación (4 nov 2026, noche)

Encargo de coordinación (Meta B) para la noche del 3 al 4 de noviembre: la pasada de formato en los módulos que no
la tuvieron, empezando por el más desfasado. Gonzalo: «aún hay bastante UI desfasada por mejorar durante toda la
noche» y que esta vez no se pase de fino. Receta: la de `formato-monitoreo-2026-11-02.md` y
`formato-calculo-graficos-2026-11-02.md` (P1 letra por rol, P3 sin « · », P4 cifras por `lib/formatoNumero`, P5
vacíos y cargas del kit, P6 estados como `EstadoChip`, P2 bloques como `Panel`). Alcance de escritura:
`frontend/src/features/codificacion/` y este doc. Decisiones «decididas por coordinación, revisables por Gonzalo».

## Medición (4 nov, 01:10)

Script del scratchpad (`medir.mjs`, el de la pasada de Cálculo y Gráficos): sin comentarios ni tests.

| # | Patrón | Antes | Después | Dónde nacía |
|---|---|---|---|---|
| P1 | `font-size` en px (CSS) | 107 | **0** | `codificacion-v2.css` 70, `AgruparCategoriasCodificador.css`, `sugerenciasModulo.css`, `palabrasPanel.css`… Codificación no estaba en el ratchet `letraPorRol` |
| P1b | `fontSize` numérico en línea (JSX) | 118 | **0** | `PreguntasLanding` 33, `IntegerCodificador` 16, `PairingDialog` 16, `RelationDialog` 15, `AdaptarPane` 13 |
| P3 | « · » en código | 57 | **1** | `CodingConfigActions` 13, `PairingDialog` 5, `IntegerCodificador` 6, `PreguntasLanding` 3; el que queda LEE el formato del backend (`… · E_TXT_*`) |
| P4 | `toLocaleString` / conteos visibles sin miles | 0 / ~10 | 0 / 0 | «3882 Casos» en Matrices; valores y casos de las numéricas; respuestas de un grupo |
| P5 | Vacíos y cargas con receta propia | 14 en JSX, 22 reglas | **0** (más la pantalla de preparación, declarada) | `pulso-codificacion-matrix-empty` ×5 (una era una carga), `pulso-cv2-resp-empty` ×2, `-qa-empty`, `-grupo-empty`, `-relation-empty` y los tres estados del panel de palabras (`pulso-plf-estado`, prestada de Carga) |
| P6 | Estados con píldora propia | 3 | **0** | El chip de decisión (ADR 0078) con estilos en línea, y `pulso-cv2-badge` «Existente»/«Nuevo» |
| P2 | `<Panel>` / cajas propias con borde, radio y relleno | 5 / 37 | 5 / 37 | Ver «P2: línea base» |
| P8 | `fontFamily: "monospace"` en línea | 21 | 0 | Los nombres de variable salían en Courier (la pila genérica de `monospace`); ahora con la pila del módulo (`ui-monospace, SFMono-Regular, Menlo…`). Siguen en monoespaciada porque son variables (regla de Cálculo) |

## Vistas, de la más fea a la menos (antes, `acnur_acg`, 1440×1000 y 1024×600)

Capturas «antes» desde un worktree en HEAD (`cap/cod-antes`, 8 capturas, 8 md5 distintos). El runner daba
`ok=false`: `rotulosPartidos=3` («×1» y «multi» partidos en Codificar) y `textosFuera=1`.

| # | Vista | Qué se veía | Qué se hizo | Estado |
|---|---|---|---|---|
| 1 | Preparar | Tarjetas de pregunta de 210 px con media altura en blanco (un `minHeight: 210` en línea y un `min-height: 206px` en la hoja); nombres de variable en Courier; «1,283 respuestas · 73 únicas» | Sin alto mínimo (el stretch de la fila sigue igualando), pila monoespaciada del módulo, «1,283 respuestas, 73 únicas» | ☑ |
| 2 | Matrices | «3882 Casos» sin miles; pie «ID caso · Texto original · Código · Categoría · Observaciones»; «Monitoreo territorial · 4/4 seleccionadas»; vacío del diccionario con receta propia | Cifras por `formatoConteo`, «ID caso, texto original, código, categoría y observaciones», «Monitoreo territorial: 4 de 4 seleccionadas», `EstadoVacio` | ☑ |
| 3 | Codificar | Trece grupos vacíos con la misma caja punteada propia; «EXISTENTE» en versalitas como píldora; «×1» y «multi» partidos en dos líneas | `EstadoVacio` compacto de una línea, `EstadoChip` «Existente»/«Nuevo» (neutro e info), los dos rótulos sin partir (`white-space: nowrap`, `flex-shrink: 0`). La primera corrida «después» destapó «Respuest/as únicas» a 1024 (la píldora ya no se encogía y el título sí): la cabecera de columna envuelve por palabras | ☑ |
| 4 | Adaptación | «Campo nuevo: D1_information/*_recod · 20 respuestas afectadas» con un « · » verde suelto y Courier | Sin el punto; pila monoespaciada | ☑ |
| 5 | Adaptación, franja de cifras | Las cifras con subtítulo quedan más altas que las que no lo tienen (baselines distintas) | — | ☐ (P2, ver abajo) |

## P2: línea base (decidido por coordinación, revisable por Gonzalo)

Codificación ya monta `Panel` donde el bloque es un documento (Adaptación › «Codificaciones que se aplicarán»,
Agrupar categorías). Las 37 cajas propias que quedan son de otra especie:

- **Columnas de trabajo de Matrices** (`pulso-codificacion-matrix-panel`): grid con cabecera de icono y una lista
  que desplaza por dentro. Sus reglas viven en `app/theme.css` (fuera del alcance de esta sesión) y `Panel` no ofrece
  ni el icono ni el desplazamiento interno; pasarlas sin eso rompe la geometría del banco de trabajo.
- **Tarjetas de pregunta y de grupo** (Preparar, Codificar): son objetos de una colección, no bloques con título.
- **Avisos** (`AplicarOmitidasAviso`, `SinRecodificarAviso`, `FocoSinIncluirAviso`): son avisos, no paneles.

Quedan como candidatos cuando el kit tenga un `Panel` con icono y cuerpo desplazable: las dos columnas de Matrices y
la franja de cifras de Adaptación (vista 5).

## Guard

`features/codificacion/formatoDelModulo.contract.test.ts`, meta 0: P1 en hojas y en línea, P3 con foto de los que
leen el backend (1), P4 sin `toLocaleString`, P5 sin recetas propias (salvo `pulso-codificacion-loading*`, la
pantalla de preparación de Preparar, que enseña los pasos y una silueta), P6 sin `pulso-cv2-badge`. Incluye el
caso que demuestra que cada detector reconoce lo que prohíbe. No se tocó `app/letraPorRol` (está en `app/`, fuera del
alcance de la sesión): el guard del módulo lo cubre.

## Aprendido

- **El script de poda se comió la última línea de un comentario** (en `carga/fuentes/panelLateralFuentes.css`, la
  tanda siguiente): la regex tomaba como selector todo lo que había entre la `}` anterior y la `{`, comentario incluido.
  Lo vio `cssConcatenable` («comentario sin cerrar»). Corregido: lo que precede al selector hasta el último `*/` se
  conserva.

## Reglas que quedan en `app/theme.css`

`app/theme.css` conserva dos reglas de `.pulso-codificacion-matrix-empty` sin consumidor (5594 y 5604). Se avisa a
coordinación para la poda de `theme.css`.

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición y ranking | ☑ | (este doc) | |
| P1, P1b | ☑ | | `p1.mjs` de Material y su gemelo `p1b.mjs` para el JSX, con la misma regla |
| P3, P4 | ☑ | | Tests ajustados: «12 casos, 8 textos distintos», «ya marcada (2 de 3)», «B. Experiencia universitaria», «1 grupo, 1 excluida y 1 frase» |
| P5 | ☑ | | Ocho recetas, sus reglas en `codificacion-v2.css` y `palabrasPanel.css` podadas |
| P6 | ☑ | | `DecisionChip` = `EstadoChip` + la coletilla al lado, en texto apagado (ADR 0078: el motivo sigue a la vista) |
| P2 | línea base | — | Ver arriba |
| Capturas después | ☑ | | `cap/codificacion-despues`: 8 capturas, 8 md5 distintos, `rotulosPartidos=1` («Respuest/as», ver vista 3); tras el arreglo, `codificacion-despues2` (Codificar a 1440 y 1024) `ok=true`, sin hallazgos. Antes: `rotulosPartidos=3`, `textosFuera=1` |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=codificacion` 48 suites, 858 tests |
