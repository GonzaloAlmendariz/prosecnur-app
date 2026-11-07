# ¿Existen las tablas de seguimiento que Material construyó en el Sheets?
#
# Regla de Gonzalo (2026-11-02, a Hojas): «Se construyen en material pero se
# leen y se da seguimiento en monitoreo, Monitoreo además comprueba que se
# creó» (ADR 0125, «Material arma, Monitoreo sigue»).
#
# La comprobación lee los NOMBRES DE PESTAÑA del documento, no el `updated_at`
# del destino: ese sello se graba al recordar el enlace, ANTES de publicar, y
# queda aunque la publicación falle. Material lee el mismo endpoint para que su
# tarjeta diga «construidas» o «faltan X»: los dos lados leen lo mismo.

#' Lee los títulos de las pestañas de un Sheets sin tragarse el error.
#'
#' A diferencia de `.malp_titulos_remotos()`, que devuelve `character(0)` ante
#' cualquier falla, aquí un documento ilegible NO es «sin pestañas»: decir
#' «faltan todas» porque no hubo token o red sería afirmar algo no medido.
#' @return `list(titulos, error)`; `titulos` es `NULL` si no se pudo leer.
#' @keywords internal
.matc_titulos <- function(spreadsheet_id) {
  tryCatch({
    meta <- .monitoreo_sheets_metadata(spreadsheet_id)
    list(
      titulos = vapply(meta$sheets %||% list(),
                       function(h) .monitoreo_scalar((h$properties %||% list())$title, ""),
                       character(1)),
      error = ""
    )
  }, error = function(e) list(titulos = NULL, error = conditionMessage(e)))
}

#' Las pestañas que el libro de aulas debe traer: las del equipo y las de la
#' app que se publican siempre. Las condicionales (asignación, disponibilidad,
#' controles) no entran: su ausencia no dice que el libro falte.
#' @keywords internal
.matc_hojas_del_libro <- function() c(.malp_hojas_equipo(), .malp_hojas_app())

#' El id pelado del destino guardado en un bloque `*_sheets`, o `""`.
#' @keywords internal
.matc_destino <- function(bloque) {
  .monitoreo_extract_spreadsheet_id(.monitoreo_scalar((bloque %||% list())[["spreadsheet_id"]], ""))
}

#' Comprueba que el libro y la distribución de aulas existen en el Sheets.
#'
#' @param cfg config de monitoreo completa.
#' @param titulos_de lector de títulos (inyectable para los tests, sin red).
#' @return `list(libro = list(destino, url, existe, faltan, error),
#'   distribucion = list(destino, url, existe, semanas, error))`. `existe` es
#'   `NA` cuando hay destino pero no se pudo leer.
#' @keywords internal
monitoreo_aulas_tablas_construidas <- function(cfg = list(), titulos_de = .matc_titulos) {
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
  url_de <- function(id) if (nzchar(id)) paste0("https://docs.google.com/spreadsheets/d/", id, "/edit") else ""

  id_libro <- .matc_destino(aulas[["libro_sheets"]])
  esperadas <- .matc_hojas_del_libro()
  libro <- list(destino = id_libro, url = url_de(id_libro), existe = FALSE,
                faltan = as.list(esperadas), error = "")
  if (nzchar(id_libro)) {
    leido <- titulos_de(id_libro)
    if (is.null(leido$titulos)) {
      libro$existe <- NA
      libro$faltan <- list()
      libro$error <- leido$error
    } else {
      faltan <- setdiff(esperadas, trimws(leido$titulos))
      libro$existe <- !length(faltan)
      libro$faltan <- as.list(faltan)
    }
  }

  id_dist <- .matc_destino(aulas[["distribucion_sheets"]])
  distribucion <- list(destino = id_dist, url = url_de(id_dist), existe = FALSE,
                       semanas = list(), error = "")
  if (nzchar(id_dist)) {
    leido <- titulos_de(id_dist)
    if (is.null(leido$titulos)) {
      distribucion$existe <- NA
      distribucion$error <- leido$error
    } else {
      t <- trimws(leido$titulos)
      # «Semana N» es como la app escribe la distribución; «Plan del día» es la
      # pestaña con la que se publicó la primera semana antes de partirla.
      semanas <- t[grepl("^Semana [0-9]+$", t) | t == .mapd_hoja()]
      distribucion$existe <- length(semanas) > 0L
      distribucion$semanas <- as.list(semanas)
    }
  }

  list(libro = libro, distribucion = distribucion)
}

mount_monitoreo_aulas_tablas_construidas <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/aulas/tablas-construidas", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      cfg <- monitoreo_normalize_config(session_get(sid)$monitoreo_config %||% list(), data.frame())
      monitoreo_aulas_tablas_construidas(cfg)
    }))
}
