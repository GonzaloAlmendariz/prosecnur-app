# GET /api/carga/codigos-observados: los códigos que una variable de una base
# trae en su data, con su etiqueta y su conteo sin ponderar. Reusa las fixtures
# de helper-base-variables.R (2026 xlsx, 2024 .sav) y arma una base propia con
# la edad 18..40, el sexo y un comentario de texto libre.

.co_recurrio <- list(nombre = "recurrio", etiqueta = "Recurrió a alguna instancia",
                     regla = "alguna", variables = list("q1", "q2"), codigos = list("1"))

.co_estudio_edad <- function() {
  sid <- session_create()
  inst <- list(
    survey = data.frame(type = c("integer", "select_one sexo", "text"),
                        name = c("edad", "sexo", "comentario"),
                        label = c("Edad", "Sexo", "Comentario"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
                         stringsAsFactors = FALSE)
  )
  n <- 46L
  data <- data.frame(
    `_uuid` = sprintf("u%02d", seq_len(n)),
    edad = rep(18:40, 2L),
    sexo = c(rep(c("1", "2"), 22L), NA, NA),
    comentario = c(sprintf("Opinión libre número %d", seq_len(n - 6L)), rep(NA, 6L)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  .bv_add_base(sid, "E", inst, .bv_xlsx_bytes(list(data = data)), "data_e.xlsx", "xlsx")
  sid
}

.co_codigos <- function(r) vapply(r$codigos, `[[`, "", "codigo")
.co_n <- function(r) stats::setNames(vapply(r$codigos, `[[`, 0L, "n"), .co_codigos(r))
.co_etiquetas <- function(r) {
  stats::setNames(vapply(r$codigos, function(c) c$etiqueta %||% NA_character_, ""), .co_codigos(r))
}

test_that("una numérica 18..40 devuelve todos sus enteros en orden numérico, sin truncar", {
  sid <- .co_estudio_edad()
  on.exit(session_delete(sid), add = TRUE)
  r <- codigos_observados_consultar(sid, "E", "edad")
  expect_identical(r$tipo, "numerica")
  expect_identical(.co_codigos(r), as.character(18:40))
  expect_true(all(.co_n(r) == 2L))
  expect_identical(r$n_validos, 46L)
  expect_identical(r$n_sin_dato, 0L)
  expect_false(r$truncado)
})

test_that("una select_one trae la etiqueta del instrumento y cuenta los vacíos aparte", {
  sid <- .co_estudio_edad()
  on.exit(session_delete(sid), add = TRUE)
  r <- codigos_observados_consultar(sid, "E", "sexo")
  expect_identical(r$tipo, "categorica")
  expect_identical(.co_n(r), c(`1` = 22L, `2` = 22L))
  expect_identical(.co_etiquetas(r), c(`1` = "Mujer", `2` = "Hombre"))
  expect_identical(r$n_validos, 44L)
  expect_identical(r$n_sin_dato, 2L)
})

test_that("el texto libre no devuelve valores: tipo text o un valor por caso", {
  sid <- .co_estudio_edad()
  on.exit(session_delete(sid), add = TRUE)
  r <- codigos_observados_consultar(sid, "E", "comentario")
  expect_identical(r$tipo, "texto")
  expect_length(r$codigos, 0L)
  expect_identical(r$n_validos, 40L)
  expect_identical(r$n_sin_dato, 6L)
  # Una columna sin tipo declarado con un valor distinto por caso también es texto.
  u <- codigos_observados_consultar(sid, "E", "_uuid")
  expect_identical(u$tipo, "texto")
  expect_length(u$codigos, 0L)
})

test_that("en un .sav: la pregunta toma la etiqueta del instrumento y la columna no declarada la del archivo", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  p1 <- codigos_observados_consultar(sid, "2024", "p1")
  expect_identical(p1$tipo, "categorica")
  expect_identical(.co_n(p1), c(`1` = 3L, `2` = 2L, `99` = 1L))
  expect_identical(.co_etiquetas(p1), c(`1` = "Sí", `2` = "No", `99` = "No responde"))
  iv <- codigos_observados_consultar(sid, "2024", "indice_vbg")
  expect_identical(iv$tipo, "categorica")
  expect_identical(.co_n(iv), c(`1` = 2L, `2` = 2L, `3` = 2L))
  expect_identical(.co_etiquetas(iv), c(`1` = "Bajo", `2` = "Medio", `3` = "Alto"))
})

test_that("una columna no declarada sin etiquetas: categórica si es texto corto, numérica con tope si es número", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  f <- codigos_observados_consultar(sid, "2026", "facultad")
  expect_identical(f$tipo, "categorica")
  expect_identical(.co_codigos(f), c("Ciencias", "Derecho", "Letras"))
  expect_true(all(is.na(.co_etiquetas(f))))
  ix <- codigos_observados_consultar(sid, "2026", "indice")
  expect_identical(ix$tipo, "numerica")
  expect_length(ix$codigos, 40L)
  expect_false(ix$truncado)
  ixt <- codigos_observados_consultar(sid, "2026", "indice", tope = 10L)
  expect_true(ixt$truncado)
  expect_length(ixt$codigos, 10L)
  expect_identical(ixt$n_validos, 40L)
})

test_that("una calculada del ADR 0106 se consulta con sus códigos y su escala", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  base_variables_guardar_calculada(sid, "2026", .co_recurrio)
  r <- codigos_observados_consultar(sid, "2026", "recurrio")
  expect_identical(r$tipo, "categorica")
  # Ciclo de 5: (1,2)->1 (2,1)->1 (2,2)->0 (99,99)->NA (NA,NA)->NA, 8 vueltas.
  expect_identical(.co_n(r), c(`0` = 8L, `1` = 16L))
  expect_identical(r$n_validos, 24L)
  expect_identical(r$n_sin_dato, 16L)
})

test_that("consulta la base pedida, no la activa, y no muta la sesión", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  antes <- digest::digest(session_get(sid))
  r <- codigos_observados_consultar(sid, "2024", "p1")
  expect_identical(r$base, "2024")
  expect_identical(digest::digest(session_get(sid)), antes)
  expect_identical(.estudio_active_base_name(session_get(sid)), "2026")
  # p1 es de 2024: pedirla en 2026 no cae en la hermana.
  err <- tryCatch(codigos_observados_consultar(sid, "2026", "p1"), api_error = function(e) e)
  expect_identical(err$code, "E_CODIGOS_VARIABLE_NOT_FOUND")
  expect_equal(err$status, 404)
})

test_that("contrato HTTP de /api/carga/codigos-observados: montado, payload y errores", {
  skip_if_not_installed("haven")
  expect_true(grepl("mount_codigos_observados(pr)",
                    paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  ruta <- "/api/carga/codigos-observados"
  g <- .bv_call(mount_codigos_observados, "GET", ruta, sid, base = "2024", variable = "p1")
  expect_true(isTRUE(g$ok))
  expect_identical(names(g), c("ok", "base", "variable", "tipo", "codigos", "n_validos",
                               "n_sin_dato", "truncado"))
  expect_identical(names(g$codigos[[1]]), c("codigo", "etiqueta", "n"))
  json <- jsonlite::toJSON(g, auto_unbox = TRUE, null = "null", na = "null")
  expect_match(json, '"codigo":"1","etiqueta":"Sí","n":3', fixed = TRUE)
  f <- .bv_call(mount_codigos_observados, "GET", ruta, sid, base = "2026", variable = "facultad")
  expect_match(jsonlite::toJSON(f, auto_unbox = TRUE, null = "null", na = "null"),
               '"etiqueta":null', fixed = TRUE)

  code_of <- function(x) x$error$code %||% x$code
  expect_identical(code_of(.bv_call(mount_codigos_observados, "GET", ruta, sid, variable = "p1")),
                   "E_BASE_REQUIRED")
  expect_identical(code_of(.bv_call(mount_codigos_observados, "GET", ruta, sid,
                                    base = "1999", variable = "p1")), "E_BASE_NOT_FOUND")
  expect_identical(code_of(.bv_call(mount_codigos_observados, "GET", ruta, sid,
                                    base = "2024", variable = "no_existe")),
                   "E_CODIGOS_VARIABLE_NOT_FOUND")
  expect_identical(code_of(.bv_call(mount_codigos_observados, "GET", ruta, sid, base = "2024")),
                   "E_BAD_REQUEST")
})
