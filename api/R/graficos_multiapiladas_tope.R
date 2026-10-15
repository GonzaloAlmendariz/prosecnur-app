# Una multiapilada lleva a lo más seis barras (checklist-histograma-serie-antetitulo-2026-10-14.md, M1).
#
# Gonzalo (2026-10-14), ante «seis temas» repartidos en tres láminas de dos: «creo que el máximo pueden ser 6 barras
# para seguir asegurando que se vea bien […] para evitar ello mejor limitamos multiapiladas a 6 barras únicamente».
# Seis barras es lo que cabe en una lámina del estándar sin adelgazar la barra ni apretar las cifras chicas (dos temas
# de tres públicos, o seis preguntas). El editor no deja pasar de ahí; el motor, para un plan anterior a la regla,
# sigue partiendo en «(cont.)» pero lo avisa con la cifra y lo que hay que hacer.

.MULTIAPILADAS_MAX_BARRAS <- 6L

#' Avisa una multiapilada con más barras de las que admite una lámina
#' @param n_barras Barras que dibuja la lámina (filas de la escala, sin la Total).
#' @keywords internal
.multiapiladas_aviso_tope <- function(n_barras) {
  n_barras <- suppressWarnings(as.integer(n_barras)[1])
  if (is.na(n_barras) || n_barras <= .MULTIAPILADAS_MAX_BARRAS) return(invisible(FALSE))
  .pulso_aviso(.aviso_en_lamina(sprintf(
    "la multiapilada tiene %d barras y el máximo es %d: divídela en láminas de hasta %d barras.",
    n_barras, .MULTIAPILADAS_MAX_BARRAS, .MULTIAPILADAS_MAX_BARRAS)))
  invisible(TRUE)
}
