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

# Base con preguntas `text` que sólo traen números (la edad de HSyVbG 2026 P1,
# `text` con constraint regex), un id numérico por caso, un texto libre y una
# fecha tecleada como número.
.co_estudio_text_numerico <- function() {
  sid <- session_create()
  inst <- list(
    survey = data.frame(type = c("text", "text", "text", "date"),
                        name = c("p1_edad", "id_num", "opinion", "fecha"),
                        label = c("Edad", "Id", "Opinión", "Fecha"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = character(0), name = character(0), label = character(0),
                         stringsAsFactors = FALSE)
  )
  n <- 52L
  data <- data.frame(
    p1_edad = c(as.character(rep(c(40:18, 25L, 30L), 2L)), NA, NA),
    id_num = as.character(70000000L + seq_len(n)),
    opinion = c(sprintf("Me parece que %d", seq_len(n - 2L)), NA, NA),
    fecha = rep(c("20260101", "20260102"), n / 2L),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  .bv_add_base(sid, "T", inst, .bv_xlsx_bytes(list(data = data)), "data_t.xlsx", "xlsx")
  sid
}

test_that("una text con sólo números repetidos (la edad tecleada) sale numérica con códigos en orden numérico", {
  sid <- .co_estudio_text_numerico()
  on.exit(session_delete(sid), add = TRUE)
  r <- codigos_observados_consultar(sid, "T", "p1_edad")
  expect_identical(r$tipo, "numerica")
  expect_identical(.co_codigos(r), as.character(18:40))
  esperado <- stats::setNames(rep(2L, 23L), as.character(18:40))
  esperado[c("25", "30")] <- 4L
  expect_identical(.co_n(r), esperado)
  expect_identical(r$n_validos, 50L)
  expect_identical(r$n_sin_dato, 2L)
  expect_false(r$truncado)
})

test_that("una text numérica casi única (un id por caso) es identificador; la text libre y la date siguen siendo texto sin códigos", {
  sid <- .co_estudio_text_numerico()
  on.exit(session_delete(sid), add = TRUE)
  id <- codigos_observados_consultar(sid, "T", "id_num")
  expect_identical(id$tipo, "identificador")
  expect_length(id$codigos, 0L)
  expect_identical(id$n_validos, 52L)
  expect_identical(id$n_sin_dato, 0L)
  op <- codigos_observados_consultar(sid, "T", "opinion")
  expect_identical(op$tipo, "texto")
  expect_length(op$codigos, 0L)
  expect_identical(op$n_validos, 50L)
  fe <- codigos_observados_consultar(sid, "T", "fecha")
  expect_identical(fe$tipo, "texto")
  expect_length(fe$codigos, 0L)
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

test_that("una columna no declarada sin etiquetas: categórica si es texto corto, identificador si es un número distinto por caso", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  f <- codigos_observados_consultar(sid, "2026", "facultad")
  expect_identical(f$tipo, "categorica")
  expect_identical(.co_codigos(f), c("Ciencias", "Derecho", "Letras"))
  expect_true(all(is.na(.co_etiquetas(f))))
  # `indice` (seq/7) trae 40 valores distintos en 40 casos: más de un valor
  # distinto por cada dos casos. Antes salía `numerica` con los 40 códigos; con
  # la regla de privacidad un valor casi único por caso no se distingue de un
  # identificador, así que no lista valores (sí sus conteos de casos).
  ix <- codigos_observados_consultar(sid, "2026", "indice")
  expect_identical(ix$tipo, "identificador")
  expect_length(ix$codigos, 0L)
  expect_false(ix$truncado)
  expect_identical(ix$n_validos, 40L)
  expect_identical(ix$n_sin_dato, 0L)
})

test_that("el tope trunca los códigos de una escala numérica larga", {
  sid <- .co_estudio_edad()
  on.exit(session_delete(sid), add = TRUE)
  r <- codigos_observados_consultar(sid, "E", "edad", tope = 10L)
  expect_identical(r$tipo, "numerica")
  expect_true(r$truncado)
  expect_identical(.co_codigos(r), as.character(18:27))
  expect_identical(r$n_validos, 46L)
})

# Base con números que parecen identificadores y números que son escalas:
# teléfono (integer, con "0" como sin teléfono), DNI numérico único sin
# declarar, edad 18..40 y año de ingreso 2007..2024 tecleado como text.
.co_estudio_identificadores <- function() {
  sid <- session_create()
  inst <- list(
    survey = data.frame(type = c("integer", "integer", "text"),
                        name = c("telefono", "edad", "anio_ingreso"),
                        label = c("Teléfono", "Edad", "Año de ingreso"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = character(0), name = character(0), label = character(0),
                         stringsAsFactors = FALSE)
  )
  n <- 46L
  data <- data.frame(
    telefono = c(rep("0", 40L), "987654321", "912345678", "987654321", NA, NA, "0"),
    dni = 40000000 + seq_len(n),
    edad = rep(18:40, 2L),
    anio_ingreso = as.character(c(rep(2007:2024, 2L), 2015:2024)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  .bv_add_base(sid, "I", inst, .bv_xlsx_bytes(list(data = data)), "data_i.xlsx", "xlsx")
  sid
}

test_that("un teléfono o un DNI numérico salen identificador sin códigos; la edad y el año de ingreso siguen numéricos", {
  sid <- .co_estudio_identificadores()
  on.exit(session_delete(sid), add = TRUE)
  # Pocos distintos, pero un valor de 9 dígitos basta.
  tel <- codigos_observados_consultar(sid, "I", "telefono")
  expect_identical(tel$tipo, "identificador")
  expect_length(tel$codigos, 0L)
  expect_identical(tel$n_validos, 44L)
  expect_identical(tel$n_sin_dato, 2L)
  dni <- codigos_observados_consultar(sid, "I", "dni")
  expect_identical(dni$tipo, "identificador")
  expect_length(dni$codigos, 0L)
  expect_identical(dni$n_validos, 46L)
  ed <- codigos_observados_consultar(sid, "I", "edad")
  expect_identical(ed$tipo, "numerica")
  expect_identical(.co_codigos(ed), as.character(18:40))
  an <- codigos_observados_consultar(sid, "I", "anio_ingreso")
  expect_identical(an$tipo, "numerica")
  expect_identical(.co_codigos(an), as.character(2007:2024))
  expect_identical(an$n_validos, 46L)
})

test_that("contrato HTTP: un identificador sale con codigos vacío y sus conteos", {
  sid <- .co_estudio_identificadores()
  on.exit(session_delete(sid), add = TRUE)
  g <- .bv_call(mount_codigos_observados, "GET", "/api/carga/codigos-observados", sid,
                base = "I", variable = "telefono")
  expect_true(isTRUE(g$ok))
  json <- jsonlite::toJSON(g, auto_unbox = TRUE, null = "null", na = "null")
  expect_match(json, '"tipo":"identificador","codigos":[],"n_validos":44,"n_sin_dato":2', fixed = TRUE)
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
