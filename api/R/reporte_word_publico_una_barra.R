# =============================================================================
# reporte_word_publico_una_barra.R — el público a la izquierda de la barra en la figura de UN público (R2, Arte 2026-10-27)
# =============================================================================
#
# Renzo Segura (informe de Arte): el Gráfico 74 (Sí/No de estudiantes) lleva «Estudiantes» a la izquierda de la barra y
# los Gráficos 49 (Sí/No, 115 docentes) y 50 (escala de una premisa, 77 docentes) no llevaban «Docentes»: «sí, para
# estandarizar, así puse los demás». Causa: el 74 sale de una multiapilada (`var_cruce`), cuya fila se rotula con el
# público; el 49 y el 50 salen de elementos sueltos (`p_barras_agrupadas` / `p_barras_apiladas`, aquí las dos piezas de
# la lámina con dependencia, reporte_word_filtro_sub.R) cuya fila única va sin rótulo en el Word
# (`word_ocultar_etiqueta_categoria`: el título ya dice la pregunta). La dicotomía del Word (`.word_g_sino_estandar`)
# ni siquiera tenía columna de rótulos.
#
# Regla: la figura Word de un elemento de UNA variable de una base con nombre visible (`docentes$p18`; la base interna
# «default» no se nombra, `.base_nombre_visible`) y UNA barra —Sí/No o escala de una premisa— lleva ese público a la
# izquierda, con la letra y la columna de la escala (las del Gráfico 74). Sólo presentación: no cambia grano, filtros,
# denominadores ni el pie. Sólo la espec del Word: la lámina del PPT no se toca (cumple su propio estándar).

#' Nombre del público de un elemento de una sola serie, o "" si no aplica
#'
#' Una variable calificada con su base (`fuente$variable`), sin `vars` ni cruces. El nombre es el de la base sin guiones
#' bajos y en tipo título, como la fila de la multiapilada (`.pretty_source_label`).
#' @param el Elemento del plan (`ppt_element`).
#' @keywords internal
.word_publico_una_barra <- function(el) {
  if (!is.list(el)) return("")
  if (length(unlist(el$vars, use.names = FALSE))) return("")
  cruces <- c(unlist(el$cruces, use.names = FALSE), unlist((el$overrides %||% list())$cruces, use.names = FALSE), unlist(el$cruce, use.names = FALSE))
  if (length(cruces[!is.na(cruces) & nzchar(trimws(as.character(cruces)))])) return("")
  ref <- as.character(unlist(el$var, use.names = FALSE))
  ref <- ref[!is.na(ref) & nzchar(trimws(ref))]
  if (length(ref) != 1L || !grepl("$", ref, fixed = TRUE)) return("")
  fuente <- .base_nombre_visible(sub("\\$.*$", "", ref))
  if (!nzchar(fuente)) return("")
  tools::toTitleCase(gsub("_+", " ", trimws(fuente)))
}

#' Marca la figura Word de un elemento de un solo público para que rotule su barra con el público
#'
#' Escala de una fila sin rótulo: el rótulo de la fila pasa a ser el público. Dicotomía (categórica Sí/No): la espec
#' lleva `publico_word`, que `.word_g_sino_estandar` dibuja a la izquierda. Cualquier otra figura queda igual.
#' @param p Gráfico Word del elemento (con `pulso_espec`).
#' @param el Elemento del plan.
#' @return `p`, con su espec marcada si aplica (copia; la del PPT no se muta).
#' @keywords internal
.word_publico_marcar <- function(p, el) {
  pub <- tryCatch(.word_publico_una_barra(el), error = function(e) "")
  if (!nzchar(pub)) return(p)
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (!is.list(espec)) return(p)
  tipo <- as.character(espec$tipo %||% "")[1]
  if (identical(tipo, "escala") && NROW(espec$filas) == 1L && !isTRUE(espec$filas$es_total[1])) {
    rot <- as.character(espec$filas$rotulo[1])
    if (!is.na(rot) && nzchar(trimws(rot))) return(p)   # la fila ya dice algo (rótulo declarado): manda
    espec$filas$rotulo[1] <- pub
  } else if (identical(tipo, "categorica") && isTRUE(.lam_es_dicotomia(espec))) {
    espec$publico_word <- pub
  } else {
    return(p)
  }
  attr(p, "pulso_espec") <- espec
  p
}

#' Columna del público de la dicotomía del Word: la geometría de la escala de una fila (`.word_g_escala`)
#'
#' @param espec Espec de la dicotomía.
#' @return `NULL` sin público; si no, `list(xmin, xmax, capa)` para el eje x y el rótulo.
#' @keywords internal
.word_sino_publico <- function(espec) {
  pub <- as.character(espec$publico_word %||% "")[1]
  if (is.na(pub) || !nzchar(trimws(pub))) return(NULL)
  pt_rot <- .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo")
  lbw <- .word_escala_rotulos_envueltos(pub, .WORD_ESCALA_ENVOLTURA)
  L <- .word_escala_columna(.word_rotulo_in(lbw, pt_rot), lbw)
  list(xmin = .word_xmin(lbw, pt_rot, 101, -4, ancho_in = L), xmax = 101,
       capa = ggplot2::annotate("text", x = -4, y = 0.5, label = lbw, hjust = 1, size = .word_pt(.WORD_ESCALA_PT$rotulo_fila, "rotulo"),
                                fontface = .word_cara("preguntas"), colour = .std_word("colores", "titulos"), family = "Arial", lineheight = 0.9))
}
