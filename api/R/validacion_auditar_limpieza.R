#' Auditar reglas: nombre, objetivo, expresión y casos
#'
#' @param ev Objeto de evaluar_consistencia()
#' @param ids Vector de IDs de regla (p.ej. c("INSE_025","ATRI_001"))
#' @param inst Instrumento. Si es NULL se intenta usar ev$inst.
#' @param verbose Si TRUE imprime por regla (formato texto plano)
#' @return lista con: resumen (tibble), expresion (chr), objetivo (chr), casos (list)
#' @family validacion
#' @export
auditar_regla <- function(ev, ids, inst = NULL, verbose = TRUE){

  stopifnot(is.list(ev))

  # Resolver inst (prioridad: argumento; fallback: ev$inst)
  if (is.null(inst) && !is.null(ev$inst)) inst <- ev$inst

  if (is.null(inst) || !is.list(inst) || is.null(inst$meta)) {
    stop("auditar_regla(): falta 'inst'. Pásalo como inst=inst o guarda el instrumento en ev$inst.")
  }

  # Traer bloque por regla (asume que trae 'casos' como list-col)
  aud <- reporte_bloques(evaluacion = ev, inst = inst, ids = ids)

  # Helpers para nombres de columnas variables entre planes
  .pick_col <- function(df, candidates, default = NA_character_){
    hit <- candidates[candidates %in% names(df)]
    if (length(hit) == 0) return(rep(default, nrow(df)))
    as.character(df[[hit[1]]])
  }

  aud <- aud %>%
    dplyr::mutate(
      id_regla     = .pick_col(., c("id_regla","ID","Id","id")),
      nombre_regla = .pick_col(., c("nombre_regla","Nombre de la regla","nombre","Nombre")),
      procesamiento= .pick_col(., c("procesamiento","Procesamiento (R)","expresion","Expresión R")),
      objetivo     = .pick_col(., c("objetivo","Objetivo","objetivo_regla","Objetivo de la regla")),
      n_inconsistencias = suppressWarnings(as.integer(.pick_col(., c("n_inconsistencias","n","violaciones"), default = NA))),
      porcentaje   = suppressWarnings(as.numeric(.pick_col(., c("porcentaje","pct"), default = NA)))
    ) %>%
    dplyr::select(id_regla, nombre_regla, objetivo, procesamiento, n_inconsistencias, porcentaje, casos)

  # Mantener el orden pedido en 'ids'
  if (!missing(ids) && length(ids)) {
    ord <- match(ids, aud$id_regla)
    aud <- aud[ord, , drop = FALSE]
  }

  # Impresión limpia por regla (sin fences)
  if (isTRUE(verbose)) {
    purrr::pwalk(
      list(aud$id_regla, aud$nombre_regla, aud$objetivo, aud$procesamiento, aud$casos, aud$n_inconsistencias),
      function(idr, nombre, obj, expr, df_casos, ninc){
        cat("\n========================================\n")
        cat("ID de regla:       ", idr, "\n", sep = "")
        cat("Nombre de la regla:", nombre, "\n", sep = " ")
        cat("Objetivo:          ", obj, "\n", sep = "")
        cat("Expresión R:       ", expr, "\n\n", sep = "")
        cat("Casos con inconsistencias (", ninc, "):\n", sep = "")
        print(tibble::as_tibble(df_casos), n = 20)
      }
    )
  }

  # Salida estructurada
  out <- list(
    resumen   = aud %>% dplyr::select(id_regla, nombre_regla, objetivo, n_inconsistencias, porcentaje),
    expresion = aud$procesamiento,
    objetivo  = aud$objetivo,
    casos     = aud$casos
  )
  invisible(out)
}
