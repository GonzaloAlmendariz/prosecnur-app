# El total de un avance contra mínimos o cuotas por grupo, sin compensar entre
# grupos. Lo usan los PDF de avance de acreditación (por público) y territorial
# (por distrito).
#
# Regla de la casa: lo que sobra en un grupo no cubre lo que falta en otro. Si
# Profesores lleva 150 de un mínimo de 100 y Estudiantes 50 de 100, el total NO
# es «200 de 200, faltan 0»: faltan 50, y el cumplimiento es 150 de 200 (100
# cubiertos en Profesores + 50 en Estudiantes). Antes los dos PDF restaban los
# totales (`max(0, Σmínimo − Σlogrado)`) y podían declarar el campo cerrado con
# públicos o distritos todavía bajo su mínimo (docs/qa/formato-monitoreo-2026-11-02.md,
# pendiente 1).
#
# Un grupo sin mínimo declarado (NA, 0 o negativo) queda fuera de las tres sumas
# del mínimo: no falta nada contra una cifra que no existe, y no aporta cubiertos.
#
# Devuelve:
#   - `con_minimo`: lógico por grupo.
#   - `faltan_por_grupo`, `cubierto_por_grupo`: por grupo; NA sin mínimo.
#   - `minimo`: Σ mínimo de los grupos con mínimo.
#   - `logrado`: Σ logrado de esos mismos grupos (con sus excedentes).
#   - `cubierto`: Σ min(logrado, mínimo) — lo que cuenta para el cumplimiento.
#   - `faltan`: Σ max(0, mínimo − logrado) = `minimo − cubierto`.
#   - `pct`: 100 · cubierto / minimo (NA sin mínimo). Llega a 100 sólo si
#     `faltan` es 0.
#   - `grupos_bajo_minimo`: cuántos grupos con mínimo siguen debajo.
.monitoreo_avance_sin_compensar <- function(logrado, minimo) {
  logrado <- suppressWarnings(as.numeric(logrado))
  minimo <- suppressWarnings(as.numeric(minimo))
  if (length(logrado) != length(minimo)) {
    stop_api(500L, "E_INTERNAL", "Avance sin compensar: logrado y mínimo no tienen el mismo largo.",
             list(logrado = length(logrado), minimo = length(minimo)))
  }
  logrado[!is.finite(logrado) | logrado < 0] <- 0
  con_minimo <- is.finite(minimo) & minimo > 0
  faltan_g <- rep(NA_real_, length(minimo))
  cubierto_g <- rep(NA_real_, length(minimo))
  faltan_g[con_minimo] <- pmax(0, minimo[con_minimo] - logrado[con_minimo])
  cubierto_g[con_minimo] <- pmin(logrado[con_minimo], minimo[con_minimo])
  total_minimo <- sum(minimo[con_minimo])
  total_cubierto <- sum(cubierto_g[con_minimo])
  list(
    con_minimo = con_minimo,
    faltan_por_grupo = faltan_g,
    cubierto_por_grupo = cubierto_g,
    minimo = total_minimo,
    logrado = sum(logrado[con_minimo]),
    cubierto = total_cubierto,
    faltan = sum(faltan_g[con_minimo]),
    pct = if (total_minimo > 0) 100 * total_cubierto / total_minimo else NA_real_,
    grupos_bajo_minimo = sum(faltan_g[con_minimo] > 0)
  )
}

# El total del PDF territorial (`monitoreo_territorial_advance_report_pdf`, en
# `monitoreo_engine.R`, congelado a crecimiento) por distrito y sin compensar.
#
# `rows` son las filas por distrito que dibuja el PDF (sin la fila TOTAL);
# `observado` y `meta` son los lectores de ese PDF, `function(df, i, label)`,
# para que el total lea cada distrito igual que su tarjeta. Si ningún distrito
# declara meta de encuestas, el total es un solo grupo con las cifras globales
# (`validas`, `meta_total`): sin distritos no hay nada entre qué compensar.
.monitoreo_territorial_avance_sin_compensar <- function(rows, observado, meta, rotulo, validas, meta_total) {
  rows <- .monitoreo_workbook_df(rows)
  if (nrow(rows)) {
    etiquetas <- vapply(seq_len(nrow(rows)), function(i) {
      .monitoreo_scalar(rotulo(rows, c("Distrito", "Grupo"), i, ""), "")
    }, character(1))
    logrado <- vapply(seq_len(nrow(rows)), function(i) as.numeric(observado(rows, i, etiquetas[[i]]))[[1]], numeric(1))
    minimo <- vapply(seq_len(nrow(rows)), function(i) as.numeric(meta(rows, i, etiquetas[[i]]))[[1]], numeric(1))
    por_distrito <- .monitoreo_avance_sin_compensar(logrado, minimo)
    if (por_distrito$minimo > 0) return(por_distrito)
  }
  .monitoreo_avance_sin_compensar(
    suppressWarnings(as.numeric(gsub("%", "", as.character(validas %||% NA))))[1],
    suppressWarnings(as.numeric(gsub("%", "", as.character(meta_total %||% NA))))[1]
  )
}
