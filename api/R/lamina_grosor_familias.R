# =============================================================================
# lamina_grosor_familias.R — las láminas gemelas de un mazo salen con la misma barra (B4, decisión del lead: opción A)
# =============================================================================
#
# El estándar de la casa (Contabilidad, luego Arte) es una barra del mismo grosor en láminas iguales. La escala y la
# multilista engrosan la barra hasta el grosor de Contabilidad con el alto que les sobra (`.lam_escala_engrosar_busca`,
# ítems 4–5 aprobados); el alto que sobra depende de cuánto ocupan los enunciados, así que dos láminas con el mismo número
# de barras salían a 0.44 y 0.57 in (`verificar_mazo`, B4 "gemelas desiguales": cuatro familias en Arte).
#
# Sin una pasada de medición aparte: medir antes de dibujar exigía renderizar los gráficos dos veces (+72 % del render de
# Arte, 35 s de 48 s son de datos y ggplot). En cambio, cada lámina se compone como siempre y anota su grosor y una forma
# de recomponerse (sólo el lienzo, sin volver a calcular datos). Al cierre del mazo (`.lam_avisos_cierre`), por familia
# (misma firma, dos o más láminas) se toma el grosor mínimo y las láminas más gruesas se recomponen con ese
# tope: su grupo de formas se reemplaza en su lugar. Una lámina sin gemela conserva su engrosamiento. La familia es la
# firma de la lámina: sus barras de escala (las Sí/No no cuentan, como en `verificar_mazo`); sin escalas, sus barras Sí/No.

.LAM_GF <- new.env(parent = emptyenv())

#' Vacía el registro (al empezar y al soltar el mazo)
#' @keywords internal
.lam_gf_vaciar <- function() { .LAM_GF$laminas <- list(); invisible(NULL) }

#' Tope de grosor vigente mientras se recompone una gemela (in), o `NULL`
#' @keywords internal
.lam_gf_tope <- function() getOption("prosecnur.lam_gf_tope")

#' Anota en el lienzo el grosor de barra que dibuja y el número de barras de su lámina (lo lee el compositor al agrupar)
#' @keywords internal
.lam_gf_anotar <- function(lz, grosor, filas, ncat = NA_integer_) {
  if (!is.environment(lz) || !is.finite(grosor) || !is.finite(filas)) return(invisible(lz))
  lz$gf_grosor <- max(lz$gf_grosor %||% 0, grosor)
  # La firma cuenta las barras de escala (más de dos categorías) aparte de las Sí/No: lo que el lector compara de una
  # lámina a otra son las barras de la escala, como las cuenta `verificar_mazo` (B4).
  if (isTRUE(ncat > 2L)) lz$gf_escala <- (lz$gf_escala %||% 0) + filas else lz$gf_dic <- (lz$gf_dic %||% 0) + filas
  invisible(lz)
}

#' Firma de familia de un lienzo: las barras de escala; si no tiene, las Sí/No
#' @keywords internal
.lam_gf_firma <- function(lz) {
  if (isTRUE((lz$gf_escala %||% 0) > 0)) paste0("escala:", lz$gf_escala) else paste0("si_no:", lz$gf_dic %||% 0)
}

#' Registra una lámina compuesta en el mazo en curso
#'
#' @param doc El documento: la lámina es la última agregada. @param lz El lienzo ya agrupado (con su anotación).
#' @param nombre Nombre del grupo de formas que se reemplaza. @param rehacer `function()` que devuelve el lienzo recompuesto
#'   (se llama con `prosecnur.lam_gf_tope` fijado).
#' @keywords internal
.lam_gf_registrar <- function(doc, lz, nombre, rehacer) {
  if (!inherits(doc, "rpptx") || !.lam_avisos_activo() || is.null(lz$gf_grosor)) return(invisible(NULL))
  .LAM_GF$laminas[[length(.LAM_GF$laminas) + 1L]] <- list(idx = length(doc), grosor = lz$gf_grosor, nombre = nombre, firma = .lam_gf_firma(lz),
                                                         rehacer = rehacer)
  invisible(NULL)
}

#' Familias del registro: por firma (barras de escala, o Sí/No si no hay escala), las de dos o más láminas, con su grosor mínimo
#' @return data.frame `firma`, `minimo`, `n`.
#' @keywords internal
.lam_gf_familias <- function(laminas = .LAM_GF$laminas) {
  if (!length(laminas)) return(data.frame(firma = character(0), minimo = numeric(0), n = integer(0)))
  fi <- vapply(laminas, `[[`, "", "firma"); gr <- vapply(laminas, `[[`, 0, "grosor")
  f <- stats::aggregate(gr, list(firma = fi), function(x) c(minimo = min(x), n = length(x)))
  out <- data.frame(firma = f$firma, minimo = f$x[, "minimo"], n = as.integer(f$x[, "n"]), stringsAsFactors = FALSE)
  out[out$n >= 2L, , drop = FALSE]
}

#' Al cierre del mazo: las gemelas más gruesas que el mínimo de su familia se recomponen con ese tope, en su lugar
#' @return El número de láminas recompuestas.
#' @keywords internal
.lam_gf_cerrar <- function(doc) {
  laminas <- .LAM_GF$laminas; on.exit(.lam_gf_vaciar(), add = TRUE)
  if (!inherits(doc, "rpptx") || length(laminas) < 2L) return(invisible(0L))
  fam <- .lam_gf_familias(laminas)
  hechas <- 0L
  for (L in laminas) {
    k <- match(L$firma, fam$firma)
    if (is.na(k) || L$grosor <= fam$minimo[k] + 0.003) next
    op <- options(prosecnur.lam_gf_tope = fam$minimo[k])
    lz <- tryCatch(L$rehacer(), error = function(e) NULL)
    options(op)
    if (is.null(lz) || !length(lz$formas)) next
    doc <- officer::on_slide(doc, L$idx)
    slide <- doc$slide$get_slide(doc$cursor)$get()
    viejo <- xml2::xml_find_all(slide, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='%s']]", L$nombre))
    if (length(viejo) != 1L) next   # sin el grupo a la vista no se toca la lámina
    xml2::xml_remove(viejo)
    doc <- .lam_agrupar(doc, lz, nombre = L$nombre)
    hechas <- hechas + 1L
  }
  if (length(doc)) doc <- officer::on_slide(doc, length(doc))
  invisible(hechas)
}
