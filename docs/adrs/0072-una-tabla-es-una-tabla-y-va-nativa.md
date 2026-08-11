# ADR 0072 — Una tabla es una tabla, y va nativa

- **Estado**: Aceptada
- **Fecha**: 2026-08-11
- **Ámbito**: Entregables (motor PPT · graficadores)
- **Relación**: precisa el alcance del **ADR 0071**, que no queda revertido.

## Contexto

El ADR 0071 decidió que el motor **no emite charts nativos**: los gráficos
siguen siendo formas. Su razón es concreta y sigue vigente — PowerPoint centra
cada etiqueta en su segmento y no la mueve nunca, así que en una escala Likert
con colas de 1–2 % colisionan siempre, y el deck de referencia necesitó
`manualLayout` en 62 de sus 91 etiquetas.

Esa decisión se estaba leyendo de más. En el registro de QA quedó anotado como
«0 tablas nativas en todo el mazo — contradice el ADR 0071», y de ahí se
concluyó que hacerlas nativas exigía revertirlo. **No es así**: el 0071 habla de
*charts*, y su razón —el reposicionamiento automático de etiquetas— no tiene
equivalente en una tabla. Una tabla no tiene etiquetas que colisionen; tiene
filas y columnas.

La confusión tenía además un contraejemplo delante: la **tabla de ficha
técnica** ya se emite nativa, con `flextable`, en
`.make_technical_table_flextable()` (`reporte_plan_ppt.R:807`). El motor sabe
hacerlo y lo hace en un sitio.

Donde no lo hace es en la **tabla de apoyo del radar**, que se dibuja dentro del
canvas de ggplot. El coste de esa decisión está a la vista en su propia API:
`tabla_padding_mm`, `tabla_firstcol_wrap`, `tabla_wrap_header`,
`tabla_height_frac`, `tabla_auto_fit`, `tabla_fit_pad`, `tabla_allow_upscale`,
`tabla_clip`… una veintena de parámetros que existen para resolver a mano lo
que un motor de tablas resuelve solo, y que aun así dependen de que el analista
los ajuste por lámina.

## Decisión

**Toda tabla del entregable se emite como tabla nativa de PowerPoint**, con el
mismo mecanismo que la ficha técnica.

Una tabla dibujada como geometría deja de ser aceptable, sea de apoyo a un
gráfico o autónoma. Si el contenido es una rejilla de filas y columnas, es una
tabla y se emite como tal.

El ADR 0071 **no se revierte**: los gráficos siguen siendo formas por la razón
que allí se documenta. Lo que este ADR fija es que aquella decisión nunca
abarcó las tablas, y que confundirlas cuesta editabilidad sin comprar nada.

## Consecuencias

- El cliente puede editar la tabla en PowerPoint: cambiar un valor, ajustar un
  ancho, aplicar un estilo. Con geometría no podía, y era la queja más
  frecuente sobre el entregable.
- Los parámetros de dibujo a mano de la tabla del radar quedan **obsoletos**. No
  se borran de golpe: se mantienen leídos para no romper proyectos guardados,
  pero dejan de gobernar el render y desaparecen de la superficie de edición.
- El alto de la tabla lo decide PowerPoint, no el canvas. Eso quita el
  `tabla_auto_fit` y el `tabla_clip`, que existían porque el canvas no sabía
  cuánto iba a ocupar el texto.
- La tabla deja de escalar con el gráfico. Es una ganancia: hoy, al encoger el
  radar, la tabla encogía con él y su letra caía por debajo de lo legible.
- Aparece una dependencia real de `flextable` para el radar. Ya está declarada
  y en uso por la ficha técnica, así que no cambia `api/DESCRIPTION`.

## Evidencia

`.make_technical_table_flextable()` emite `flextable` y el `.pptx` resultante
contiene `<a:tbl>`. El barrido del mazo de acreditación
(`V3_Conta 11-08 equivalencias`, 67 láminas) devuelve **0 elementos `<a:tbl>`**:
ninguna lámina del mazo lleva tabla nativa hoy, incluidas las dos del radar
(láminas 47 y 48), cuya tabla de seis filas por tres columnas es geometría.
