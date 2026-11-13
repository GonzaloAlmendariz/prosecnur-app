# Fichas de la entrega (ZIP): una por titular y por reemplazo, distrito por distrito.
#
# El ZIP dibuja cada ficha (página 1 + mapa de contexto) contra un contexto de
# render compartido que guarda la cartografía ya leída. Esas cachés se
# acumulaban hasta el final de la entrega: con varios distritos la memoria
# crecía distrito a distrito, y la app corre en computadoras de campo modestas.
# Aquí las fichas se dibujan agrupadas por distrito y, al terminar uno, se
# sueltan sus calles —la caché más pesada, ~90 MB por distrito— que las hojas de
# zona, dibujadas después, no usan.
#
# Se probó repartir las fichas entre procesos hijos (fork): con la máquina
# ocupada no ganaba nada (73 s en serie contra 78 s con 4 procesos, 160 PDFs) y
# cada hijo suma memoria. El ahorro está en que cada ficha cueste menos
# (hojas_ruta_mapa_lote.R), que sirve igual en cualquier equipo.

#' Dibuja las fichas de la entrega, agrupadas por distrito.
#'
#' @param tareas lista de `list(block, qdom, out_pdf)`.
#' @param sample muestra de la entrega (`frame_meta`, `config`).
#' @param render_ctx contexto de render compartido.
#' @param al_avanzar `function(hechas, total)`, para el progreso del job.
#' @return número de fichas dibujadas (invisible).
#' @keywords internal
.hojas_ruta_entrega_fichas <- function(tareas, sample, render_ctx, al_avanzar = function(...) NULL) {
  total <- length(tareas)
  hechas <- 0L
  ubigeo <- vapply(tareas, function(t) as.character(t$block$ubigeo %||% ""), character(1))
  for (u in unique(ubigeo)) {
    for (t in tareas[ubigeo == u]) {
      .hojas_ruta_draw_integrated_pdf(t$block, t$qdom, sample$frame_meta, sample$config, t$out_pdf,
                                      render_ctx = render_ctx)
      hechas <- hechas + 1L
      al_avanzar(hechas, total)
    }
    .hojas_ruta_entrega_soltar_calles(render_ctx, u)
  }
  invisible(hechas)
}

.hojas_ruta_entrega_soltar_calles <- function(render_ctx, ubigeo) {
  if (!is.environment(render_ctx)) return(invisible(FALSE))
  u <- .pulso_ceros_izq(6L, as.character(ubigeo %||% ""))
  for (cache in c("street_features", "street_feature_index", "street_label_maps")) {
    env <- render_ctx[[cache]]
    if (!is.environment(env)) next
    claves <- ls(env, all.names = TRUE)
    quitar <- claves[claves == u | startsWith(claves, paste0(u, "|"))]
    if (length(quitar)) rm(list = quitar, envir = env)
  }
  invisible(TRUE)
}
