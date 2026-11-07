source("setup-load-all.R")

# ADR 0135 §7 (enmienda al ADR 0104 en Gráficos): la revisión del emparejado entre públicos. Los pares salen de la
# matriz (filas sin `sugerida`); una pregunta sin par recibe hasta tres candidatas de la otra base por parecido de texto
# y con la misma firma de escala. Sólo lectura: guardar lo confirmado lo hace la UI con los endpoints de equivalencias.

.es_lk <- c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo")
.es_fr <- c("Nunca", "Pocas veces", "A veces", "Casi siempre", "Siempre")
.es_inst <- function(vars, labels, listas) list(
  survey = data.frame(name = vars, type = paste("select_one", listas), list_name = listas, label = labels, stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("lk", 5), rep("fr", 5)), name = rep(as.character(1:5), 2), label = c(.es_lk, .es_fr),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.es_fuentes <- function() {
  dv <- c("d1", "d2", "d3")
  ev <- c("e1", "e2", "e3", "e4")
  di <- .es_inst(dv, c("¿Conoce los reglamentos de la unidad?", "La biblioteca atiende lo que necesito", "Los docentes dominan su materia"),
                 c("lk", "lk", "lk"))
  ei <- .es_inst(ev, c("Conozco los reglamentos de la unidad", "La biblioteca atiende mis necesidades", "Hay servicios de salud oportunos",
                       "Los docentes dominan la materia"), c("lk", "lk", "lk", "fr"))
  datos <- function(vs) as.data.frame(stats::setNames(lapply(vs, function(v) rep(as.character(1:5), 4)), vs), stringsAsFactors = FALSE)
  ei$listas_ordinales_declaradas <- "fr"   # e4 es la única de su lista: es escala porque el estudio la declara (ADR 0135, punto 5)
  list(data_sources = list(docentes = datos(dv), estudiantes = datos(ev)), inst_sources = list(docentes = di, estudiantes = ei))
}
.es_equiv <- function() list(bases = c("docentes", "estudiantes"), filas = list(
  list(etiqueta_estandar = "Dominio de la materia", variables = list(docentes = "d3", estudiantes = "e3")),
  list(etiqueta_estandar = "Reglamentos", variables = list(docentes = "d1", estudiantes = "e1"), sugerida = TRUE)))

test_that("las palabras se comparan sin tildes, en minúsculas y sin palabras vacías", {
  expect_identical(.equiv_sugerir_tokens("¿Conoce LOS reglamentos de la Unidad?")[[1]], c("conoce", "reglamentos", "unidad"))
  expect_identical(.equiv_sugerir_tokens(NA)[[1]], character(0))
})

test_that("candidatas: misma firma, puntaje de Jaccard, a lo más tres y empate por el orden de destino", {
  o <- c(a = "La biblioteca atiende lo que necesito")
  d <- c(x = "La biblioteca atiende mis necesidades", y = "Servicios de salud", z = "Biblioteca atiende", w = "Biblioteca atiende",
         v = "La biblioteca atiende lo que necesito")
  f <- list(origen = c(a = "F1"), destino = c(x = "F1", y = "F1", z = "F1", w = "F1", v = "F2"))
  s <- .equiv_sugerir_pares(o, d, f)$a
  # v es idéntica pero con otra escala: no se propone. y no comparte palabras: bajo el mínimo.
  expect_identical(s$var, c("z", "w", "x"))
  expect_equal(s$puntaje, c(round(2 / 3, 3), round(2 / 3, 3), round(2 / 5, 3)))
  # Determinista: misma entrada, misma salida; con más de tres candidatas se queda con tres.
  expect_identical(.equiv_sugerir_pares(o, d, f), .equiv_sugerir_pares(o, d, f))
  d2 <- c(p = "biblioteca", q = "biblioteca atiende", r = "atiende", s = "necesito")
  s2 <- .equiv_sugerir_pares(o, d2, list(origen = c(a = "F"), destino = c(p = "F", q = "F", r = "F", s = "F")))$a
  expect_identical(nrow(s2), 3L); expect_identical(s2$var[1], "q")
  # Sin firma, nada.
  expect_identical(nrow(.equiv_sugerir_pares(o, d, list(origen = c(a = ""), destino = f$destino))$a), 0L)
})

test_that("la revisión: par de la matriz, sin par con sus candidatas y la fila sugerida no cuenta", {
  src <- .es_fuentes()
  r <- .graficos_emparejado(.es_equiv(), src, c("docentes", "estudiantes"))
  p <- r$preguntas
  por <- function(b, v) Filter(function(x) x$base == b && x$var == v, p)[[1]]
  d3 <- por("docentes", "d3")
  expect_identical(d3$estado, "matriz"); expect_identical(d3$tema, "Dominio de la materia")
  expect_identical(d3$par, list(base = "estudiantes", var = "e3", etiqueta = "Hay servicios de salud oportunos"))
  expect_length(d3$sugerencias, 0L)
  # d1 tiene una fila `sugerida` en la matriz: sin confirmar no cuenta, así que sale sin par y con su candidata.
  d1 <- por("docentes", "d1")
  expect_identical(d1$estado, "sin_par")
  expect_identical(d1$sugerencias[[1]]$var, "e1"); expect_identical(d1$sugerencias[[1]]$base, "estudiantes")
  # e3 ya tiene par: nunca es candidata. e4 tiene otra escala: tampoco.
  cands <- unlist(lapply(Filter(function(x) x$base == "docentes", p), function(x) vapply(x$sugerencias, `[[`, "", "var")))
  expect_false(any(c("e3", "e4") %in% cands))
  expect_identical(por("docentes", "d2")$sugerencias[[1]]$var, "e2")
  # Después, las de la otra base que quedan sin par, con candidatas de la primera.
  expect_identical(vapply(Filter(function(x) x$base == "estudiantes", p), `[[`, "", "var"), c("e1", "e2", "e4"))
  expect_length(por("estudiantes", "e4")$sugerencias, 0L)
  # `vars` acota el universo.
  r2 <- .graficos_emparejado(.es_equiv(), src, c("docentes", "estudiantes"), vars = list("docentes$d2", "estudiantes$e2"))
  expect_identical(vapply(r2$preguntas, `[[`, "", "var"), c("d2", "e2"))
})

test_that("bases inválidas responden E_EMPAREJADO_INVALIDO, registrado", {
  src <- .es_fuentes()
  cod <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
  expect_identical(cod(.graficos_emparejado(NULL, src, "docentes")), "E_EMPAREJADO_INVALIDO")
  expect_identical(cod(.graficos_emparejado(NULL, src, c("docentes", "docentes"))), "E_EMPAREJADO_INVALIDO")
  expect_identical(cod(.graficos_emparejado(NULL, src, c("docentes", "egresados"))), "E_EMPAREJADO_INVALIDO")
  expect_true("E_EMPAREJADO_INVALIDO" %in% errores_registrados()$codigo)
  # Sin matriz, todo sin par.
  r <- .graficos_emparejado(NULL, src, c("docentes", "estudiantes"))
  expect_true(all(vapply(r$preguntas, `[[`, "", "estado") == "sin_par"))
})

.es_http <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/emparejado", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: lee la matriz de la sesión y las dos bases, sin caer en la activa", {
  skip_if_not_installed("openxlsx")
  src <- .es_fuentes()
  xl <- function(i) {
    x <- tempfile(fileext = ".xlsx")
    openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
    suppressMessages(reporte_instrumento(x))
  }
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", list(docentes = xl(src$inst_sources$docentes), estudiantes = xl(src$inst_sources$estudiantes)))
  session_set(sid, "equivalencias_publicos", .es_equiv())
  # La declaración ordinal de `fr` llega desde Analítica por la ruta real (sin ella, e4 no es de escala).
  session_set(sid, "analitica_config_por_base", list(estudiantes = list(listas_ordinales = list(fr = TRUE))))
  r <- .es_http(sid, '{"bases": ["docentes", "estudiantes"]}')
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$ok))
  d3 <- Filter(function(x) x$var == "d3", r$body$preguntas)[[1]]
  expect_identical(d3$estado, "matriz"); expect_identical(d3$par$var, "e3")
  d1 <- Filter(function(x) x$var == "d1", r$body$preguntas)[[1]]
  expect_identical(d1$estado, "sin_par"); expect_true(is.list(d1$sugerencias))
  expect_identical(d1$sugerencias[[1]]$var, "e1")
  expect_true(is.numeric(d1$sugerencias[[1]]$puntaje))
  # Una sin candidatas sigue siendo un arreglo.
  e4 <- Filter(function(x) x$var == "e4", r$body$preguntas)[[1]]
  expect_true(is.list(e4$sugerencias)); expect_length(e4$sugerencias, 0L)
  r2 <- .es_http(sid, '{"bases": ["docentes"]}')
  expect_identical(r2$status, 400L); expect_identical(r2$body$error$code %||% r2$body$code, "E_EMPAREJADO_INVALIDO")
})
