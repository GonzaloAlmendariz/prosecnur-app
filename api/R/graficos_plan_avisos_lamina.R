#' Avisos de coherencia dentro de una lamina de varios graficos
#'
#' Una lamina de cuatro paneles se configura panel por panel, y el panel que no
#' se llega a configurar se queda con lo que traia: en el mazo de Contabilidad
#' cuatro `inferior_derecha` apuntaban todos a `p5`, uno de ellos a la base
#' equivocada y tres sin titulo. El motor los dibujaba sin decir nada, asi que
#' el defecto sobrevivio hasta el entregable: la lamina del estudiante mostraba
#' el grafico de Sexo dos veces, con dos tamanos distintos.
#'
#' Son avisos, no errores: repetir una variable dentro de una lamina puede ser
#' deliberado —el mismo dato con dos cortes— y romper la generacion por eso
#' seria peor que el defecto. Lo que no puede pasar es que nadie lo diga.
#'
#' @name graficos_plan_avisos_lamina
NULL


#' Base a la que pertenece una referencia `base$variable`
#'
#' Sin `$` no hay base declarada y devuelve `NA`: eso no es un defecto, es una
#' referencia que se resuelve contra la base activa.
#' @keywords internal
.plan_aviso_base_de_var <- function(var) {
  v <- as.character(var %||% "")[1]
  if (is.na(v) || !nzchar(v) || !grepl("$", v, fixed = TRUE)) return(NA_character_)
  sub("\\$.*$", "", v)
}


#' Avisos de una lamina con varios slots de grafico
#'
#' @param slots Lista nombrada slot -> lista del plan (con `$args`).
#' @param tag Etiqueta para el mensaje, p. ej. `"slide[9]"`.
#' @return Vector de avisos, vacio si la lamina esta bien.
#' @keywords internal
.plan_avisos_lamina <- function(slots, tag = "slide") {
  avisos <- character(0)
  slots <- slots[!vapply(slots, is.null, logical(1))]
  if (length(slots) < 2L) return(avisos)

  vars <- vapply(slots, function(s) {
    as.character((s$args %||% list())$var %||% "")[1]
  }, character(1))
  titulos <- vapply(slots, function(s) {
    a <- s$args %||% list()
    as.character((a$overrides %||% list())$titulo %||% a$titulo %||% "")[1]
  }, character(1))
  vars[is.na(vars)] <- ""
  titulos[is.na(titulos)] <- ""

  # 1) La misma variable dos veces en la misma lamina.
  con_var <- vars[nzchar(vars)]
  repetidas <- unique(con_var[duplicated(con_var)])
  for (v in repetidas) {
    donde <- names(slots)[vars == v]
    avisos <- c(avisos, sprintf(
      "%s: '%s' se grafica dos veces en la misma lamina (%s)",
      tag, v, paste(donde, collapse = ", ")
    ))
  }

  # 2) Un panel que trae datos de otra base que el resto de la lamina.
  bases <- vapply(vars, .plan_aviso_base_de_var, character(1))
  con_base <- bases[!is.na(bases)]
  if (length(con_base) > 1L) {
    tab <- table(con_base)
    mayoritaria <- names(tab)[which.max(tab)]
    for (k in seq_along(slots)) {
      b <- bases[[k]]
      if (!is.na(b) && !identical(b, mayoritaria)) {
        avisos <- c(avisos, sprintf(
          "%s: el panel '%s' grafica la base '%s' y el resto de la lamina es '%s'",
          tag, names(slots)[k], b, mayoritaria
        ))
      }
    }
  }

  # 3) Un panel sin titulo cuando sus companeros si lo tienen: en una lamina de
  # varios graficos el titulo es lo unico que dice cual es cual.
  if (any(nzchar(titulos))) {
    for (k in seq_along(slots)) {
      if (!nzchar(titulos[[k]]) && nzchar(vars[[k]])) {
        avisos <- c(avisos, sprintf(
          "%s: el panel '%s' no tiene titulo y los demas si",
          tag, names(slots)[k]
        ))
      }
    }
  }

  avisos
}
