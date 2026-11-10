# Cerrar la limpieza sin decisiones listas no vacía la base del estudio (ADR 0076).
#
# Cuando la auditoría no deja decisiones listas, `.limpieza_simulate()` toma un
# atajo y devuelve `data_final = NULL`. Ese NULL no puede llegar a la base
# promovida: lo que se escribe y rige es la base de origen tal cual.
#
# A diferencia de los tests de nombres de entregables (fase 5), aquí corren los
# colaboradores reales del camino de la base: `.limpieza_simulate`,
# `.limpieza_forma_de_origen`, `.bases_write_xlsx` y `.limpieza_promover_base`.
# Solo se aíslan `build_limpieza` y el Excel de decisiones, que no deciden qué
# base rige.

.ccsd_origen <- data.frame(
  id_caso = c("C01", "C02", "C03"),
  edad = c(31, 47, 58),
  stringsAsFactors = FALSE
)

.ccsd_xlsx_bytes <- function(df) {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  openxlsx::write.xlsx(df, path, overwrite = TRUE)
  readBin(path, "raw", file.info(path)$size)
}

# Sesión con una base cuyo archivo de datos tiene 3 filas por 2 columnas. La
# metadata de la base declara otro N (1 fila) y la evaluación no trae `datos`,
# para que un arreglo que lea el N de cualquiera de esas dos fuentes, y no del
# archivo, no pase.
.ccsd_sesion <- function(envir = parent.frame()) {
  withr::local_envvar(PULSO_PUBLIC_MODE = "", .local_envir = envir)
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  xls <- save_upload(sid, "xlsform", "instrumento.xlsx", .ccsd_xlsx_bytes(
    data.frame(type = "text", name = "id_caso", label = "Caso", stringsAsFactors = FALSE)
  ))
  dat <- save_upload(sid, "data", "respuestas.xlsx", .ccsd_xlsx_bytes(.ccsd_origen))
  estudio_add_base(sid, "principal", xlsform_file_id = xls$file_id, data_file_id = dat$file_id,
                   data_ext = "xlsx", rp_data = data.frame(id_caso = "X"), rp_inst = NULL,
                   n_filas = 1L, n_columnas = 1L)
  list(sid = sid, data_fid = dat$file_id)
}

# Auditoría hecha y sin hallazgos: una regla evaluada con cero casos, sin
# decisiones en borrador.
.ccsd_scope <- function() {
  list(
    evaluacion = list(resumen = tibble::tibble(
      id_regla = "R1", nombre_regla = "Edad en rango", n_inconsistencias = 0L
    )),
    limpieza_draft = list()
  )
}

.ccsd_leer <- function(path) {
  as.data.frame(readxl::read_excel(path, sheet = 1))
}

.ccsd_base_vigente <- function(sid) {
  meta <- session_get(sid)$estudio$bases$principal
  list(meta = meta, data = .ccsd_leer(get_file(sid, meta$data_file_id)$path))
}

test_that("cerrar sin decisiones escribe y promueve la base de origen completa", {
  fx <- .ccsd_sesion()
  testthat::local_mocked_bindings(
    build_limpieza = function(...) list(),
    .limpieza_export_excel = function(path, ...) { writeLines("x", path); invisible(path) }
  )

  out <- limpieza_finalize(fx$sid, "principal", scope = .ccsd_scope())

  limpia <- Filter(function(f) identical(f$kind, "base_limpia"), out$artifacts$files)
  expect_length(limpia, 1L)
  escrita <- .ccsd_leer(get_file(fx$sid, limpia[[1]]$file_id)$path)
  expect_identical(nrow(escrita), 3L)
  expect_identical(names(escrita), names(.ccsd_origen))
  expect_identical(as.character(escrita$id_caso), .ccsd_origen$id_caso)

  linaje <- out$artifacts$promocion
  expect_identical(linaje$n_casos_antes, 3L)
  expect_identical(linaje$n_casos_despues, 3L)

  vigente <- .ccsd_base_vigente(fx$sid)
  expect_identical(nrow(vigente$data), 3L)
  expect_identical(names(vigente$data), names(.ccsd_origen))
})

test_that("una base a promover sin columnas corta el cierre y no toca la base vigente", {
  fx <- .ccsd_sesion()
  testthat::local_mocked_bindings(
    build_limpieza = function(...) list(),
    build_report_html = function(...) "<html></html>",
    .limpieza_export_excel = function(path, ...) { writeLines("x", path); invisible(path) },
    .limpieza_forma_de_origen = function(...) data.frame(row.names = 1:3)
  )

  cond <- tryCatch(
    { limpieza_finalize(fx$sid, "principal", scope = .ccsd_scope()); NULL },
    error = function(e) e
  )
  expect_s3_class(cond, "api_error")
  expect_match(as.character(cond$code %||% ""), "^E_LIMPIEZA_")

  meta <- session_get(fx$sid)$estudio$bases$principal
  expect_identical(meta$data_file_id, fx$data_fid)
  expect_false(isTRUE(meta$limpieza$enabled))
})

test_that("la revisión HTML no imprime 'Estudio: NA' cuando el estudio no tiene nombre", {
  html <- build_report_html(
    list(), base_nombre = "principal", estudio_nombre = NA_character_,
    generated_at = as.POSIXct("2026-01-15 10:00", tz = "UTC"), limpieza_payload = list()
  )
  expect_false(grepl("Estudio: NA", html, fixed = TRUE))
  expect_true(grepl("Base: principal", html, fixed = TRUE))
})

test_that("el cierre de una sesión sin nombre de estudio escribe la revisión sin 'Estudio: NA'", {
  fx <- .ccsd_sesion()
  expect_null(session_get(fx$sid)$estudio$nombre)
  testthat::local_mocked_bindings(
    build_limpieza = function(...) list(),
    .limpieza_export_excel = function(path, ...) { writeLines("x", path); invisible(path) }
  )
  out <- limpieza_finalize(fx$sid, "principal", scope = .ccsd_scope())
  rev <- Filter(function(f) identical(f$kind, "reporte_html"), out$artifacts$files)
  expect_length(rev, 1L)
  html <- paste(readLines(get_file(fx$sid, rev[[1]]$file_id)$path, warn = FALSE), collapse = "\n")
  expect_true(grepl("Base: principal", html, fixed = TRUE))
  expect_false(grepl("Estudio: NA", html, fixed = TRUE))
})
