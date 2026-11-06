# El eje de fechas de la serie diaria de los PDF de avance.
#
# **Toda barra lleva su fecha, siempre** (Gonzalo, 2026-11-06: «la fecha del
# pdf puede hacerse más pequeña pero no debe dejar de mostrarse»). Antes el eje
# rotulaba como mucho 14 días en el gráfico general y 6 en los paneles por
# público, y el resto de las barras quedaban sin fecha. Es la misma regla que
# ya rige las cifras de las barras (`.ppd_cifras_de_barras`): lo que cede es el
# cuerpo, no el rótulo.
#
# El orden de lo que cede:
#   1. El cuerpo baja hasta que «dd/mm» cabe bajo su barra, sin pasar del piso
#      legible (`.PPD_PISO_FECHA`).
#   2. Lo que acompaña a la fecha —el día de la semana, «hasta 11:40» del día
#      en curso— se escribe sólo si cabe a ese cuerpo; la fecha no depende de
#      ello.
#   3. Si ni al piso «dd/mm» cabe en horizontal, se gira 90°: a lo ancho ocupa
#      sólo el alto de una línea.
#
# **Y tampoco diminuta** (Gonzalo, 2026-11-06: «debe haber un límite; si los
# días ya son demasiados, en vez de 3 en fila que sean 2, tampoco debe verse
# diminuto»). Por debajo del piso no se baja: cuando ni girada cabe, lo que
# cede es la rejilla de paneles (`.ppd_rejilla_que_cabe`), que pasa a menos
# columnas y gana hojas.

#' Cuerpo mínimo de una fecha del eje, en puntos.
#' @noRd
.PPD_PISO_FECHA <- 5.6

#' ¿Caben las fechas de `n` días en `ancho` npc, al menos giradas al piso?
#'
#' Girada, una fecha ocupa a lo ancho el alto de una línea (≈1,25 veces el
#' cuerpo). Puro: se decide antes de abrir el dispositivo.
#' @noRd
.ppd_eje_cabe <- function(ancho, n, geo = pulso_pdf_geo("landscape"), piso = .PPD_PISO_FECHA) {
  if (n <= 0L) return(TRUE)
  linea <- piso * 1.25 / 72 / geo$page_w
  ancho / n * 0.88 >= linea
}

#' La rejilla de paneles con tantas columnas como deje leer las fechas.
#'
#' Parte de la rejilla pedida y quita columnas mientras las fechas de cada panel
#' no quepan ni giradas al piso. Al quitar columnas, cada hoja lleva dos filas y
#' el reparto entre hojas es parejo, como en `.marp_rejilla_de_paneles()`.
#' @noRd
.ppd_rejilla_que_cabe <- function(rejilla, n_paneles, n_dias, ancho, hueco_x = 0.030,
                                  sangria = 0.026, geo = pulso_pdf_geo("landscape")) {
  ancho_panel <- function(k) (ancho - hueco_x * (k - 1L)) / k - sangria
  columnas <- rejilla$columnas
  if (.ppd_eje_cabe(ancho_panel(columnas), n_dias, geo)) return(rejilla)
  while (columnas > 1L && !.ppd_eje_cabe(ancho_panel(columnas), n_dias, geo)) columnas <- columnas - 1L
  n <- max(1L, as.integer(n_paneles))
  hojas <- max(1L, ceiling(n / (columnas * 2L)))
  list(columnas = columnas, hojas = hojas, por_hoja = max(1L, ceiling(n / hojas)))
}

# Ancho y alto de un rótulo al cuerpo dado, en npc de cada eje de la página.
# `alto_en_x` es lo que ocupa a lo ancho una línea girada 90°; `ancho_en_y`, lo
# que ocupa a lo alto.
.ppd_medir_rotulo <- function(texto, fontsize) {
  g <- grid::textGrob(texto, gp = grid::gpar(fontsize = fontsize))
  ancho_in <- grid::convertWidth(grid::grobWidth(g), "inches", valueOnly = TRUE)
  alto_in <- grid::convertHeight(grid::grobHeight(g), "inches", valueOnly = TRUE)
  c(
    ancho = grid::convertWidth(grid::unit(ancho_in, "inches"), "npc", valueOnly = TRUE),
    alto_en_x = grid::convertWidth(grid::unit(alto_in, "inches"), "npc", valueOnly = TRUE),
    ancho_en_y = grid::convertHeight(grid::unit(ancho_in, "inches"), "npc", valueOnly = TRUE)
  )
}

#' Cómo se rotula cada día del eje: texto, cuerpo y si va girado.
#'
#' @param dias rótulos completos («29/10\nmié»); la primera línea es la fecha.
#' @param hueco ancho de una jornada en npc.
#' @param fontsize cuerpo de partida.
#' @param piso cuerpo mínimo legible.
#' @param medir función `(texto, fontsize)` que devuelve `ancho` y `alto_en_x`.
#' @return lista con `textos` (uno por día, nunca vacío si la fecha no lo es),
#'   `fontsize` y `rotar`.
#' @noRd
.ppd_rotulos_de_fecha <- function(dias, hueco, fontsize, piso = .PPD_PISO_FECHA,
                                  medir = .ppd_medir_rotulo) {
  dias <- as.character(dias)
  if (!length(dias)) return(list(textos = character(0), fontsize = fontsize, rotar = FALSE))
  fechas <- sub("\n.*$", "", dias)
  piso <- min(piso, fontsize)
  # Un margen entre rótulos vecinos: tocarse no es caber.
  util <- hueco * 0.88
  cuerpos <- unique(c(seq(fontsize, piso, by = -0.2), piso))
  cuerpos <- cuerpos[cuerpos >= piso]
  mayor <- function(f, campo, textos) max(vapply(textos, function(t) medir(t, f)[[campo]], numeric(1)))

  for (f in cuerpos) {
    if (mayor(f, "ancho", fechas) <= util) {
      textos <- vapply(seq_along(dias), function(i) {
        if (identical(dias[[i]], fechas[[i]]) || medir(dias[[i]], f)[["ancho"]] <= util) dias[[i]] else fechas[[i]]
      }, character(1))
      return(list(textos = textos, fontsize = f, rotar = FALSE))
    }
  }
  for (f in cuerpos) {
    if (mayor(f, "alto_en_x", fechas) <= util) return(list(textos = fechas, fontsize = f, rotar = TRUE))
  }
  list(textos = fechas, fontsize = piso, rotar = TRUE)
}
