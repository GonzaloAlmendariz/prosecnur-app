# ADR 0133 §5 — Guardar junto al proyecto a mano.
#
# `/api/fs/save-to-project` deja de rechazar tildes, espacios y nombres de más de 80 caracteres:
# limpia el nombre con las reglas del §3, acepta como `subdir` las carpetas `Entregables` y
# `Entregables/<Módulo>` y, ante un nombre repetido sin `overwrite`, agrega `_2` en vez de responder 409.
#
# Por HTTP en proceso (`pr$call` sobre el router real), como test-dashboard-publish-permitido.R: el
# contrato incluye cómo plumber entrega el body a la ruta, no sólo la lógica de la copia.

.sp_router <- function() {
  mount_proyecto(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

.sp_call <- function(pr, sid, body) {
  json <- as.character(jsonlite::toJSON(body, auto_unbox = TRUE))
  raw_body <- charToRaw(enc2utf8(json))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) json)
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/fs/save-to-project", QUERY_STRING = "",
    CONTENT_TYPE = "application/json", HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = input))
  r <- pr$call(req)
  cuerpo <- tryCatch(jsonlite::fromJSON(as.character(r$body), simplifyVector = TRUE), error = function(e) list())
  # El serializador de `plumber::pr()` puede dejar escalares en arreglos de largo 1.
  cuerpo <- lapply(cuerpo, function(v) if (is.atomic(v) && length(v) == 1L) v[[1]] else v)
  list(status = as.integer(r$status), body = cuerpo)
}

.sp_proyecto <- function(envir = parent.frame()) {
  dir <- withr::local_tempdir(.local_envir = envir)
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  pulso <- file.path(dir, "estudio.pulso")
  writeBin(as.raw(0), pulso)
  s$project_path <- pulso
  origen <- file.path(s$dir, "downloads", "salida.xlsx")
  writeLines("contenido", origen)
  s$files[["f-salida"]] <- list(file_id = "f-salida", kind = "frecuencias", original_name = "salida.xlsx",
                                path = origen, size = file.size(origen), ext = "xlsx",
                                uploaded_at = "2026-11-07T00:00:00Z")
  .session_env[[sid]] <- s
  list(sid = sid, dir = dir)
}

test_that("§5: un nombre con tildes y espacios se limpia con las reglas del §3 en vez de responder 400", {
  testthat::skip_if_not_installed("plumber")
  p <- .sp_proyecto()
  r <- .sp_call(.sp_router(), p$sid, list(file_id = "f-salida", filename = "Informe final de campaña.xlsx"))
  expect_identical(r$status, 200L, info = paste(unlist(r$body), collapse = " | "))
  expect_identical(r$body$filename, "Informe_final_de_campana.xlsx")
  expect_true(file.exists(file.path(p$dir, "Informe_final_de_campana.xlsx")))
})

test_that("§5: un nombre de más de 80 caracteres se recorta en vez de responder 400", {
  testthat::skip_if_not_installed("plumber")
  p <- .sp_proyecto()
  largo <- paste0(strrep("Reporte_de_avance_", 7L), "final.xlsx")
  expect_gt(nchar(largo), 80L)
  r <- .sp_call(.sp_router(), p$sid, list(file_id = "f-salida", filename = largo))
  expect_identical(r$status, 200L, info = paste(unlist(r$body), collapse = " | "))
  expect_type(r$body$filename, "character")
  stem <- sub("\\.xlsx$", "", r$body$filename %||% strrep("x", 81L))
  expect_lte(nchar(stem), 80L)
  expect_match(r$body$filename, "^Reporte_de_avance_.*\\.xlsx$")
  expect_true(file.exists(r$body$path))
})

test_that("§5: acepta Entregables y Entregables/<Módulo> como subdir", {
  testthat::skip_if_not_installed("plumber")
  p <- .sp_proyecto()
  pr <- .sp_router()
  for (subdir in c("Entregables", "Entregables/Procesamiento", "Entregables/Cálculo de muestra")) {
    r <- .sp_call(pr, p$sid, list(file_id = "f-salida", filename = "Frecuencias.xlsx", subdir = subdir))
    expect_identical(r$status, 200L, info = paste(subdir, "->", paste(unlist(r$body), collapse = " | ")))
    esperado <- file.path(p$dir, subdir, "Frecuencias.xlsx")
    expect_true(file.exists(esperado), info = subdir)
  }
})

test_that("§5: un subdir que sale de la carpeta del proyecto se sigue rechazando", {
  testthat::skip_if_not_installed("plumber")
  p <- .sp_proyecto()
  pr <- .sp_router()
  for (subdir in c("../fuera", "Entregables/../../fuera")) {
    r <- .sp_call(pr, p$sid, list(file_id = "f-salida", filename = "x.xlsx", subdir = subdir))
    expect_identical(r$status, 400L, info = subdir)
  }
  expect_false(file.exists(file.path(dirname(p$dir), "fuera", "x.xlsx")))
})

test_that("§5: un nombre repetido sin overwrite agrega _2 y luego _3 en vez de responder 409", {
  testthat::skip_if_not_installed("plumber")
  p <- .sp_proyecto()
  pr <- .sp_router()
  r1 <- .sp_call(pr, p$sid, list(file_id = "f-salida", filename = "Frecuencias.xlsx"))
  writeLines("editado por el usuario", file.path(p$dir, "Frecuencias.xlsx"))
  r2 <- .sp_call(pr, p$sid, list(file_id = "f-salida", filename = "Frecuencias.xlsx"))
  r3 <- .sp_call(pr, p$sid, list(file_id = "f-salida", filename = "Frecuencias.xlsx"))
  expect_identical(r1$status, 200L)
  # Un nombre que ya trae su extensión no la recibe dos veces («Frecuencias.xlsx.xlsx»).
  expect_identical(r1$body$filename, "Frecuencias.xlsx")
  expect_identical(r2$status, 200L, info = paste(unlist(r2$body), collapse = " | "))
  expect_identical(r3$status, 200L, info = paste(unlist(r3$body), collapse = " | "))
  expect_identical(r2$body$filename, "Frecuencias_2.xlsx")
  expect_identical(r3$body$filename, "Frecuencias_3.xlsx")
  expect_identical(readLines(file.path(p$dir, "Frecuencias.xlsx")), "editado por el usuario")
  ruta2 <- file.path(p$dir, "Frecuencias_2.xlsx")
  expect_true(file.exists(ruta2))
  if (file.exists(ruta2)) expect_identical(readLines(ruta2), "contenido")
})
