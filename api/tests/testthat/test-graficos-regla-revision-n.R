source("setup-load-all.R")

# Re-revisión metodológica de la regla de preguntas (ADR 0135), hallazgos N3 a N6:
#   N3  /regla y /cifras convierten los args con la regla inclusiva y los rótulos cortos que aplicaron a las fuentes;
#   N4  las columnas «Sin información» que deciden `cabe_nativa` se cuentan sobre las preguntas ELEGIDAS;
#   N5  con ninguna elegida, `cabe_nativa` es false con su motivo (el render dibuja «Sin datos»);
#   N6  fuera del universo la métrica de una candidata no se publica.

.rn_escala <- function(cods, rotulos, conteos, datos_con_rotulo = FALSE) {
  inst <- list(survey = data.frame(name = paste0("a", 1:4), type = "select_one lk", list_name = "lk",
                                   label = c("Reglamentos", "Biblioteca", "Tutoría", "Salud"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = cods, label = rotulos, stringsAsFactors = FALSE), orders_list = NULL)
  val <- if (isTRUE(datos_con_rotulo)) rotulos else cods
  cols <- lapply(conteos, function(cn) rep(val, cn))
  L <- max(lengths(cols))
  d <- as.data.frame(lapply(cols, function(x) c(x, rep(NA, L - length(x)))), stringsAsFactors = FALSE)
  list(data_sources = list(doc = d), inst_sources = list(doc = inst))
}

.rn_metricas <- function(cnt) stats::setNames(vapply(cnt$candidatas, function(c) c$metrica %||% NA_real_, 0),
                                              vapply(cnt$candidatas, `[[`, "", "tema"))

# ---- N4 y N5 ------------------------------------------------------------------------------------------------------

test_that("N4: una candidata NO elegida con 99 no saca la escala de la lámina nativa", {
  cods <- c("1", "2", "3", "4", "5", "98", "99")
  src <- .rn_escala(cods, c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "No sabe", "No responde"),
                    list(a1 = c(5, 5, 10, 11, 10, 3, 0), a2 = c(5, 5, 9, 10, 10, 2, 0), a3 = c(10, 10, 5, 8, 7, 2, 0),
                         a4 = c(1, 1, 2, 15, 15, 1, 2)))
  cnt <- suppressMessages(.regla_preguntas_conteo("p_barras_divergentes",
                                                  list(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 60)), src))
  expect_false("doc$a4" %in% unlist(cnt$seleccionadas))
  expect_true(isTRUE(cnt$cabe_nativa))
  expect_true(is.na(cnt$motivo_imagen))
  # Elegida la del 99, sí son dos columnas «Sin información» y sale como imagen.
  cnt2 <- suppressMessages(.regla_preguntas_conteo("p_barras_divergentes", list(vars = "doc$*", regla = list(tipo = "todas")), src))
  expect_false(isTRUE(cnt2$cabe_nativa))
  expect_match(cnt2$motivo_imagen, "dos opciones sin información")
})

test_that("N5: con ninguna pregunta elegida, `cabe_nativa` es false con «Ninguna pregunta cumple la regla.»", {
  cods <- c("1", "2", "3", "4", "5", "9")
  src <- .rn_escala(cods, c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "No sabe"),
                    list(a1 = c(5, 5, 10, 11, 10, 8), a2 = c(5, 5, 9, 10, 10, 0), a3 = c(10, 10, 5, 8, 7, 0), a4 = c(2, 2, 2, 10, 10, 0)))
  cnt <- suppressMessages(.regla_preguntas_conteo("p_barras_divergentes",
                                                  list(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 5)), src))
  expect_length(cnt$seleccionadas, 0L)
  expect_identical(cnt$cabe_nativa, FALSE)
  expect_identical(cnt$motivo_imagen, "Ninguna pregunta cumple la regla.")
  expect_true(is.na(.regla_preguntas_motivo_imagen(FALSE, character(0), character(0))))
})

# ---- N6 -------------------------------------------------------------------------------------------------------------

test_that("N6: una pregunta sin valor en todos los públicos queda fuera del universo y sin métrica publicada", {
  ind <- data.frame(tema = c("A", "A", "B", "C", "C"), grupo = c("g1", "g2", "g1", "g1", "g2"),
                    valor = c(70, 40, 90, 60, 55), orden = c(1, 1, 2, 3, 3), stringsAsFactors = FALSE)
  ev <- .regla_preguntas_evaluar(ind, list(tipo = "bajo_umbral", umbral = 95))
  m <- stats::setNames(ev$candidatas$metrica, ev$candidatas$tema)
  expect_identical(unname(m[c("A", "C")]), c(40, 55))
  expect_true(all(c("A", "B", "C") %in% ev$temas))      # bajo_umbral no es entre grupos: B está en el universo
  ev2 <- .regla_preguntas_evaluar(ind, list(tipo = "mayor_diferencia", n = 3))
  m2 <- stats::setNames(ev2$candidatas$metrica, ev2$candidatas$tema)
  expect_true(is.na(m2[["B"]]))                          # entre públicos B no es común: sin métrica
  expect_identical(unname(m2[c("A", "C")]), c(30, 5))
  expect_false("B" %in% ev2$temas)
})

# ---- N3: HTTP con `config.plan.rotulos_cortos` ---------------------------------------------------------------------

.rn_http <- function(sid, ruta, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = ruta, QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("N3 HTTP: con un rótulo corto, /regla y /cifras excluyen por el rótulo largo y miden lo que dibuja la lámina", {
  skip_if_not_installed("openxlsx")
  labs <- c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "No sabe / no opina")
  src <- .rn_escala(as.character(c(1:5, 9)), labs,
                    list(a1 = c(5, 5, 10, 11, 10, 8), a2 = c(5, 5, 9, 10, 10, 0), a3 = c(10, 10, 5, 8, 7, 0), a4 = c(2, 2, 2, 10, 10, 0)),
                    datos_con_rotulo = TRUE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = data.frame(type = "select_one lk", name = paste0("a", 1:4),
                                                label = c("Reglamentos", "Biblioteca", "Tutoría", "Salud")),
                            choices = data.frame(list_name = "lk", name = as.character(c(1:5, 9)), label = labs)), x)
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", list(doc = suppressMessages(reporte_instrumento(x))))
  cfg <- '"config": {"plan": {"rotulos_cortos": {"No sabe / no opina": "NS/NO"}}}'
  args <- '{"vars": "doc$*", "excluir_opciones": ["No sabe / no opina"], "regla": {"tipo": "bajo_umbral", "umbral": 51.25}}'
  r <- .rn_http(sid, "/api/graficos/resumenes/regla", sprintf('{"graficador": "p_barras_divergentes", "args": %s, %s}', args, cfg))
  expect_identical(r$status, 200L)
  m <- stats::setNames(vapply(r$body$candidatas, function(c) as.numeric(c$metrica %||% NA), 0),
                       vapply(r$body$candidatas, `[[`, "", "tema"))
  # Con el 8 «No sabe / no opina» excluido, a1 tiene Top Two Box 21/41 = 51 (antes 42: la exclusión no casaba con «NS/NO»).
  expect_identical(unname(m[["doc$a1"]]), 51)
  # /cifras con la misma config: el Top Two Box que rotula la lámina.
  r2 <- .rn_http(sid, "/api/graficos/resumenes/cifras", sprintf('{"graficador": "p_barras_divergentes", "args": %s, %s}', args, cfg))
  expect_identical(r2$status, 200L)
  t2b <- Filter(function(c) identical(c$clave, "t2b:Reglamentos"), r2$body$cifras)
  expect_length(t2b, 1L)
  expect_identical(t2b[[1]]$texto, "51%")
  # El lote con la misma config convierte los args de cada lámina igual.
  r3 <- .rn_http(sid, "/api/graficos/resumenes/cifras",
                 sprintf('{"laminas": [{"id": "esc", "slide": {"graficador": "p_barras_divergentes", "args": %s}}], %s}', args, cfg))
  expect_identical(r3$status, 200L)
  t2b3 <- Filter(function(c) identical(c$clave, "t2b:Reglamentos"), r3$body$por_lamina$esc$cifras)
  expect_identical(t2b3[[1]]$texto, "51%")
})
