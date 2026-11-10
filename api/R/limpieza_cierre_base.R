# Cierre de la limpieza: qué base se escribe y se promueve (ADR 0076).
#
# `limpieza_finalize()` solo integra estas piezas. Viven aparte para que la
# regla de "qué rige al cerrar" tenga un lugar y un test propios
# (test-limpieza-cierre-sin-decisiones.R).

# La base que se escribe como "base limpia" y pasa a regir.
#
# Sin decisiones listas, `.limpieza_simulate()` no lee la base (es el atajo del
# GET de preview) y deja `data_final = NULL`. Al cerrar, ese NULL significa
# "nada cambió": lo que rige es la base de origen tal cual, leída con el mismo
# lector que usa `.limpieza_forma_de_origen()` para fijar las columnas. Luego
# pasa por esa misma forma, para que ambos caminos salgan con las columnas del
# origen en su orden.
.limpieza_base_a_promover <- function(data_final, files_origen) {
  if (is.null(files_origen)) return(data_final)
  path <- files_origen$data$path
  ext <- files_origen$data_ext
  if (is.null(data_final)) {
    data_final <- .read_data_for_validation(path, ext)
  }
  .limpieza_forma_de_origen(data_final, path, ext)
}

# Antes de escribir, registrar o promover: una base sin columnas no sustituye a
# la vigente. Corta el cierre con la causa; la base vigente no se toca.
.limpieza_exigir_base_promovible <- function(data_promovible, base_nombre) {
  if (is.data.frame(data_promovible) && ncol(data_promovible) > 0L) {
    return(invisible(data_promovible))
  }
  stop_api(
    409, "E_LIMPIEZA_BASE_VACIA",
    paste(
      "No se cerró la limpieza porque la base a promover quedó sin columnas:",
      "no se pudo leer la base de origen o las decisiones la vaciaron.",
      "La base vigente no cambió."
    ),
    details = list(
      base = calc_str(base_nombre, ""),
      columnas = if (is.data.frame(data_promovible)) 0L else NA_integer_
    )
  )
}

# N de la base promovida antes y después de las exclusiones de la limpieza.
# Grano: caso de la tabla principal de la base cerrada. `n_despues` cuenta las
# filas que rigen; `n_antes` les suma los casos que las decisiones excluyeron.
.limpieza_n_promocion <- function(data_promovible, cases_excluded) {
  n_despues <- as.integer(nrow(data_promovible))[1L]
  excluidos <- suppressWarnings(as.integer(cases_excluded %||% 0L))[1L]
  if (is.na(excluidos)) excluidos <- 0L
  list(n_antes = n_despues + excluidos, n_despues = n_despues)
}

# Nombre del estudio para la revisión HTML: el de la Ficha del estudio; si no
# se declaró, el antiguo `s$estudio$nombre`; si tampoco, NULL (la revisión
# omite la línea "Estudio").
.limpieza_estudio_nombre <- function(s) {
  candidatos <- list(.planner_identidad(s)$nombre, s$estudio$nombre)
  for (cand in candidatos) {
    v <- trimws(calc_str(cand, ""))
    if (nzchar(v)) return(v)
  }
  NULL
}
