# Repartir las cuotas por ficha SIN re-sortear (revisión de U15). Una muestra que ya
# está en campo no puede volver a sortearse —cambiarían las manzanas—, pero sus hojas
# pueden pedir la cuota del distrito en vez de 4/4 en todas: se reparte sobre la
# muestra guardada, con las mismas manzanas y el mismo orden, y queda en la bitácora.

#' Aplica el reparto de cuotas por ficha a una muestra ya sorteada.
#' @return list(sample, resumen = [{ubigeo, distrito, hombres, mujeres, edad}], alertas)
hojas_ruta_cuotas_recalcular_muestra <- function(sample, quota, cfg) {
  blocks <- .hojas_ruta_rows_df(sample$blocks %||% list())
  repl <- .hojas_ruta_rows_df(sample$replacement_blocks %||% list())
  cells <- .hojas_ruta_rows_df(quota$cells %||% list())
  r <- hojas_ruta_cuotas_por_ficha(blocks, repl, cells, hojas_ruta_integrada_normalize_config(cfg))
  sample$blocks <- r$blocks
  sample$replacement_blocks <- r$replacements
  b <- r$blocks
  resumen <- lapply(unique(as.character(b$ubigeo)), function(u) {
    f <- as.character(b$ubigeo) == u
    s <- do.call(rbind, lapply(strsplit(as.character(b$cuota_sexo_totals[f]), ","), as.integer))
    e <- do.call(rbind, lapply(strsplit(as.character(b$cuota_edad_totals[f]), ","), as.integer))
    list(ubigeo = u, distrito = as.character(b$distrito[f][1] %||% u),
         hombres = if (is.matrix(s) && ncol(s) == 2L) sum(s[, 1]) else NA_integer_,
         mujeres = if (is.matrix(s) && ncol(s) == 2L) sum(s[, 2]) else NA_integer_,
         edad = if (is.matrix(e)) as.list(as.integer(colSums(e))) else list())
  })
  list(sample = sample, resumen = resumen, alertas = r$alertas)
}

mount_hojas_ruta_cuotas <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/cuotas-por-ficha", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      active <- .hojas_ruta_active_run(sid)
      outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
      if (is.null(outputs$sample) || !length(outputs$sample$blocks %||% list())) {
        stop_api(409, "E_NO_SAMPLE", "Primero sortea las manzanas: las cuotas se reparten entre sus hojas.")
      }
      if (is.null(outputs$quota) || !length(outputs$quota$cells %||% list())) {
        stop_api(409, "E_NO_SAMPLE", "Falta la cuota por sexo y edad del estudio: calcula las cuotas en Manzanas.")
      }
      r <- hojas_ruta_cuotas_recalcular_muestra(outputs$sample, outputs$quota, active$run$config %||% list())
      .hojas_ruta_workspace_outputs_update(sid, patch = list(sample = r$sample))
      .hojas_ruta_bitacora_intentar(sid, "cuotas_recalculadas", sprintf(
        "Cuotas de sexo y edad repartidas por distrito entre las hojas de la muestra (sin cambiar las manzanas): %s.",
        paste(vapply(r$resumen, function(d) sprintf("%s %s H / %s M", d$distrito, d$hombres, d$mujeres), character(1)), collapse = "; ")
      ))
      list(ok = TRUE, resumen = r$resumen, alerts = r$alertas)
    }))
}
