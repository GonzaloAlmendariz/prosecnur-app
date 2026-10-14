# Dependencia entre los dos gráficos de una lámina (Gonzalo, 2026-10-14: «la dependencia no es un tipo de gráfico sino que
# cuando hay dos gráficos en un solo slide se puede establecer dependencia entre gráficos»).
#
# Una lámina de dos gráficos declara en su `meta` cuál depende de cuál y qué respuestas lo habilitan:
#   meta$dependencia = list(de = "izquierda", habilita = c("Sí"), frase = "que trabajan")   # `frase`, opcional
# El otro gráfico es el dependiente: su base pasa a ser la de quienes dieron una de esas respuestas, y la lámina se dibuja
# como el recetario (p192–p194): la llave sobre lo que habilita y su título «Sólo los 20 que respondieron «Sí»». Los dos
# gráficos conservan su tipo y sus ajustes. Lado a lado (`p_slide_2_graficos`), al costado; uno sobre otro
# (`p_slide_2_graficos_vertical`), abajo.
#
# Al reconstruir la lámina, la de dos gráficos con dependencia se compone como una lámina de un gráfico con la pieza interna
# `p_filtro_subpregunta`, que recibe los dos gráficos tal cual (graficos_filtro_subpregunta.R).

.DEPENDENCIA_LAMINAS <- list(
  p_slide_2_graficos = list(slots = c("izquierda", "derecha"), disposicion = "costado"),
  p_slide_2_graficos_vertical = list(slots = c("superior", "inferior"), disposicion = "abajo")
)

#' La dependencia declarada de una lámina (JSON del plan), o `NULL` si no hay una válida
#' @keywords internal
.dependencia_de <- function(s) {
  s <- as.list(s)
  conf <- .DEPENDENCIA_LAMINAS[[as.character(s$tipo %||% "")[1]]]
  if (is.null(conf)) return(NULL)
  pl <- .as_json_list(s$payload) %||% list()
  dep <- (.as_json_list(pl$meta) %||% list())$dependencia
  if (!is.list(dep)) return(NULL)
  de <- as.character(unlist(dep$de) %||% "")[1]
  habilita <- trimws(as.character(unlist(dep$habilita %||% character(0))))
  habilita <- habilita[!is.na(habilita) & nzchar(habilita)]
  if (!(de %in% conf$slots) || !length(habilita)) return(NULL)
  a <- setdiff(conf$slots, de)
  if (is.null(pl[[de]]) || is.null(pl[[a]])) return(NULL)
  frase <- trimws(as.character(unlist(dep$frase) %||% "")[1])
  list(de = de, a = a, habilita = habilita, disposicion = conf$disposicion, frase = if (!is.na(frase) && nzchar(frase)) frase)
}

#' La lámina de dos gráficos con dependencia, compuesta como una lámina de un gráfico con la pieza `p_filtro_subpregunta`
#' @keywords internal
.dependencia_como_lamina <- function(s) {
  d <- .dependencia_de(s)
  if (is.null(d)) return(s)
  s <- as.list(s); pl <- .as_json_list(s$payload) %||% list()
  grafico <- list(graficador = "p_filtro_subpregunta",
                  args = list(independiente = pl[[d$de]], dependiente = pl[[d$a]], habilita = as.list(d$habilita),
                              disposicion = d$disposicion, frase = d$frase))
  meta <- .as_json_list(pl$meta) %||% list(); meta$dependencia <- NULL
  nuevo <- list(grafico = grafico, titulo = pl$titulo, base = pl$base, pie = pl$pie)
  if (length(meta)) nuevo$meta <- meta
  s$tipo <- "p_slide_1_grafico"
  s$payload <- nuevo[!vapply(nuevo, is.null, TRUE)]
  s
}

#' Un gráfico del plan (JSON o elemento ya construido) como elemento del motor
#' @keywords internal
.dependencia_elemento <- function(x) {
  if (inherits(x, "ppt_element")) return(x)
  if (is.list(x) && !is.null(x$graficador)) return(.graficos_rebuild_graf_json(x))
  .plan_spec_abort("La dependencia necesita los dos gráficos de la lámina.")
}
