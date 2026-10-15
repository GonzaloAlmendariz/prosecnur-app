# Histograma por grupos: el dibujo de Ing. Civil como estándar del motor (checklist-histograma-serie-antetitulo-2026-10-14.md, G1).
#
# Gonzalo (2026-10-14): «Ing Civil tenía funciones para hacer histogramas mucho más profesionales que creo que podemos
# integrar al motor y en consecuencia al recetario». El mazo de referencia (Histogramas_ingenierias_sin_lineas_grises,
# 13-07-2026) se armó con overrides a mano sobre `graficar_histograma()`; el preset del histograma, pensado para una sola
# serie, dejaba el por grupos con eje Y, grilla, cifras dentro de cada segmento y bins vacíos. Aquí esos overrides pasan a
# ser el dibujo por defecto cuando hay grupo. Lo que el analista declare en la lámina sigue mandando.

#' Estilo por defecto del histograma por grupos
#'
#' Una barra por valor apilada por grupo; sobre cada barra, una línea por grupo con su frecuencia y su porcentaje dentro
#' de la barra («H 24(45%)»); la composición del público en el subtítulo («Hombre 47% · Mujer 53%»); sin eje Y ni
#' grilla, porque las cifras ya están escritas; sin bins vacíos y con la leyenda abajo.
#' @keywords internal
.histograma_grupos_estilo <- function() {
  list(
    posicion_etiquetas = "cima",
    etiqueta_cima_modo = "porcentaje_grupo_conteos_grupo",
    etiqueta_cima_formato = "dos_lineas",
    etiqueta_cima_orden_grupo = "frecuencia_porcentaje",
    mostrar_frecuencia = TRUE,
    umbral_etiqueta = 0,
    size_etiqueta_cima = 3.7,
    lineheight_etiqueta_cima = 0.82,
    mostrar_resumen_grupos_subtitulo = TRUE,
    mostrar_bins_vacios = FALSE,
    mostrar_eje_y = FALSE,
    mostrar_leyenda = TRUE,
    leyenda_posicion = "abajo"
  )
}

#' Pone el estilo por grupos debajo de lo que declaró la lámina
#' @param overrides Overrides de la lámina.
#' @keywords internal
.histograma_con_estilo_grupos <- function(overrides) {
  utils::modifyList(.histograma_grupos_estilo(), overrides %||% list())
}
