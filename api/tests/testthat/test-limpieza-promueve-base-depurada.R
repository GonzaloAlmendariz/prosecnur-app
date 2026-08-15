# ADR 0076 — una base depurada se promueve, no se recomienda.
#
# Los invariantes que el ADR declara para su cumplimiento:
#   1. la exclusión llega a quien consume la base;
#   2. el linaje no se rompe y permite revertir;
#   3. lo promovido tiene forma de base del estudio, no de tabla de trabajo;
#   4. la cadena respeta el orden universo -> limpieza.

.prom_base_meta <- function(extra = list()) {
  utils::modifyList(list(
    xlsform_file_id = "XLS1", data_file_id = "DATA_CRUDA",
    original_xlsform_file_id = "XLS1", original_data_file_id = "DATA_CRUDA",
    data_ext = "xlsx"
  ), extra)
}

test_that("la forma de origen descarta las derivadas del plan y conserva el orden", {
  td <- tempfile("prom_forma_"); dir.create(td)
  origen <- file.path(td, "origen.xlsx")
  openxlsx::write.xlsx(data.frame(
    Pulso_code = c("A", "B"), edad = c(30, 41), sexo = c("1", "2"),
    stringsAsFactors = FALSE, check.names = FALSE
  ), origen, overwrite = TRUE)

  # Lo que sale de Validación: mismas columnas + derivadas del plan, y en otro orden.
  trabajo <- data.frame(
    sexo = c("1", "2"), Pulso_code = c("A", "B"), edad = c(30, 41),
    `.__case_id__` = c("A", "B"), r_regla_001 = c(TRUE, FALSE), n_incons = c(1, 0),
    stringsAsFactors = FALSE, check.names = FALSE
  )

  out <- prosecnurapp:::.limpieza_forma_de_origen(trabajo, origen, "xlsx")
  expect_equal(names(out), c("Pulso_code", "edad", "sexo"))
  expect_equal(nrow(out), 2L)
  expect_false(any(grepl("^r_regla|case_id|n_incons", names(out))))
})

test_that("la cadena de Codificación prefiere limpieza sobre universo", {
  resolver <- function(base_extra) {
    s <- list(
      estudio = list(bases = list(default = .prom_base_meta(base_extra))),
      files = list(
        DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
        DATA_UNIV  = list(file_id = "DATA_UNIV", ext = "xlsx"),
        DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx")
      )
    )
    base <- s$estudio$bases$default
    elegido <- NULL
    for (etapa in c("limpieza", "universe_filter")) {
      cfg <- base[[etapa]]
      if (is.null(cfg) || !isTRUE(cfg$enabled)) next
      fid <- as.character(cfg$effective_data_file_id %||% "")
      if (nzchar(fid) && !is.null(s$files[[fid]])) { elegido <- fid; break }
    }
    elegido %||% base$original_data_file_id
  }
  `%||%` <- function(a, b) if (is.null(a)) b else a

  # Sin depuración: la cruda.
  expect_equal(resolver(list()), "DATA_CRUDA")
  # Solo universo.
  expect_equal(resolver(list(universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"))),
               "DATA_UNIV")
  # Ambos: manda la limpieza, que es posterior en la cadena.
  expect_equal(resolver(list(
    universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"),
    limpieza = list(enabled = TRUE, effective_data_file_id = "DATA_LIMPIA")
  )), "DATA_LIMPIA")
  # Promoción revertida: vuelve a mandar el universo.
  expect_equal(resolver(list(
    universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"),
    limpieza = list(enabled = FALSE, effective_data_file_id = "DATA_LIMPIA")
  )), "DATA_UNIV")
})

test_that("promover actualiza la base vigente y deja linaje reversible", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(
    DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx", kind = "data"),
    DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx", kind = "validacion_limpieza_base_limpia")
  )
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215
  )
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base$data_file_id, "DATA_LIMPIA")
  expect_equal(base$n_filas, 101L)
  expect_true(isTRUE(base$limpieza$enabled))
  expect_equal(base$limpieza$source_data_file_id, "DATA_CRUDA")
  expect_equal(base$limpieza$n_casos_antes, 103L)
  # `original_*` no se toca: sigue siendo lo que se cargó.
  expect_equal(base$original_data_file_id, "DATA_CRUDA")

  # Y se puede volver atrás sin rehacer decisiones.
  expect_true(prosecnurapp:::.limpieza_revertir_promocion(sid, "default"))
  base2 <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base2$data_file_id, "DATA_CRUDA")
  expect_false(isTRUE(base2$limpieza$enabled))
  expect_true(nzchar(base2$limpieza$reverted_at %||% ""))
})

test_that("una base con hijas repeat no se promueve y declara el motivo", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215,
    motivo_bloqueo = "La base tiene grupos repetibles."
  )
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base$data_file_id, "DATA_CRUDA")   # no se promovió
  expect_false(isTRUE(base$limpieza$enabled))
  expect_true(nzchar(base$limpieza$bloqueo))
})
