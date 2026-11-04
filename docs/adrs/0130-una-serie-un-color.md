# ADR 0130: Una serie, un color

Estado: Aceptado (Gonzalo, 2026-11-04, revisión del PPT v7 de CCSS, láminas 20, 22, 31 y 46: «no entiendo por qué usamos paleta de colores y es barras agrupadas»)

Fecha: 2026-11-04

Acota: [ADR 0097](0097-la-paleta-por-lista-llega-a-toda-lamina.md).

## Contexto

Según el ADR 0097, la paleta que el estudio define para una lista de opciones llega a toda lámina nativa y al Word. En una barra agrupada de una sola serie, eso pinta cada barra con el color de su opción. Ahí el color no codifica nada, porque cada opción ya tiene su barra y su rótulo. Para el lector, distintos colores sugieren categorías distintas, como una leyenda que no existe. El recetario dice que todas las barras van en un color y que resaltar la mayor es una opción del gráfico, no la regla.

Las paletas por lista existen sobre todo para los gráficos donde las opciones son series (apiladas, cruces con leyenda, torta o dona). En esos sí codifican.

## Decisión

- La barra agrupada de una sola serie va en un color por defecto, aunque la lista tenga paleta, tanto en la lámina nativa como en el ggplot y el Word.
- El mando nuevo `colorear_por_opcion` («Un color por opción», apagado por defecto) recupera la paleta de la lista para ese gráfico.
- No cambian:
  - `residuales_gris`: «Otros», «No sabe» y «Ninguna» siguen en gris cuando se pide;
  - el resaltado de la mayor;
  - los gráficos donde la paleta codifica series, como apiladas, cruces, torta, dona, divergentes y dicotomía.
- Los graficadores que no declaran el campo en su espec siguen el ADR 0097 tal cual.

## Consecuencias

- En CCSS, las agrupadas de una serie de nivel educativo, horas y autodefinición quedan monocromas.
- El contrato de `test-paletas-por-lista-laminas.R` cambia: la agrupada de una serie lleva la paleta solo con `colorear_por_opcion = TRUE`.
- Queda pendiente revisar si `p_barras_categoricas` y el ranking con puntos deben seguir la misma regla. Hoy siguen el 0097.

## Cumplimiento

`api/R/graficador_barras_agrupadas.R` (arg y espec), `api/R/graficos_paleta_resolver.R` (`.paleta_en_espec`), `api/R/graficos_metadata.R` (mando) y `api/tests/testthat/test-paletas-por-lista-laminas.R`.
