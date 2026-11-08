source("setup-load-all.R")

# ADR 0135, punto 6: «Elegir cifra» pide las cifras de todas las láminas de resumen en un solo pedido
# (graficos_cifras_lote.R). El error de una lámina va en su entrada; el lote sale en el orden del pedido.

.lote_fuentes <- function() {
  lk <- c("1", "2", "3", "4", "5", "9")
  inst <- list(survey = data.frame(name = c("q1", "q2"), type = c("select_one lk", "select_one lk"),
                                   list_name = c("lk", "lk"), label = c("Reglamentos", "Biblioteca"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = rep("lk", 6), name = lk,
                                    label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                              "No tengo información suficiente"), stringsAsFactors = FALSE),
               orders_list = NULL, listas_ordinales_declaradas = "lk")
  base <- function(a, b) data.frame(q1 = rep(lk, a), q2 = rep(lk, b), stringsAsFactors = FALSE)
  list(data_sources = list(docentes = base(c(2, 3, 5, 15, 10, 5), c(4, 6, 10, 10, 6, 4)),
                           estudiantes = base(c(5, 5, 10, 10, 8, 2), c(6, 8, 8, 9, 9, 0))),
       inst_sources = list(docentes = inst, estudiantes = inst))
}

.lote_cob <- list(graficador = "p_cobertura", args = list(universos = "Docentes: 50; Estudiantes: 80"))
.lote_mala <- list(graficador = "p_barras_agrupadas", args = list(var = "docentes$q1"))

test_that("el lote devuelve dos láminas en orden: una con sus cifras y otra con su error E_* sin tumbar a la primera", {
  skip_if_not_installed("ggplot2")
  r <- suppressMessages(.graficos_cifras_lote(
    list(list(id = "mala", slide = .lote_mala), list(id = "cob", slide = .lote_cob)), .lote_fuentes()))
  expect_true(r$ok)
  expect_identical(names(r$por_lamina), c("mala", "cob"))
  expect_identical(r$por_lamina$mala$error$code, "E_CIFRAS_INVALIDO")
  expect_true("E_CIFRAS_INVALIDO" %in% errores_registrados()$codigo)
  expect_length(r$por_lamina$mala$cifras, 0L)
  expect_null(r$por_lamina$cob$error)
  expect_identical(r$por_lamina$cob$tipo, "cobertura/1")
  claves <- vapply(r$por_lamina$cob$cifras, `[[`, "", "clave")
  expect_identical(claves, c("casos:Docentes", "tasa:Docentes", "casos:Estudiantes", "tasa:Estudiantes"))
  # Mismo cálculo que el pedido suelto: las cifras no discrepan.
  suelto <- suppressMessages(.graficos_cifras_de_grafico(.lote_cob$graficador, .lote_cob$args, .lote_fuentes()))
  expect_identical(r$por_lamina$cob$cifras, suelto$cifras)
})

test_that("dos láminas con el mismo gráfico se calculan una vez; un fallo no previsto sale E_INTERNAL con su error_id", {
  llamadas <- 0L
  testthat::local_mocked_bindings(.graficos_cifras_de_grafico = function(graficador, args, fuentes, presets = NULL) {
    llamadas <<- llamadas + 1L
    if (identical(graficador, "p_panorama")) stop("/Users/alguien/ruta/secreta no existe")
    list(ok = TRUE, tipo = "cobertura/1", cifras = list(list(clave = "casos:A")), avisos = list())
  })
  r <- suppressMessages(.graficos_cifras_lote(list(
    list(id = "a", slide = .lote_cob), list(id = "b", graficador = "p_cobertura", args = .lote_cob$args),
    list(id = "c", slide = list(graficador = "p_panorama", args = list()))), list()))
  expect_identical(llamadas, 2L)
  expect_identical(names(r$por_lamina), c("a", "b", "c"))
  expect_identical(r$por_lamina$a, r$por_lamina$b)
  expect_identical(r$por_lamina$c$error$code, "E_INTERNAL")
  expect_match(r$por_lamina$c$error$message, "ref\\. [0-9A-F]{8}")
  expect_false(grepl("secreta", r$por_lamina$c$error$message))
})

test_that("sólo los defectos del pedido entero tumban el lote", {
  falla <- function(laminas) tryCatch(.graficos_cifras_lote(laminas, list()), api_error = function(e) e$code)
  expect_identical(falla(list()), "E_CIFRAS_INVALIDO")
  expect_identical(falla("x"), "E_CIFRAS_INVALIDO")
  expect_identical(falla(list(list(slide = .lote_cob))), "E_CIFRAS_INVALIDO")
  expect_identical(falla(list(list(id = "a", slide = .lote_cob), list(id = "a", slide = .lote_cob))), "E_CIFRAS_INVALIDO")
  expect_identical(falla(rep(list(list(id = "a", slide = .lote_cob)), .CIFRAS_LOTE_TOPE + 1L)), "E_CIFRAS_INVALIDO")
})

.lote_http <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/cifras", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: POST /api/graficos/resumenes/cifras con `laminas` responde el lote en una llamada, sin romper el pedido suelto", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .lote_fuentes()
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
  r <- .lote_http(sid, paste0('{"laminas": [',
    '{"id": "cob", "slide": {"graficador": "p_cobertura", "args": {"universos": "Docentes: 50; Estudiantes: 80"}}},',
    '{"id": "mala", "slide": {"graficador": "p_barras_agrupadas", "args": {"var": "docentes$q1"}}}]}'))
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$ok))
  expect_identical(names(r$body$por_lamina), c("cob", "mala"))
  cob <- r$body$por_lamina$cob
  expect_identical(cob$tipo, "cobertura/1")
  expect_identical(vapply(cob$cifras, `[[`, "", "clave"), c("casos:Docentes", "tasa:Docentes", "casos:Estudiantes", "tasa:Estudiantes"))
  expect_identical(cob$cifras[[2]]$texto, "80%")
  expect_null(cob$error)
  expect_identical(r$body$por_lamina$mala$error$code, "E_CIFRAS_INVALIDO")
  expect_identical(r$body$por_lamina$mala$cifras, list())
  # El pedido suelto conserva su forma.
  r1 <- .lote_http(sid, '{"graficador": "p_cobertura", "args": {"universos": "Docentes: 50; Estudiantes: 80"}}')
  expect_identical(r1$status, 200L); expect_identical(r1$body$tipo, "cobertura/1")
  # Un lote mal formado es un 400 con código registrado.
  r2 <- .lote_http(sid, '{"laminas": [{"slide": {"graficador": "p_cobertura"}}]}')
  expect_identical(r2$status, 400L); expect_identical(r2$body$error$code, "E_CIFRAS_INVALIDO")
})
