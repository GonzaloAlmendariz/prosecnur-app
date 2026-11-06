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
#      legible (4,6 pt).
#   2. Lo que acompaña a la fecha —el día de la semana, «hasta 11:40» del día
#      en curso— se escribe sólo si cabe a ese cuerpo; la fecha no depende de
#      ello.
#   3. Si ni al piso «dd/mm» cabe en horizontal, se gira 90°: a lo ancho ocupa
#      sólo el alto de una línea.

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
.ppd_rotulos_de_fecha <- function(dias, hueco, fontsize, piso = 4.6,
                                  medir = .ppd_medir_rotulo) {
  dias <- as.character(dias)
  if (!length(dias)) return(list(textos = character(0), fontsize = fontsize, rotar = FALSE))
  fechas <- sub("\n.*$", "", dias)
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
