source("setup-load-all.R")

# D8-2 (contrato docs/qa/contrato-orden-categorias-f6-2026-10-10.md §7): `GET /api/graficos/categorias` con una `var` sin
# base responde las categorías de la BASE ACTIVA de la sesión, no las de la primera. El verificador dejó vivo un mutante
# del router que no pasaba `base_activa` al payload (el test del payload lo llamaba directo): aquí se pide por la ruta
# Plumber de verdad —routing, query string, header de sesión y serialización— con una sesión de dos bases cuya misma
# variable tiene listas distintas, y la activa es la segunda.

# «sector» en docentes: Público/Privado/Otro; en estudiantes: Universidad/Instituto, con otros códigos.
.rgc_listas <- list(
  docentes = data.frame(codigo = c("1", "2", "3"), etiqueta = c("Público", "Privado", "Otro"), n = c(30, 20, 5), stringsAsFactors = FALSE),
  estudiantes = data.frame(codigo = c("7", "8"), etiqueta = c("Universidad", "Instituto"), n = c(12, 40), stringsAsFactors = FALSE)
)

.rgc_base <- function(t) {
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(
    survey = data.frame(type = "select_one ls", name = "sector", label = "Sector", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "ls", name = t$codigo, label = t$etiqueta, stringsAsFactors = FALSE)
  ), x)
  list(df = data.frame(sector = rep(t$codigo, t$n), stringsAsFactors = FALSE), inst = suppressMessages(reporte_instrumento(x)))
}

.rgc_sesion <- function(activa) {
  testthat::skip_if_not_installed("openxlsx")
  b <- lapply(.rgc_listas, .rgc_base)
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = activa, processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", lapply(b, `[[`, "df"))
  session_set(sid, "rp_inst_sources", lapply(b, `[[`, "inst"))
  sid
}

# La ruta tal como la sirve Plumber: request Rook mínimo (GET sin cuerpo) contra el router montado.
.rgc_get <- function(sid, query) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_categorias(plumber::pr())
  vacio <- list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = "/api/graficos/categorias", QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = vacio))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.rgc_codigos <- function(body) vapply(body$categorias, function(k) as.character(unlist(k$codigo)), "")

test_that("una var sin base responde las categorías de la base activa aunque no sea la primera", {
  sid <- .rgc_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  r <- .rgc_get(sid, "?var=sector")
  expect_identical(r$status, 200L)
  expect_identical(unlist(r$body$base), "estudiantes")
  expect_identical(.rgc_codigos(r$body), c("7", "8"))
  expect_identical(vapply(r$body$categorias, function(k) as.integer(unlist(k$n)), 0L), c(12L, 40L))
})

test_that("con la primera base activa responde la primera, y la calificada manda sobre la activa", {
  sid <- .rgc_sesion("docentes"); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.rgc_codigos(.rgc_get(sid, "?var=sector")$body), c("1", "2", "3"))
  sid2 <- .rgc_sesion("estudiantes"); on.exit(session_delete(sid2), add = TRUE)
  r <- .rgc_get(sid2, "?var=docentes%24sector")
  expect_identical(unlist(r$body$base), "docentes")
  expect_identical(.rgc_codigos(r$body), c("1", "2", "3"))
})

test_that("en el consolidado no hay base activa: la var sin base va contra la primera", {
  sid <- .rgc_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  testthat::local_mocked_bindings(
    .graficos_consolidado_sources = function(sid) list(data_sources = estudio_data_sources(sid), inst_sources = estudio_inst_sources(sid)),
    .package = "prosecnurapp"
  )
  r <- .rgc_get(sid, "?var=sector&scope=consolidado")
  expect_identical(r$status, 200L)
  expect_identical(unlist(r$body$base), "docentes")
})

test_that("sin var la ruta responde 400 E_BAD_CATEGORIAS_VAR", {
  sid <- .rgc_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  r <- .rgc_get(sid, "")
  expect_identical(r$status, 400L)
  expect_identical(unlist(r$body$error$code), "E_BAD_CATEGORIAS_VAR")
})

# Verificador de D8-2: si la base activa no estaba entre las fuentes, el payload se caía a la primera en silencio.
.rgc_avisos <- function(expr) {
  out <- character()
  val <- withCallingHandlers(expr, message = function(m) {
    t <- conditionMessage(m)
    if (grepl(.PULSO_AVISO_SELLO, t, fixed = TRUE)) out <<- c(out, trimws(sub(".*\\[PULSO-AVISO\\]", "", t)))
    invokeRestart("muffleMessage")
  })
  list(valor = val, avisos = out)
}

test_that("si la base activa no está entre las fuentes, cae en la primera y lo avisa", {
  testthat::skip_if_not_installed("openxlsx")
  b <- lapply(.rgc_listas, .rgc_base)
  src <- list(data_sources = lapply(b, `[[`, "df"), inst_sources = lapply(b, `[[`, "inst"))
  r <- .rgc_avisos(.graficos_categorias_payload(src, "sector", base_activa = "egresados"))
  expect_identical(r$valor$base, "docentes")
  expect_length(r$avisos, 1L)
  expect_match(r$avisos, "La base activa «egresados» no tiene datos listos para Gráficos", fixed = TRUE)
  expect_match(r$avisos, "«sector» se muestran con la base «docentes»", fixed = TRUE)
  # Sin base activa (consolidado o una sola base), con la activa presente o con la referencia calificada: no hay aviso.
  expect_length(.rgc_avisos(.graficos_categorias_payload(src, "sector"))$avisos, 0L)
  expect_length(.rgc_avisos(.graficos_categorias_payload(src, "sector", base_activa = ""))$avisos, 0L)
  expect_length(.rgc_avisos(.graficos_categorias_payload(src, "sector", base_activa = "estudiantes"))$avisos, 0L)
  q <- .rgc_avisos(.graficos_categorias_payload(src, "estudiantes$sector", base_activa = "egresados"))
  expect_length(q$avisos, 0L)
  expect_identical(q$valor$base, "estudiantes")
})
