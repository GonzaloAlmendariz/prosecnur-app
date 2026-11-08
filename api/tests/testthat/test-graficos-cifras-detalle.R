source("setup-load-all.R")

# El detalle de cifras (graficos_cifras_detalle.R): el inspector de la tarjeta muestra la cifra antes y después de
# cada control, y esa cifra tiene que ser la de la lámina, con sus pesos, filtros y exclusiones. Aquí se fija la
# paridad con lo que rotula el render (la especificación que dibuja la lámina) y con la cuenta ponderada a mano.

.det_inst <- function() {
  lk <- c("1", "2", "3", "4", "5", "9")
  survey <- data.frame(type = c("select_one lk", "select_one lk", "select_one sx"), name = c("q1", "q2", "sexo"),
                       label = c("Reglamentos", "Biblioteca", "Sexo"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("lk", 6), "sx", "sx"), name = c(lk, "1", "2"),
                        label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                  "No sabe", "Hombre", "Mujer"), stringsAsFactors = FALSE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), x)
  suppressMessages(reporte_instrumento(x))
}

.det_data <- function() {
  set.seed(7)
  lk <- c("1", "2", "3", "4", "5", "9")
  data.frame(q1 = sample(lk, 80, TRUE), q2 = sample(lk, 80, TRUE), sexo = sample(c("1", "2"), 80, TRUE),
             peso = round(runif(80, 0.4, 2.2), 2), stringsAsFactors = FALSE)
}

.det_fuentes <- local({
  memo <- NULL
  function() {
    if (is.null(memo)) memo <<- list(data_sources = list(doc = .det_data()), inst_sources = list(doc = .det_inst()))
    memo
  }
})

# La especificación que dibuja la lámina, renderizada aparte (el camino del export, sin el endpoint).
.det_espec <- function(graficador, args, src = .det_fuentes()) {
  el <- .rebuild_graf(list(graficador = graficador, args = args))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                           plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Paridad"))),
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(out$rendered[[1]], "pulso_espec", exact = TRUE)
}

.det <- function(graficador, args, caja = NULL) {
  suppressMessages(.graficos_cifras_de_grafico(graficador, args, .det_fuentes(), detalle = TRUE, caja = caja))
}

.det_textos <- function(fila) vapply(fila$valores, `[[`, "", "texto")
.det_valores <- function(fila) stats::setNames(vapply(fila$valores, `[[`, 0, "valor"), vapply(fila$valores, `[[`, "", "categoria"))

# La cuenta a mano: % ponderado de q1 entre las mujeres, redondeado desde 0,5.
.det_mano <- function(var = "q1", dec = 0L, filtro = TRUE) {
  d <- .det_data(); m <- if (isTRUE(filtro)) d$sexo == "2" else rep(TRUE, nrow(d))
  w <- tapply(d$peso[m], factor(d[[var]][m], levels = c("1", "2", "3", "4", "5", "9")), sum)
  w[is.na(w)] <- 0
  stats::setNames(.pulso_round_half_up(100 * as.numeric(w) / sum(w), dec),
                  c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "No sabe"))
}

test_that("categórica con pesos y filtro: cada cifra es la que rotula la lámina y la cuenta ponderada a mano", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  args <- list(var = "doc$q1", filtros = list(sexo = "2"))
  r <- .det("p_barras_categoricas", args)
  esp <- .det_espec("p_barras_categoricas", args)
  det <- r$detalle
  expect_identical(det$forma, "categorica")
  expect_identical(r$tipo, "categorica/1")
  fila <- det$filas[[1]]
  expect_identical(.det_textos(fila), esp$cifras)                       # paridad con el render
  expect_identical(vapply(fila$valores, `[[`, "", "categoria"), esp$rotulos)
  expect_equal(.det_valores(fila), .det_mano()[esp$rotulos])            # pesos y filtro, no n/total
  d <- .det_data(); m <- d$sexo == "2"
  expect_equal(det$base$n_ponderado, sum(d$peso[m]))
  expect_identical(det$base$n_casos, as.numeric(sum(m)))
  expect_identical(det$base$texto, sprintf("Base: %d", sum(m)))
  # La suma rotulada no cierra (101 %); el reparto cierra en 100 y la categórica lo admite porque es una distribución.
  expect_identical(fila$sumas$lamina$texto, "101%")
  expect_identical(fila$sumas$estandar$valor, 101)
  expect_identical(fila$sumas$reparto$valor, 100)
  expect_true(fila$sumas$reparto$aplica)
  expect_identical(det$redondeo, list(metodo = "estandar", decimales = 0L))
})

test_that("categórica: la caja pedida suma las cifras rotuladas de sus categorías (lámina 19)", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  r <- .det("p_barras_categoricas", list(var = "doc$q1", filtros = list(sexo = "2")), caja = list("De acuerdo", "Muy de acuerdo", "No existe"))
  fila <- r$detalle$filas[[1]]
  v <- .det_valores(fila)
  expect_identical(fila$caja$valor, unname(v["De acuerdo"] + v["Muy de acuerdo"]))
  expect_identical(fila$caja$origen, "pedido")
  expect_identical(unlist(fila$caja$categorias), c("De acuerdo", "Muy de acuerdo"))
})

test_that("agrupada de una serie: la base ponderada no se confunde con los casos que rotula", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  args <- list(var = "doc$q1", filtros = list(sexo = "2"))
  r <- .det("p_barras_agrupadas", args)
  esp <- .det_espec("p_barras_agrupadas", args)
  fila <- r$detalle$filas[[1]]
  expect_identical(.det_textos(fila), esp$cifras)
  expect_equal(.det_valores(fila), .det_mano(dec = 1L)[esp$rotulos])
  d <- .det_data(); m <- d$sexo == "2"
  expect_equal(r$detalle$base$n_ponderado, sum(d$peso[m]))
  expect_identical(r$detalle$base$n_casos, as.numeric(sum(m)))
})

test_that("apilada con pesos y filtro: cifras, Top Two Box de la lámina y sumas por método", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  args <- list(var = "doc$q1", filtros = list(sexo = "2"),
               overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
                                top2box_labels = c("De acuerdo", "Muy de acuerdo")))
  r <- .det("p_barras_apiladas", args)
  esp <- .det_espec("p_barras_apiladas", args)
  det <- r$detalle
  expect_identical(det$forma, "escala")
  fila <- det$filas[[1]]
  expect_identical(.det_textos(fila), unname(esp$cifras[1, ]))
  expect_equal(.det_valores(fila), .det_mano())
  expect_false(is.null(esp$box))
  expect_identical(fila$caja$texto, esp$box$cifras[1])
  expect_identical(fila$caja$origen, "lamina")
  expect_identical(fila$caja$valor, unname(.det_valores(fila)["De acuerdo"] + .det_valores(fila)["Muy de acuerdo"]))
  expect_identical(fila$sumas$lamina$valor, sum(.det_valores(fila)))
  expect_identical(fila$sumas$reparto$valor, 100)
  d <- .det_data(); m <- d$sexo == "2"
  expect_equal(fila$base$n_ponderado, sum(d$peso[m]))
  expect_identical(fila$base$n_casos, as.numeric(sum(m)))
  # Una caja pedida reemplaza a la de la lámina y nunca suma el especial.
  r2 <- .det("p_barras_apiladas", args, caja = c("Muy de acuerdo", "No sabe"))
  expect_identical(r2$detalle$filas[[1]]$caja$valor, unname(.det_valores(fila)["Muy de acuerdo"]))
})

test_that("divergente con pesos y filtro: cifras y lados negativo, neutro, positivo y «Sin información»", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  args <- list(vars = list("doc$q1", "doc$q2"), filtros = list(sexo = "2"))
  r <- .det("p_barras_divergentes", args)
  esp <- .det_espec("p_barras_divergentes", args)
  det <- r$detalle
  expect_identical(det$forma, "divergentes")
  expect_identical(vapply(det$filas, `[[`, "", "clave"), esp$filas)   # el orden de la lámina
  for (i in seq_along(esp$filas)) {
    fila <- det$filas[[i]]
    expect_identical(.det_textos(fila), esp$cifras[i, ])
    expect_identical(fila$lados$positivo$texto, esp$cifras_pos[i])
    expect_identical(fila$lados$negativo$texto, esp$cifras_neg[i])
    v <- .det_valores(fila)
    expect_identical(fila$lados$neutro$valor, unname(v["Ni uno ni otro"]))
    expect_identical(fila$lados$sin_informacion$valor, unname(v["No sabe"]))
    expect_identical(fila$caja$valor, fila$lados$positivo$valor)
  }
  mano <- .det_mano("q1")
  q1 <- det$filas[[match("Reglamentos", esp$filas)]]
  expect_equal(.det_valores(q1), mano)
  d <- .det_data(); m <- d$sexo == "2"
  expect_equal(det$base$n_ponderado, sum(d$peso[m]))
  expect_identical(det$base$n_casos, as.numeric(sum(m)))
  expect_identical(unlist(lapply(det$categorias, `[[`, "lado")), c("neg", "neg", "neu", "pos", "pos", "sin_inf"))
})

test_that("lote con variantes: el antes y el después de excluir una respuesta en un viaje, deduplicado", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  antes <- list(graficador = "p_barras_categoricas", args = list(var = "doc$q1"))
  despues <- list(graficador = "p_barras_categoricas", args = list(var = "doc$q1", excluir_opciones = list("9")))
  r <- suppressMessages(.graficos_cifras_lote(list(list(id = "antes", slide = antes), list(id = "despues", slide = despues),
                                                   list(id = "otra_vez", slide = antes),
                                                   list(id = "torta", slide = list(graficador = "p_pie", args = list(var = "doc$q1")))),
                                              .det_fuentes(), detalle = TRUE))
  expect_identical(names(r$por_lamina), c("antes", "despues", "otra_vez", "torta"))
  a <- r$por_lamina$antes$detalle; b <- r$por_lamina$despues$detalle
  d <- .det_data()
  expect_identical(a$base$n_casos, 80)
  expect_identical(b$base$n_casos, as.numeric(sum(d$q1 != "9")))
  expect_equal(b$base$n_ponderado, sum(d$peso[d$q1 != "9"]))
  expect_false("No sabe" %in% vapply(b$filas[[1]]$valores, `[[`, "", "categoria"))
  expect_equal(.det_valores(b$filas[[1]]), {
    w <- tapply(d$peso[d$q1 != "9"], d$q1[d$q1 != "9"], sum); v <- .pulso_round_half_up(100 * w / sum(w), 0)
    stats::setNames(as.numeric(v), c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo"))
  }[names(.det_valores(b$filas[[1]]))])
  expect_identical(r$por_lamina$otra_vez, r$por_lamina$antes)
  # Lo que no publica detalle va con su error en su entrada, sin tumbar el lote.
  expect_identical(r$por_lamina$torta$error$code, "E_CIFRAS_INVALIDO")
  expect_true(is.na(r$por_lamina$torta$detalle))
  # Paridad con el pedido suelto.
  expect_identical(r$por_lamina$despues$detalle, .det(despues$graficador, despues$args)$detalle)
})

test_that("sin `detalle` el contrato del cierre no cambia; un `detalle` o una `caja` mal formados son E_CIFRAS_INVALIDO", {
  codigo <- function(expr) tryCatch({ force(expr); "ok" }, api_error = function(e) e$code)
  expect_identical(codigo(.graficos_cifras_de_grafico("p_barras_categoricas", list(var = "doc$q1"), list())), "E_CIFRAS_INVALIDO")
  expect_identical(codigo(.graficos_cifras_pide_detalle("si")), "E_CIFRAS_INVALIDO")
  expect_identical(codigo(.graficos_cifras_pide_detalle(c(TRUE, FALSE))), "E_CIFRAS_INVALIDO")
  expect_false(.graficos_cifras_pide_detalle(NULL))
  expect_true(.graficos_cifras_pide_detalle(TRUE))
  expect_identical(codigo(.cifras_detalle_caja(list(list("a", "b")))), "E_CIFRAS_INVALIDO")
  expect_identical(codigo(.cifras_detalle_caja(as.list(as.character(1:60)))), "E_CIFRAS_INVALIDO")
  expect_identical(.cifras_detalle_caja(list(" De acuerdo ", "", "De acuerdo")), "De acuerdo")
  expect_true("E_CIFRAS_INVALIDO" %in% errores_registrados()$codigo)
  expect_null(.cifras_detalle(list(tipo = "pie")))
})

# ---- HTTP con sesión compartida ----------------------------------------------------------------------------------

.det_http <- function(sid, body) {
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

test_that("HTTP: POST /api/graficos/resumenes/cifras con `detalle` responde suelto y en lote sobre la misma sesión", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "rp_data_sources", list(doc = .det_data()))
  session_set(sid, "rp_inst_sources", list(doc = .det_inst()))
  r1 <- .det_http(sid, paste0('{"graficador": "p_barras_categoricas", "args": {"var": "doc$q1", "filtros": {"sexo": "2"}},',
                              ' "detalle": true, "caja": ["De acuerdo", "Muy de acuerdo"]}'))
  expect_identical(r1$status, 200L)
  det <- r1$body$detalle
  expect_identical(det$forma, "categorica")
  fila <- det$filas[[1]]
  esp <- .det_espec("p_barras_categoricas", list(var = "doc$q1", filtros = list(sexo = "2")))
  expect_identical(vapply(fila$valores, function(v) v$texto, ""), esp$cifras)
  expect_identical(det$base$n_casos, sum(.det_data()$sexo == "2"))
  expect_identical(fila$caja$origen, "pedido")
  expect_null(fila$lados)                                   # NA del motor sale como null
  expect_identical(fila$sumas$reparto$aplica, TRUE)
  # Lote sobre la misma sesión: el antes y el después de una exclusión, y una entrada que falla aparte.
  r2 <- .det_http(sid, paste0('{"detalle": true, "laminas": [',
    '{"id": "antes", "slide": {"graficador": "p_barras_divergentes", "args": {"vars": ["doc$q1"]}}},',
    '{"id": "despues", "slide": {"graficador": "p_barras_divergentes", "args": {"vars": ["doc$q1"], "excluir_opciones": ["9"]}}},',
    '{"id": "mala", "slide": {"graficador": "p_pie", "args": {"var": "doc$q1"}}}]}'))
  expect_identical(r2$status, 200L)
  expect_identical(names(r2$body$por_lamina), c("antes", "despues", "mala"))
  a <- r2$body$por_lamina$antes$detalle; b <- r2$body$por_lamina$despues$detalle
  expect_identical(a$base$n_casos, 80L)
  expect_identical(b$base$n_casos, sum(.det_data()$q1 != "9"))
  expect_identical(a$filas[[1]]$lados$sin_informacion$valor > 0, TRUE)
  expect_identical(b$filas[[1]]$lados$sin_informacion$valor, 0L)
  expect_identical(r2$body$por_lamina$mala$error$code, "E_CIFRAS_INVALIDO")
  expect_null(r2$body$por_lamina$mala$detalle)
  # Sin `detalle`, el mismo gráfico sigue sin publicar cifras para el cierre; un `detalle` mal formado es un 400.
  r3 <- .det_http(sid, '{"graficador": "p_barras_categoricas", "args": {"var": "doc$q1"}}')
  expect_identical(r3$status, 400L); expect_identical(r3$body$error$code, "E_CIFRAS_INVALIDO")
  r4 <- .det_http(sid, '{"graficador": "p_barras_categoricas", "args": {"var": "doc$q1"}, "detalle": "si"}')
  expect_identical(r4$status, 400L); expect_identical(r4$body$error$code, "E_CIFRAS_INVALIDO")
})
