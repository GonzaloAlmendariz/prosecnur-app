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

# Decisión 4 de Gonzalo (contrato §7, campo `avisos`): lo que el motor de orden diría de la pregunta viaja en la
# respuesta como `[{codigo, texto}]`, para que el editor no lo recalcule ni parsee texto.
# «sector»: «Mixto» sin respuestas, «Otro (especifique)» residual y un «99» en los datos que la lista no tiene.
.rgc_sesion_avisos <- function() {
  testthat::skip_if_not_installed("openxlsx")
  t <- data.frame(codigo = c("1", "2", "3", "0"), etiqueta = c("Público", "Privado", "Mixto", "Otro (especifique)"),
                  n = c(10, 5, 0, 2), stringsAsFactors = FALSE)
  b <- .rgc_base(t)
  b$df <- data.frame(sector = c(b$df$sector, rep("99", 3)), stringsAsFactors = FALSE)
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes")), active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", list(docentes = b$df))
  session_set(sid, "rp_inst_sources", list(docentes = b$inst))
  sid
}

.rgc_av_codigos <- function(body) vapply(body$avisos, function(a) as.character(unlist(a$codigo)), "")
.rgc_av_textos <- function(body) vapply(body$avisos, function(a) as.character(unlist(a$texto)), "")

test_that("avisos: códigos fuera de la lista, categorías sin respuestas y residuales, con código estable y sin jerga", {
  sid <- .rgc_sesion_avisos(); on.exit(session_delete(sid), add = TRUE)
  r <- .rgc_get(sid, "?var=docentes%24sector")
  expect_identical(r$status, 200L)
  expect_identical(.rgc_av_codigos(r$body), c("codigos_fuera_de_lista", "categorias_sin_respuestas", "residuales_al_final"))
  tx <- .rgc_av_textos(r$body)
  expect_match(tx[1], "un código en los datos no está en la lista de opciones («99»)", fixed = TRUE)
  expect_match(tx[2], "una categoría del instrumento no tiene respuestas en esta base («Mixto»)", fixed = TRUE)
  expect_match(tx[3], "«Otro (especifique)» se reconoce como respuesta residual y va al final", fixed = TRUE)
  expect_true(all(startsWith(tx, "“Sector”: ")))
  expect_false(any(.aviso_tiene_jerga(tx)))
  expect_false(any(.aviso_tiene_voseo(tx)))
  # Las categorías y el orden no cambian: el «99» no entra en la lista.
  expect_identical(.rgc_codigos(r$body), c("1", "2", "3", "0"))
})

test_that("avisos: con un graficador de escala avisa que el orden no aplica, con la misma frase que el validador del plan", {
  sid <- .rgc_sesion_avisos(); on.exit(session_delete(sid), add = TRUE)
  r <- .rgc_get(sid, "?var=docentes%24sector&graficador=p_barras_apiladas")
  expect_identical(.rgc_av_codigos(r$body)[1], "escala_orden_ignorado")
  frase <- .goc_texto_escala("p_barras_apiladas")
  expect_identical(.rgc_av_textos(r$body)[1], paste0("“Sector”: ", frase, "."))
  slot <- .graficos_orden_cat_avisos_slot(list(graficador = "p_barras_apiladas", args = list(orden_categorias = list(modo = "frecuencia"))), "Lámina 1")
  expect_identical(slot, paste0("Lámina 1: ", frase))
  expect_false(.aviso_tiene_jerga(.rgc_av_textos(r$body)[1]))
  # Un graficador que no es escala no agrega el aviso.
  r2 <- .rgc_get(sid, "?var=docentes%24sector&graficador=p_barras_categoricas")
  expect_false("escala_orden_ignorado" %in% .rgc_av_codigos(r2$body))
})

test_that("avisos: una pregunta sin nada que decir responde un arreglo vacío, no un objeto ni null", {
  sid <- .rgc_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_categorias(plumber::pr())
  vacio <- list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = "/api/graficos/categorias", QUERY_STRING = "?var=sector",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = vacio))
  cuerpo <- as.character(pr$call(req)$body)
  expect_match(cuerpo, "\"avisos\":[]", fixed = TRUE)
})

test_that("avisos: la base por defecto viaja con el mismo texto que el aviso del motor, y una pregunta sin respuestas lo dice", {
  testthat::skip_if_not_installed("openxlsx")
  b <- lapply(.rgc_listas, .rgc_base)
  src <- list(data_sources = lapply(b, `[[`, "df"), inst_sources = lapply(b, `[[`, "inst"))
  r <- .rgc_avisos(.graficos_categorias_payload(src, "sector", base_activa = "egresados"))
  # «Otro» de docentes es residual: el aviso de base va primero y el de residuales lo sigue.
  expect_identical(vapply(r$valor$avisos, `[[`, "", "codigo"), c("base_por_defecto", "residuales_al_final"))
  expect_identical(r$valor$avisos[[1]]$texto, r$avisos)
  expect_length(.graficos_categorias_payload(src, "sector", base_activa = "estudiantes")$avisos, 0L)
  src$data_sources$docentes <- data.frame(otra = 1:3)
  p <- .graficos_categorias_payload(src, "docentes$sector")
  expect_identical(vapply(p$avisos, `[[`, "", "codigo"), c("pregunta_sin_respuestas", "residuales_al_final"))
  expect_false(any(.aviso_tiene_jerga(vapply(p$avisos, `[[`, "", "texto"))))
})
