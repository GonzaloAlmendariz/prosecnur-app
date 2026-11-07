source("setup-load-all.R")

# La propuesta del motor por job y con caché por firma (graficos_propuesta_job.R), y la memoria de pedido de las
# evaluaciones (graficos_memo_evaluacion.R). Fixture compacto: 40 aulas de 10 casos, dos capítulos, un resumen ejecutivo
# y un resumen de diferencias; Rao-Scott con la familia del informe.

.pj_base <- function() {
  set.seed(2026)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  sexo <- rep(c("1", "1", "2", "2"), 100)
  q <- ifelse(stats::runif(400) < ifelse(area == "1", 0.7, 0.2), "1", "2")
  t <- ifelse(stats::runif(400) < ifelse(sexo == "1", 0.8, 0.3), "1", "2")
  e <- sample(c("1", "2", "3", "4"), 400, replace = TRUE)
  z <- rep(c("1", "2"), 200)
  data.frame(aula = aula, area = area, sexo = sexo, q = q, t = t, e = e, z = z, stringsAsFactors = FALSE)
}

.pj_inst <- function() {
  testthat::skip_if_not_installed("openxlsx")
  survey <- data.frame(type = c("select_one ar", "select_one sx", "select_one qq", "select_one qq", "select_one ee", "select_one qq"),
                       name = c("area", "sexo", "q", "t", "e", "z"),
                       label = c("Área", "Sexo", "Pregunta q", "¿Trabajas?", "Escala e", "Pregunta z"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c("ar", "ar", "sx", "sx", "qq", "qq", rep("ee", 4)),
                        name = c("1", "2", "1", "2", "1", "2", "1", "2", "3", "4"),
                        label = c("Economía", "Sociales", "Mujer", "Hombre", "Sí", "No", "Nada", "Poco", "Bastante", "Mucho"),
                        stringsAsFactors = FALSE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), x)
  suppressMessages(reporte_instrumento(x))
}

.pj_grafico <- function(id, titulo, var, top2box = NULL) {
  args <- list(var = var)
  if (!is.null(top2box)) args$top2box_labels <- top2box
  list(id = id, tipo = "p_slide_1_grafico", payload = list(titulo = titulo, grafico = list(graficador = "p_barras_agrupadas", args = args)))
}
.pj_rot <- list(area = "Área", sexo = "Sexo")
.pj_plan <- function() list(
  list(id = "s1", tipo = "p_slide_seccion", payload = list(titulo = "Uno")),
  .pj_grafico("g1", "Pregunta q", "q"),
  .pj_grafico("g2", "Pregunta z", "z"),
  list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "Dos")),
  .pj_grafico("g3", "¿Trabajas?", "t"),
  .pj_grafico("g4", "Escala e", "e", top2box = c("Bastante", "Mucho")),
  list(id = "h1", tipo = "p_slide_hallazgos", payload = list(modo = "resumen", seleccion = "auto", rotulos = .pj_rot, cruces = list("area", "sexo"))),
  list(id = "r1", tipo = "p_slide_resumen_diferencias", payload = list(seleccion = "auto", rotulos = .pj_rot, cruces = list("area", "sexo"))))

.pj_sesion <- function(preguntas_clave = NULL) {
  inst <- .pj_inst()
  sid <- session_create()
  session_set(sid, "rp_data_sources", list(default = .pj_base()))
  session_set(sid, "rp_inst_sources", list(default = inst))
  plan <- list(slides = .pj_plan())
  if (!is.null(preguntas_clave)) plan$preguntas_clave <- preguntas_clave
  .graficos_config_set(sid, list(plan = plan))
  sid
}

.pj_http <- function(sid, path, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_propuesta(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = path, QUERY_STRING = "", HTTP_X_PULSO_SESSION = sid,
                             HEADERS = c(`x-pulso-session` = sid), rook.input = entrada, bodyRaw = crudo, postBody = body,
                             CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.pj_esperar <- function(job_id, segundos = 240) {
  limite <- Sys.time() + segundos
  repeat {
    j <- job_poll(job_id)
    if (!identical(j$status, "running")) return(j)
    if (Sys.time() > limite) { job_cancel(job_id); stop("El job de la propuesta no terminó a tiempo.") }
    Sys.sleep(0.2)
  }
}

.pj_cifras <- function(p) unlist(lapply(p$capitulos, function(c) c$cifras %||% c$filas), recursive = FALSE)

# ---- Memoria de pedido ------------------------------------------------------------------------------------------------

test_that("la memoria de pedido no cambia ninguna cifra: la propuesta con y sin memoria es idéntica", {
  sid <- .pj_sesion(); on.exit(session_delete(sid), add = TRUE)
  .propuesta_cache_vaciar()
  pedido <- .propuesta_pedido(sid, slide_id = "h1")
  con <- suppressMessages(.propuesta_calcular_pedido(pedido))
  # Sin memoria: se anula la que abre `.propuesta_resumen_calcular` dejando una «ya abierta» que no guarda nada.
  testthat::local_mocked_bindings(.gmemo_con = function(expr) expr, .gmemo_activa = function() FALSE)
  sin <- suppressMessages(.propuesta_calcular_pedido(pedido))
  expect_identical(con, sin)
  expect_gt(length(.pj_cifras(con)), 0L)
})

test_that("la memoria recuerda dentro del pedido y se suelta al salir", {
  d <- .pj_base()
  n <- 0L
  f <- function() { n <<- n + 1L; nrow(d) }
  expect_false(.gmemo_activa())
  .gmemo_con({
    expect_true(.gmemo_activa())
    expect_identical(.gmemo_obtener("x", list(d), .gmemo_llave("q", NULL), f), 400L)
    expect_identical(.gmemo_obtener("x", list(d), .gmemo_llave("q", NULL), f), 400L)
    # NULL y vacío son llaves distintas (en `.tarjetas_evaluar_cruce`, `filas = NULL` prueba todas y `character(0)` ninguna).
    .gmemo_obtener("x", list(d), .gmemo_llave("q", character(0)), f)
    # Otros datos, otro casillero.
    .gmemo_obtener("x", list(d[1:10, ]), .gmemo_llave("q", NULL), f)
  })
  expect_identical(n, 3L)
  expect_false(.gmemo_activa())
  .gmemo_obtener("x", list(d), .gmemo_llave("q", NULL), f)   # sin memoria: calcula
  expect_identical(n, 4L)
})

test_that("las celdas de `.dif_evaluar` conservan columnas y tipos", {
  inst <- .pj_inst()
  fuente <- .sig_fuente(.pj_base(), inst)
  r <- .sig_regla_fabrica(); r$prueba <- "rao_scott"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  fi <- .dif_indicador(fuente, .dif_item(list(var = "q", fila = "Sí")), r)
  ev <- suppressMessages(.dif_evaluar(fuente, fi, c("area", "sexo"), list(regla = r, familia = NULL)))
  ce <- ev$celdas
  expect_identical(names(ce), c("cruce", "codigo", "etiqueta", "estado", "valor", "dir", "fragil", "p", "p_resto", "n", "conglomerados"))
  expect_identical(vapply(ce, function(x) class(x)[1], ""),
                   c(cruce = "character", codigo = "character", etiqueta = "character", estado = "character", valor = "numeric",
                     dir = "character", fragil = "logical", p = "numeric", p_resto = "numeric", n = "integer",
                     conglomerados = "integer"))
  expect_identical(nrow(ce), 4L)
  expect_identical(sort(ev$probados), c("area", "sexo"))
  expect_true("dif" %in% ce$estado[ce$cruce == "area"])
})

# ---- Caché por firma --------------------------------------------------------------------------------------------------

test_that("la segunda llamada con la misma firma sale de la caché; una pregunta clave o un cruce la invalidan", {
  sid <- .pj_sesion(); on.exit(session_delete(sid), add = TRUE)
  .propuesta_cache_vaciar()
  calculos <- 0L
  original <- .propuesta_calcular_pedido
  testthat::local_mocked_bindings(.propuesta_calcular_pedido = function(pedido) { calculos <<- calculos + 1L; original(pedido) })
  p1 <- suppressMessages(.propuesta_resumen_sesion(sid, slide_id = "h1"))
  p2 <- suppressMessages(.propuesta_resumen_sesion(sid, slide_id = "h1"))
  expect_identical(calculos, 1L)
  expect_identical(p1, p2)

  # Marcar una pregunta clave (config sin guardar) cambia la firma y la propuesta.
  plan <- list(slides = .pj_plan(), preguntas_clave = list("e"))
  parsed <- list(config = list(plan = plan))
  f1 <- .propuesta_pedido(sid, slide_id = "h1")$firma
  f2 <- .propuesta_pedido(sid, slide_id = "h1", parsed = parsed)$firma
  expect_false(identical(f1, f2))
  p3 <- suppressMessages(.propuesta_resumen_sesion(sid, slide_id = "h1", parsed = parsed))
  expect_identical(calculos, 2L)
  expect_identical(vapply(Filter(function(x) isTRUE(x$clave), .pj_cifras(p3)), `[[`, "", "var"), "e")
  expect_false(any(vapply(.pj_cifras(p1), function(x) isTRUE(x$clave), TRUE)))

  # Otra pregunta clave, otra firma.
  parsed_t <- list(config = list(plan = list(slides = .pj_plan(), preguntas_clave = list("t"))))
  expect_false(identical(.propuesta_pedido(sid, slide_id = "h1", parsed = parsed_t)$firma, f2))

  # Quitar un cruce de la lámina sin guardar cambia la firma.
  slide <- .pj_plan()[[7]]; slide$payload$cruces <- list("area")
  f3 <- .propuesta_pedido(sid, parsed = list(slide = slide))$firma
  expect_false(identical(f3, f1))
  p4 <- suppressMessages(.propuesta_resumen_sesion(sid, parsed = list(slide = slide)))
  expect_identical(calculos, 3L)

  # Otros datos, otra firma.
  d <- .pj_base(); d$q <- rev(d$q)
  session_set(sid, "rp_data_sources", list(default = d))
  expect_false(identical(.propuesta_pedido(sid, slide_id = "h1")$firma, f1))
})

test_that("un error no se guarda en la caché y la caché tiene tope", {
  .propuesta_cache_vaciar()
  expect_false(.propuesta_cache_guardar("a", list(ok = FALSE, error = list(code = "E_PROPUESTA_TIPO"))))
  expect_null(.propuesta_cache_leer("a"))
  for (i in seq_len(.PROPUESTA_CACHE_MAX + 3L)) .propuesta_cache_guardar(sprintf("f%02d", i), list(ok = TRUE, i = i))
  expect_null(.propuesta_cache_leer("f01"))
  expect_identical(.propuesta_cache_leer(sprintf("f%02d", .PROPUESTA_CACHE_MAX + 3L))$i, .PROPUESTA_CACHE_MAX + 3L)
  .propuesta_cache_vaciar()
})

# ---- Job ----------------------------------------------------------------------------------------------------------------

test_that("el worker devuelve lo mismo que el síncrono y los errores como resultado con E_* registrado", {
  sid <- .pj_sesion(); on.exit(session_delete(sid), add = TRUE)
  .propuesta_cache_vaciar()
  sincrono <- suppressMessages(.propuesta_resumen_sesion(sid, slide_id = "r1"))
  pedido <- .propuesta_pedido(sid, slide_id = "r1")
  entrada <- list(args = pedido$args, opciones_motor = pedido$opciones_motor, fuentes_path = .propuesta_fuentes_rds(sid, pedido))
  path <- job_save_rds(sid, "propuesta_entrada", entrada)
  r <- suppressMessages(.propuesta_resumen_worker(path))
  expect_true(is.list(r$tiempos_ms))
  r$tiempos_ms <- NULL
  expect_identical(r, sincrono)
  # Una lámina que no se puede leer: error de dominio estructurado, no una caída del job.
  malo <- entrada; malo$args$slide$payload$cruces <- 1:3; malo$args$slide$payload$modo <- list(a = 1)
  malo$args$slide$tipo <- "p_slide_inventada"
  rm <- suppressMessages(.propuesta_resumen_worker(job_save_rds(sid, "propuesta_entrada", malo)))
  expect_false(rm$ok)
  expect_identical(rm$error$code, "E_PROPUESTA_TIPO")
  expect_identical(rm$error$status, 422L)
  # Un error inesperado: E_INTERNAL con error_id, sin el mensaje crudo.
  e <- .propuesta_error_resultado(simpleError("/Users/alguien/secreto.rds no existe"))
  expect_identical(e$error$code, "E_INTERNAL")
  expect_false(grepl("secreto", e$error$message, fixed = TRUE))
  expect_match(e$error$details$error_id, "^[0-9A-F]{8}$")
})

test_that("HTTP: POST /propuesta/job lanza el job; su result_data es la respuesta síncrona y la segunda vez nace hecho", {
  testthat::skip_if_not_installed("callr")
  testthat::skip_if_not(isTRUE(requireNamespace("pkgload", quietly = TRUE) && pkgload::is_dev_package("prosecnurapp")),
                        "El worker necesita el paquete cargado con load_all (o instalado).")
  sid <- .pj_sesion(); on.exit(session_delete(sid), add = TRUE)
  .propuesta_cache_vaciar()
  slide <- .pj_plan()[[7]]
  body <- as.character(jsonlite::toJSON(list(slide = slide), auto_unbox = TRUE))
  sincrono <- .pj_http(sid, "/api/graficos/resumenes/propuesta", body)
  expect_identical(sincrono$status, 200L)
  .propuesta_cache_vaciar()   # que el job calcule de verdad en el worker

  r <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", body)
  expect_identical(r$status, 200L)
  expect_identical(r$body$kind, "graficos.propuesta_resumen")
  expect_identical(r$body$slide_id, "h1")
  expect_false(r$body$cache)
  j <- .pj_esperar(r$body$job_id)
  expect_identical(j$status, "done")
  snap <- job_snapshot(j)
  expect_null(snap$result_data$tiempos_ms)
  js <- function(x) jsonlite::fromJSON(as.character(jsonlite::toJSON(x, auto_unbox = TRUE, na = "null", null = "null")), simplifyVector = FALSE)
  expect_identical(js(snap$result_data), sincrono$body)

  # Misma firma: el job nace terminado con el mismo resultado.
  r2 <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", body)
  expect_true(r2$body$cache)
  j2 <- job_poll(r2$body$job_id)
  expect_identical(j2$status, "done")
  expect_identical(js(job_snapshot(j2)$result_data), sincrono$body)

  # Por id de la lámina guardada.
  r3 <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", '{"slide_id": "h1"}')
  expect_identical(r3$status, 200L)
})

test_that("HTTP: POST /propuesta/job valida antes de lanzar, con los códigos registrados", {
  sid <- .pj_sesion(); on.exit(session_delete(sid), add = TRUE)
  r1 <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", '{"config": {}}')
  expect_identical(r1$status, 400L); expect_identical(r1$body$error$code, "E_PROPUESTA_SIN_LAMINA")
  r2 <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", '{"slide_id": "no-existe"}')
  expect_identical(r2$status, 404L); expect_identical(r2$body$error$code, "E_PROPUESTA_SIN_LAMINA")
  r3 <- .pj_http(sid, "/api/graficos/resumenes/propuesta/job", '{"slide_id": "g1"}')
  expect_identical(r3$status, 422L); expect_identical(r3$body$error$code, "E_PROPUESTA_TIPO")
  for (codigo in c("E_PROPUESTA_SIN_LAMINA", "E_PROPUESTA_TIPO", "E_PROPUESTA_LAMINA_INVALIDA", "E_INTERNAL")) {
    expect_true(codigo %in% errores_registrados()$codigo, info = codigo)
  }
})
