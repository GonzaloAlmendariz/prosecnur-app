source("setup-load-all.R")

# O3b-a (plan-texto-abierto-ccss-2026-10-24): `GET /api/graficos/citas-candidatas` alimenta la tarjeta de aprobación de
# citas. Devuelve las candidatas de `.citas_seleccionar` (id, texto anonimizado, chars, puntaje, revision, propuesta),
# puntuadas con el diccionario de la pregunta (TXT-6/7) y del tema filtrado. Una pregunta sin base se lee en la BASE
# ACTIVA, no en la primera. Se pide por la ruta Plumber de verdad (routing, query, header de sesión y serialización).

.rgcit_textos <- c(
  "Los alumnos necesitan más horarios de tutoría en la tarde para todos.",
  "Los estudiantes piden más horarios de tutoría durante los sábados también.",
  "Los estudiantes reclaman horarios de tutoría más flexibles en el verano.",
  "La cafetería debería tener comida vegetariana y precios más baratos ya.",
  "Escríbanme a alguien@correo.pe para hablar de los horarios de tutoría del ciclo.",
  "-")

.rgcit_base <- function(textos, recod) {
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(
    survey = data.frame(type = c("text", "text"), name = c("coment", "coment_recod"), label = c("Comentario", "Tema"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "x", name = "1", label = "x", stringsAsFactors = FALSE)
  ), x)
  list(df = data.frame(coment = textos, coment_recod = recod, stringsAsFactors = FALSE), inst = suppressMessages(reporte_instrumento(x)))
}

.rgcit_sesion <- function(activa = "estudiantes", dic = NULL) {
  testthat::skip_if_not_installed("openxlsx")
  b <- list(docentes = .rgcit_base(rev(.rgcit_textos)[-1], rep("A", 5)),
            estudiantes = .rgcit_base(.rgcit_textos, c("A", "A B", "B", "C", "A", NA)))
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = activa, processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", lapply(b, `[[`, "df"))
  session_set(sid, "rp_inst_sources", lapply(b, `[[`, "inst"))
  if (!is.null(dic)) session_set(sid, "texto_abierto_diccionario", list(estudiantes = list(coment = .txt_dic_normalizar(dic))))
  sid
}

.rgcit_get <- function(sid, query) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_citas(plumber::pr())
  vacio <- list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = "/api/graficos/citas-candidatas", QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = vacio))
  r <- pr$call(req)
  # El serializador de `plumber::pr()` no desenvuelve escalares («["x"]»); la app sí. Se desenvuelven aquí.
  un <- function(x) if (is.list(x) && length(x) == 1L && is.null(names(x)) && !is.list(x[[1]])) x[[1]] else if (is.list(x)) lapply(x, un) else x
  list(status = as.integer(r$status), body = un(jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)))
}

.rgcit_dic <- list(equivalencias = list(list(mostrar = "estudiantes", formas = list("alumnos", "estudiantes"))),
                   excluir = list(), frases = list())

test_that("una variable sin base responde las candidatas de la base activa, anonimizadas y sin persona", {
  sid <- .rgcit_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  r <- .rgcit_get(sid, "?variable=coment")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base, "estudiantes")
  expect_identical(r$body$variable, "coment")
  expect_identical(r$body$comentarios, 5L)
  cand <- r$body$candidatas
  expect_gte(length(cand), 4L)
  expect_true(all(vapply(cand, function(k) all(c("id", "texto", "chars", "puntaje", "revision", "propuesta") %in% names(k)), logical(1))))
  expect_false(any(vapply(cand, function(k) "persona" %in% names(k), logical(1))))
  textos <- vapply(cand, function(k) k$texto, "")
  expect_false(any(grepl("@", textos)))
  ref <- .citas_seleccionar(.rgcit_textos)$candidatas
  expect_identical(vapply(cand, function(k) k$id, ""), ref$id)
  # En docentes (la primera base) la quinta frase no existe; aquí sí: no cayó en la primera.
  expect_true(any(grepl("cafetería", textos)))
})

test_that("las candidatas se puntúan con el diccionario de la pregunta y se filtran por el código del tema", {
  sid <- .rgcit_sesion("estudiantes", dic = .rgcit_dic); on.exit(session_delete(sid), add = TRUE)
  r <- .rgcit_get(sid, "?variable=coment&base=estudiantes")
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$diccionario))
  con <- .citas_seleccionar(.rgcit_textos, equivalencias = .txt_dic_normalizar(.rgcit_dic)$equivalencias)$candidatas
  sin <- .citas_seleccionar(.rgcit_textos)$candidatas
  pts <- vapply(r$body$candidatas, function(k) as.integer(k$puntaje), 1L)
  expect_identical(pts, con$puntaje)
  expect_false(identical(con$puntaje[match(sin$id, con$id)], sin$puntaje))   # el diccionario cambia el puntaje
  # Filtro por código multicódigo: «B» casa «A B» y «B».
  q <- paste0("?variable=coment&base=estudiantes&filtros=", utils::URLencode('{"coment_recod":"B"}', reserved = TRUE))
  f <- .rgcit_get(sid, q)
  expect_identical(f$status, 200L)
  expect_identical(f$body$comentarios, 2L)
  expect_setequal(vapply(f$body$candidatas, function(k) k$texto, ""), .rgcit_textos[2:3])
})

test_that("los errores llegan tipados: sin variable, variable o base inexistente y filtros ilegibles", {
  sid <- .rgcit_sesion("estudiantes"); on.exit(session_delete(sid), add = TRUE)
  e <- .rgcit_get(sid, "?base=estudiantes")
  expect_identical(e$status, 400L); expect_identical(e$body$error$code, "E_CITAS_SIN_VARIABLE")
  e <- .rgcit_get(sid, "?variable=no_existe")
  expect_identical(e$status, 404L); expect_identical(e$body$error$code, "E_CITAS_VARIABLE_NO_EXISTE")
  e <- .rgcit_get(sid, "?variable=coment&base=fantasma")
  expect_identical(e$status, 404L); expect_identical(e$body$error$code, "E_CITAS_BASE_NO_EXISTE")
  e <- .rgcit_get(sid, paste0("?variable=coment&filtros=", utils::URLencode("{no es json", reserved = TRUE)))
  expect_identical(e$status, 400L); expect_identical(e$body$error$code, "E_CITAS_FILTRO_INVALIDO")
  e <- .rgcit_get(sid, paste0("?variable=coment&filtros=", utils::URLencode('{"coment_recod_x":"B"}', reserved = TRUE)))
  expect_identical(e$status, 400L); expect_identical(e$body$error$code, "E_CITAS_FILTRO_INVALIDO")
})

test_that("el mount está registrado en la app", {
  src <- readLines(testthat::test_path("..", "..", "R", "plumber_app.R"), warn = FALSE)
  expect_true(any(grepl("mount_graficos_citas(pr)", src, fixed = TRUE)))
})
