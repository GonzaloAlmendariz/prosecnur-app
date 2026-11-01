# collection_territorial_formatos.R — los códigos de resultado del estudio y cómo salen
# las hojas de campo (checklist-formatos-campo D1; plan conjunto aprobado por Gonzalo el
# 31 oct). Campo anota cada visita con un código; salen impresos en la hoja de ruteo y se
# cuentan en la de consolidados.
#
# Núcleo con número y grupo fijos (igual en todos los estudios) y cuatro códigos propios:
#   1 No quiso participar · 4 Nadie en casa · 6 Fuera de cuota · 7 Inconclusa · 8 Efectiva
#   2, 3, 5 y 99 (ACNUR acogida usó el 3 para «miembros del hogar migrantes o refugiados»;
#   Ser Adolescente el 5 para «no hay persona de 18 a 25 años»).
# Todos los rótulos se editan (K1 del informe de brechas): el papel de acogida dice
# «Miembros del hogar ausentes» donde el núcleo decía «Nadie en casa». Lo que no cambia es
# qué número significa qué: el 8 es siempre la efectiva y el 99 la manzana no elegible.
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
.MTF_ROTULOS_DEFECTO <- c(stats::setNames(vapply(.MTF_NUCLEO, `[[`, "", "rotulo"), vapply(.MTF_NUCLEO, `[[`, "", "codigo")),
                          .MTF_EDITABLES)[.MTF_ORDEN]
.MTF_ROTULO_MAX <- 60L
# Columnas opcionales del registro de la hoja de consolidados (acogida las usa; Ser Adolescente no).
.MTF_EXTRAS_CONSOLIDADO <- c(manzana = "Mz.", nse = "NSE", hora_final = "Hora final")
.MTF_CRITERIO_MAX <- 40L

.mtf_txt <- function(x) {
  v <- if (is.null(x) || !length(x)) "" else as.character(unlist(x)[1])
  if (is.na(v)) "" else trimws(v)
}

# Lo guardado, normalizado al leer: lo que no tiene forma vuelve al valor por defecto.
.mtf_guardado <- function(s, campaign_id) {
  x <- s$material_territorial_formatos
  base <- list(rotulos = as.list(.MTF_ROTULOS_DEFECTO), con_99 = TRUE, columna_criterio = "", caras_ruteo = 2L,
               extras_consolidado = list(), revision = 0L)
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_TERRITORIAL_FORMATOS_SCHEMA) ||
      !identical(.mtf_txt(x$campaign_id), campaign_id)) return(base)
  rot <- base$rotulos
  for (k in names(.MTF_ROTULOS_DEFECTO)) {
    v <- .mtf_txt(x$rotulos[[k]])
    if (nzchar(v) && nchar(v) <= .MTF_ROTULO_MAX) rot[[k]] <- v
  }
  caras <- suppressWarnings(as.integer(.mtf_txt(x$caras_ruteo)))
  crit <- .mtf_txt(x$columna_criterio)
  list(rotulos = rot, con_99 = !identical(x$con_99, FALSE),
       columna_criterio = if (nchar(crit) <= .MTF_CRITERIO_MAX) crit else "",
       caras_ruteo = if (!is.na(caras) && caras %in% c(1L, 2L)) caras else 2L,
       extras_consolidado = as.list(intersect(names(.MTF_EXTRAS_CONSOLIDADO), as.character(unlist(x$extras_consolidado)))),
       revision = max(0L, suppressWarnings(as.integer(.mtf_txt(x$revision))), na.rm = TRUE))
}

# El catálogo efectivo, en orden: lo que leen las hojas y Monitoreo.
.mtf_catalogo <- function(g) {
  nucleo <- stats::setNames(.MTF_NUCLEO, vapply(.MTF_NUCLEO, `[[`, "", "codigo"))
  codigos <- list()
  for (k in .MTF_ORDEN) {
    if (identical(k, "99") && !isTRUE(g$con_99)) next
    grupo <- if (!is.null(nucleo[[k]])) nucleo[[k]]$grupo else if (identical(k, "99")) "manzana" else "no_aplicada"
    codigos[[length(codigos) + 1L]] <- list(codigo = k, rotulo = g$rotulos[[k]], grupo = grupo, editable = TRUE)
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
       codigos = .mtf_catalogo(g), editables = as.list(.MTF_ORDEN),
       # Todos los rótulos aunque el 99 esté apagado: la pantalla lo vuelve a prender con el suyo.
       rotulos = g$rotulos,
       con_99 = g$con_99, columna_criterio = g$columna_criterio, caras_ruteo = g$caras_ruteo,
       extras_consolidado = g$extras_consolidado,
       extras_disponibles = lapply(names(.MTF_EXTRAS_CONSOLIDADO), function(k) list(id = k, rotulo = .MTF_EXTRAS_CONSOLIDADO[[k]])),
       revision = g$revision)
}

#' Guarda los rótulos, el 99, la columna del criterio y las caras del ruteo.
#' Un código que no existe es 422; el número y el grupo no se cambian.
#' @keywords internal
collection_territorial_formatos_put <- function(sid, campaign_id = NULL, rotulos = list(), con_99 = NULL,
                                                columna_criterio = NULL, caras_ruteo = NULL, expected_revision = NULL,
                                                extras_consolidado = NULL) {
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
    if (!k %in% .MTF_ORDEN) {
      problemas[[length(problemas) + 1L]] <- list(codigo = k, motivo = "Ese código no existe")
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
  if (!is.null(extras_consolidado)) {
    pedidos <- as.character(unlist(extras_consolidado))
    raros <- setdiff(pedidos, names(.MTF_EXTRAS_CONSOLIDADO))
    if (length(raros)) {
      problemas[[length(problemas) + 1L]] <- list(campo = "extras_consolidado", motivo = sprintf("«%s» no es una columna opcional del consolidado", raros[[1]]))
    } else g$extras_consolidado <- as.list(intersect(names(.MTF_EXTRAS_CONSOLIDADO), pedidos))
  }
  if (length(problemas)) {
    stop_api(422, "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS",
             sprintf("%d cambio(s) no se pueden guardar.", length(problemas)), details = list(problemas = problemas))
  }
  session_set(sid, "material_territorial_formatos", list(
    schema = MATERIAL_TERRITORIAL_FORMATOS_SCHEMA, campaign_id = hit$entry$id, rotulos = g$rotulos,
    con_99 = g$con_99, columna_criterio = g$columna_criterio, caras_ruteo = g$caras_ruteo,
    extras_consolidado = g$extras_consolidado, revision = g$revision + 1L, updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  ))
  collection_territorial_formatos_get(sid, hit$entry$id)
}
