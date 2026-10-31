# collection_territorial_formatos.R — los códigos de resultado del estudio y cómo salen
# las hojas de campo (checklist-formatos-campo D1; plan conjunto aprobado por Gonzalo el
# 31 oct). Campo anota cada visita con un código; salen impresos en la hoja de ruteo y se
# cuentan en la de consolidados.
#
# Núcleo fijo (igual en todos los estudios) y cuatro rótulos que el estudio ajusta:
#   1 No quiso participar · 4 Nadie en casa · 6 Fuera de cuota · 7 Inconclusa · 8 Efectiva
#   2, 3, 5 y 99 editables (ACNUR acogida usó el 3 para «miembros del hogar migrantes o
#   refugiados»; Ser Adolescente el 5 para «no hay persona de 18 a 25 años»).
# Además: si se usa el 99, la columna del criterio de elegibilidad del estudio (vacía = no
# hay) y cuántas caras lleva la hoja de ruteo. Nacen aquí y se mudan al Planner cuando
# exista (ADR del Planner, P9); por eso la lectura es pura y la expone un GET.

MATERIAL_TERRITORIAL_FORMATOS_SCHEMA <- "material_territorial_formatos/v1"

.MTF_NUCLEO <- list(
  list(codigo = "1", rotulo = "No quiso participar", grupo = "no_aplicada"),
  list(codigo = "4", rotulo = "Nadie en casa", grupo = "no_aplicada"),
  list(codigo = "6", rotulo = "Fuera de cuota (sexo o edad)", grupo = "no_aplicada"),
  list(codigo = "7", rotulo = "Encuesta inconclusa", grupo = "no_aplicada"),
  list(codigo = "8", rotulo = "Encuesta efectiva", grupo = "efectiva")
)
.MTF_EDITABLES <- c(`2` = "Vivienda desocupada", `3` = "Vivienda inaccesible",
                    `5` = "No hay persona elegible", `99` = "Manzana no elegible (terreno, parque)")
.MTF_ORDEN <- c("1", "2", "3", "4", "5", "6", "7", "8", "99")
.MTF_ROTULO_MAX <- 60L
.MTF_CRITERIO_MAX <- 40L

.mtf_txt <- function(x) {
  v <- if (is.null(x) || !length(x)) "" else as.character(unlist(x)[1])
  if (is.na(v)) "" else trimws(v)
}

# Lo guardado, normalizado al leer: lo que no tiene forma vuelve al valor por defecto.
.mtf_guardado <- function(s, campaign_id) {
  x <- s$material_territorial_formatos
  base <- list(rotulos = as.list(.MTF_EDITABLES), con_99 = TRUE, columna_criterio = "", caras_ruteo = 2L, revision = 0L)
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_TERRITORIAL_FORMATOS_SCHEMA) ||
      !identical(.mtf_txt(x$campaign_id), campaign_id)) return(base)
  rot <- base$rotulos
  for (k in names(.MTF_EDITABLES)) {
    v <- .mtf_txt(x$rotulos[[k]])
    if (nzchar(v) && nchar(v) <= .MTF_ROTULO_MAX) rot[[k]] <- v
  }
  caras <- suppressWarnings(as.integer(.mtf_txt(x$caras_ruteo)))
  crit <- .mtf_txt(x$columna_criterio)
  list(rotulos = rot, con_99 = !identical(x$con_99, FALSE),
       columna_criterio = if (nchar(crit) <= .MTF_CRITERIO_MAX) crit else "",
       caras_ruteo = if (!is.na(caras) && caras %in% c(1L, 2L)) caras else 2L,
       revision = max(0L, suppressWarnings(as.integer(.mtf_txt(x$revision))), na.rm = TRUE))
}

# El catálogo efectivo, en orden: lo que leen las hojas y Monitoreo.
.mtf_catalogo <- function(g) {
  nucleo <- stats::setNames(.MTF_NUCLEO, vapply(.MTF_NUCLEO, `[[`, "", "codigo"))
  codigos <- list()
  for (k in .MTF_ORDEN) {
    if (identical(k, "99") && !isTRUE(g$con_99)) next
    codigos[[length(codigos) + 1L]] <- if (!is.null(nucleo[[k]])) {
      c(nucleo[[k]], list(editable = FALSE))
    } else {
      list(codigo = k, rotulo = g$rotulos[[k]], grupo = if (identical(k, "99")) "manzana" else "no_aplicada", editable = TRUE)
    }
  }
  codigos
}

#' Códigos de resultado y formato de las hojas de la campaña territorial (lectura pura).
#' @keywords internal
collection_territorial_formatos_get <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  g <- .mtf_guardado(s, hit$entry$id)
  list(ok = TRUE, campaign_id = hit$entry$id, schema = MATERIAL_TERRITORIAL_FORMATOS_SCHEMA,
       codigos = .mtf_catalogo(g), editables = as.list(names(.MTF_EDITABLES)),
       # Los cuatro rótulos editables aunque el 99 esté apagado: la pantalla lo vuelve a prender con el suyo.
       rotulos = g$rotulos,
       con_99 = g$con_99, columna_criterio = g$columna_criterio, caras_ruteo = g$caras_ruteo,
       revision = g$revision)
}

#' Guarda los rótulos editables, el 99, la columna del criterio y las caras del ruteo.
#' El núcleo no se edita: un rótulo para 1, 4, 6, 7 u 8 es 422.
#' @keywords internal
collection_territorial_formatos_put <- function(sid, campaign_id = NULL, rotulos = list(), con_99 = NULL,
                                                columna_criterio = NULL, caras_ruteo = NULL, expected_revision = NULL) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  g <- .mtf_guardado(s, hit$entry$id)
  if (!is.null(expected_revision) && length(expected_revision)) {
    esperada <- suppressWarnings(as.integer(unlist(expected_revision)[1]))
    if (is.na(esperada) || !identical(esperada, g$revision)) {
      stop_api(409, "E_COLLECTION_TERRITORIAL_FORMATOS_STALE", "Los códigos cambiaron desde que se abrió la pantalla.",
               details = list(expected = if (is.na(esperada)) NULL else esperada, current = g$revision))
    }
  }
  problemas <- list()
  rotulos <- if (is.list(rotulos)) rotulos else list()
  for (k in names(rotulos)) {
    v <- .mtf_txt(rotulos[[k]])
    if (!k %in% names(.MTF_EDITABLES)) {
      problemas[[length(problemas) + 1L]] <- list(codigo = k, motivo = "Ese código es del núcleo y no se edita")
    } else if (!nzchar(v) || nchar(v) > .MTF_ROTULO_MAX) {
      problemas[[length(problemas) + 1L]] <- list(codigo = k, motivo = sprintf("El rótulo debe tener entre 1 y %d caracteres", .MTF_ROTULO_MAX))
    } else {
      g$rotulos[[k]] <- v
    }
  }
  if (!is.null(columna_criterio)) {
    crit <- .mtf_txt(columna_criterio)
    if (nchar(crit) > .MTF_CRITERIO_MAX) {
      problemas[[length(problemas) + 1L]] <- list(campo = "columna_criterio", motivo = sprintf("Máximo %d caracteres", .MTF_CRITERIO_MAX))
    } else g$columna_criterio <- crit
  }
  if (!is.null(caras_ruteo)) {
    caras <- suppressWarnings(as.integer(.mtf_txt(caras_ruteo)))
    if (is.na(caras) || !caras %in% c(1L, 2L)) {
      problemas[[length(problemas) + 1L]] <- list(campo = "caras_ruteo", motivo = "La hoja de ruteo lleva 1 o 2 caras")
    } else g$caras_ruteo <- caras
  }
  if (!is.null(con_99)) g$con_99 <- isTRUE(as.logical(unlist(con_99)[1]))
  if (length(problemas)) {
    stop_api(422, "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS",
             sprintf("%d cambio(s) no se pueden guardar.", length(problemas)), details = list(problemas = problemas))
  }
  session_set(sid, "material_territorial_formatos", list(
    schema = MATERIAL_TERRITORIAL_FORMATOS_SCHEMA, campaign_id = hit$entry$id, rotulos = g$rotulos,
    con_99 = g$con_99, columna_criterio = g$columna_criterio, caras_ruteo = g$caras_ruteo,
    revision = g$revision + 1L, updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  ))
  collection_territorial_formatos_get(sid, hit$entry$id)
}
