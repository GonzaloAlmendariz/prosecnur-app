# Prompt operativo — GOAL loop de auditoría total del motor PPT

Tipo: Prompt de arranque de sesión / entrada de `/loop`
Estado: Vigente
Fecha: 2026-08-03
Autoridad: Lanza el loop de `goal-loop-motor-ppt-2026-08-03.md`; no lo redefine

Pegar el bloque siguiente tal cual en una sesión nueva (o como prompt de
`/loop`). Este loop audita el **motor de PPT partícula por partícula**: cada
slide, cada graficador, cada argumento, cada placeholder de plantilla, contra
el render real. El loop de Gráficos multibase
(`goal-loop-graficos-multibase-2026-08-03.md`) sigue siendo el dueño de la
dimensión base; los hallazgos de multibase se anotan allá.

---

Ejecuta el GOAL loop de auditoría total del motor PPT.

**PASO CERO, OBLIGATORIO E INNEGOCIABLE: lee COMPLETO
`docs/qa/goal-loop-motor-ppt-2026-08-03.md` antes de tocar cualquier archivo,
abrir cualquier server o lanzar cualquier agente.** Ahí viven la vara, el
inventario censado, la cola de lotes, el ledger de cobertura (qué partícula ya
fue mirada y con qué evidencia) y el registro P1, P2, P3… Si no lo leíste, no
sabes qué lote toca ni qué quedó probado: cualquier trabajo sin leerlo se
presume desperdiciado.

## Qué se audita

El motor entero, entendido como todo lo que decide qué aparece en la lámina:

- **9.418 líneas** de `reporte_plan_ppt.R` más los graficadores, helpers de
  plan, Word y consolidado.
- **20 slides** y **20 graficadores** del registry.
- **323 argumentos curados** (110 de slides, 213 de graficadores) y **385
  argumentos de preset** en 17 tipos. Más **58 formals no curados** que hoy
  viajan como `args_extra` sin superficie.
- **4 plantillas**, 73 layouts, **456 placeholders**. La principal tiene 163:
  97 `body`, **34 `pic`**, 20 `title`, 4 `dt`, 3 `ftr`, 3 `sldNum`.

Cada uno de esos elementos es una **partícula**. La unidad de trabajo del loop
es el **lote**: un conjunto de partículas afines que se audita entero.

## La vara — las cinco pruebas de cada partícula

Una partícula está auditada cuando pasa las cinco, con evidencia:

1. **Existe donde dice existir.** El slot que la UI ofrece corresponde a un
   placeholder real del layout, del tipo correcto. Un `pic` no se ofrece como
   campo de texto; un `ftr` no se ofrece como cuerpo. *(Es el defecto que abrió
   este loop: la UI muestra campos de texto donde la plantilla tiene espacios
   de logo.)*
2. **Hace lo que su nombre promete.** El label y la descripción que lee el
   analista describen el efecto real en la lámina, verificado encendiéndolo y
   apagándolo. Un ajuste de posición no decide contenido; uno de contenido no
   mueve geometría.
3. **Su default declarado es el efectivo.** Lo que la UI muestra como valor por
   defecto es lo que el render usa, respetando la cadena
   **motor → Pulso → base del proyecto → tipo → override del slide**.
4. **Degrada sin romper.** Con dato vacío, N = 0, una sola categoría, veinte
   categorías, etiquetas larguísimas, valores especiales (90/94/95/96/97/98/99)
   y series de una sola opción: no aborta, no se solapa, no desborda su caja,
   no miente el denominador.
5. **Vale igual por los cuatro caminos.** Preview de lámina, export PPTX,
   export Word y consolidado producen la misma decisión. Si divergen, es
   defecto aunque cada uno se vea bien por separado.

## Cómo se audita — la regla de evidencia

**Ninguna partícula se declara auditada sin un render mirado.** Leer el código
sirve para formular la hipótesis; sólo el PNG de la lámina la confirma. Para
cada partícula del lote:

1. **Censo**: localizarla en el registry/preset/plantilla y en el punto del
   motor que la consume. Anotar su default declarado y su default efectivo.
2. **Prueba diferencial**: renderizar con el valor por defecto y con el valor
   contrario, sobre el mismo dato. Dos PNG. Si no cambia nada visible, la
   partícula es inerte y eso es un hallazgo (arg muerto, o no cableado).
3. **Mirada de detalle**: no basta «se ve bien». Comprobar bordes de caja,
   solapes, cortes de texto, alineación con la retícula del layout, contraste,
   coherencia tipográfica, y que el número que se lee sea el número del dato.
4. **Prueba de borde**: al menos un caso degradado de la lista de la prueba 4.
5. **Paridad**: repetir por el camino que corresponda cuando la partícula viva
   en más de uno.

Herramientas: `/ver-ui` con proyecto abierto para la superficie;
`/api/graficos/preview-slide` con `render_slide_preview` para el PNG de la
lámina; `officer::layout_properties()` para el censo de placeholders; los
graficadores en `exportar = "rplot"` para inspeccionar el objeto con
`ggplot_build()` sin pasar por el canvas.

## Trampas conocidas de este motor

Se dan por sabidas; no vuelvas a descubrirlas a mano:

- **Canvas y no-canvas son dos caminos distintos.** El entregable usa canvas
  (`usar_canvas = TRUE`, que el router fuerza). Un test que sólo cubre
  no-canvas no prueba lo que el cliente recibe.
- **`.enriquecer_presets` es el punto común** de preview, PPTX, Word y
  consolidado, y aplica el suelo de `.PRESETS_DEFAULT_PULSO`. La herencia
  `base$args → tipo$args` la hace el motor después.
- **`.merge_args(base_args, preset_args, overrides)`**: el último gana.
- **Los jobs `callr` corren contra el paquete instalado**: tras tocar código de
  jobs, `R CMD INSTALL` o el fix no existe.
- **Locale**: la suite y los renders exigen `en_US.UTF-8`.
- **Los goldens versionados pueden verificarse a sí mismos.** Si un test
  compara contra un artefacto generado por el mismo código, no prueba nada.

## Reglas de no detención

- **Este loop NO se detiene. Sólo Gonzalo lo cierra.** Al cerrar un lote,
  empieza el siguiente de inmediato, hasta agotar el contexto. Al vaciar la
  cola se reaudita desde el primer lote con la vara más alta.
- **No se detiene por una decisión**: se anota en la bandeja del doc con
  opciones y recomendación, se toma el supuesto más conservador y se sigue.
- **No se detiene por un defecto grande**: se acota, se le pone guard y se
  sigue; si excede el lote, entra a la cola como lote propio.
- **No se detiene por un hallazgo ajeno**: si es de multibase, va al loop de
  Gráficos multibase; si es de arquitectura, a un ADR; y se sigue.

## Gate por lote

Proporcional al diff, y siempre con render:

- `testthat` de las suites tocadas (`^graficos|^reporte-plan|^graficador`).
- Typecheck y Vitest del feature si se tocó TS.
- **Al menos un PNG de lámina por partícula reparada**, antes y después.
- Ledger y registro actualizados en el doc. **Un lote que no actualiza el doc
  no existió.**

## Qué produce cada lote

Una entrada `P<n>` en el doc con: qué partículas se miraron, qué evidencia se
generó, qué se reparó, qué quedó abierto y con qué guard. Y el ledger de
cobertura actualizado: cuántas de las 708 partículas de argumento y cuántos de
los 456 placeholders llevan las cinco pruebas pasadas.

La cobertura es el norte: el loop termina cuando cada partícula del censo tiene
sus cinco pruebas en verde y su evidencia archivada. No antes.
