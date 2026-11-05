source("setup-load-all.R")

# H13 del checklist de usabilidad del editor (2026-11-05): la propuesta del motor para el resumen ejecutivo y el
# resumen de diferencias. La propuesta es la selección automática que dibujaría la lámina, en la forma del payload del
# editor; puesta en manual, dibuja la misma lámina. Fixture: el de test-graficos-hallazgos.R (40 aulas de 10 casos).

.pp_base <- function() {
  set.seed(2026)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  niv <- ifelse(na >= 39, "10", c("6", "7", "8", "9")[((na - 1L) %% 4L) + 1L])
  sexo <- rep(c("1", "1", "2", "2"), 100)
  z <- rep(c("1", "2"), 200)
  q <- ifelse(stats::runif(400) < ifelse(area == "1", 0.7, 0.2), "1", "2")
  t <- ifelse(stats::runif(400) < c(`6` = 0.2, `7` = 0.3, `8` = 0.35, `9` = 0.8, `10` = 0.5)[niv], "1", "2")
  e <- sample(c("1", "2", "3", "4"), 400, replace = TRUE)
  data.frame(aula = aula, area = area, niv = niv, sexo = sexo, q = q, t = t, e = e, z = z, stringsAsFactors = FALSE)
}
.pp_inst <- function() list(
  survey = data.frame(name = c("area", "niv", "sexo", "q", "t", "e", "z"),
                      type = c("select_one ar", "select_one nv", "select_one sx", "select_one qq", "select_one sn", "select_one ee", "select_one qq"),
                      list_name = c("ar", "nv", "sx", "qq", "sn", "ee", "qq"),
                      label = c("Área", "Nivel", "Sexo", "Pregunta q", "¿Trabajas?", "Escala e", "Pregunta z"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("ar", "ar", rep("nv", 5), "sx", "sx", "qq", "qq", "sn", "sn", rep("ee", 4)),
                       name = c("1", "2", "6", "7", "8", "9", "10", "1", "2", "1", "2", "1", "2", "1", "2", "3", "4"),
                       label = c("Economía y Finanzas", "Ciencias políticas y sociales", "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9",
                                 "Nivel 10", "Mujer", "Hombre", "Sí", "No", "Sí", "No", "Nada", "Poco", "Bastante", "Mucho"),
                       stringsAsFactors = FALSE),
  orders_list = list(
    q = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta q"),
    z = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta z"),
    t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?"),
    e = list(names = c("1", "2", "3", "4"), labels = c("Nada", "Poco", "Bastante", "Mucho"), label = "Escala e")))
.pp_sig <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  list(regla = r, familia = NULL, m = 500L, cruces = c("area", "niv", "sexo"))
}
.pp_rot <- list(area = "Área", niv = "Nivel", sexo = "Sexo")

# El plan como lo guarda el editor: dos capítulos con sus preguntas, una escala con Top Two Box y las dos láminas de resumen.
.pp_grafico <- function(id, titulo, var, top2box = NULL) {
  args <- list(var = var)
  if (!is.null(top2box)) args$top2box_labels <- top2box
  list(id = id, tipo = "p_slide_1_grafico", payload = list(titulo = titulo, grafico = list(graficador = "p_barras_agrupadas", args = args)))
}
.pp_hallazgos <- function(modo = "resumen", seleccion = "auto", capitulos = NULL) {
  p <- list(modo = modo, seleccion = seleccion, rotulos = .pp_rot, cruces = list("area", "niv", "sexo"))
  if (!is.null(capitulos)) p$capitulos <- capitulos
  list(id = "h1", tipo = "p_slide_hallazgos", payload = p)
}
.pp_resumen <- function(seleccion = "auto", capitulos = NULL) {
  p <- list(seleccion = seleccion, rotulos = .pp_rot, cruces = list("area", "niv", "sexo"))
  if (!is.null(capitulos)) p$capitulos <- capitulos
  list(id = "r1", tipo = "p_slide_resumen_diferencias", payload = p)
}
.pp_plan <- function() list(
  list(id = "s1", tipo = "p_slide_seccion", payload = list(titulo = "Uno")),
  .pp_grafico("g1", "Pregunta q", "q"),
  .pp_grafico("g2", "Pregunta z", "z"),
  list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "Dos")),
  .pp_grafico("g3", "¿Trabajas?", "t"),
  .pp_grafico("g4", "Escala e", "e", top2box = c("Bastante", "Mucho")),
  .pp_hallazgos(), .pp_resumen())

.pp_calcular <- function(slide, ds = list(default = .pp_base()), is = list(default = .pp_inst()), ...) {
  .propuesta_resumen_calcular(slide, .pp_plan(), ds, is, sig_informe = .pp_sig(), inclusivo = FALSE, base = "default", ...)
}

# El motor como lo arma el job: el plan rearmado y el modelo de la lámina con la regla del estudio.
.pp_motor <- function(slide, ds = list(default = .pp_base()), is = list(default = .pp_inst())) {
  prep <- function(s) .graficos_calificar_refs_plan(list(slides = list(s)), "default")$slides[[1]]
  plan <- lapply(.pp_plan(), function(s) .graficos_rebuild_slide_json(prep(s)))
  el <- .graficos_rebuild_slide_json(prep(slide))$slots$plot
  fuente <- .sig_fuente(ds$default, is$default)
  suppressMessages(if (identical(el$.element_type, "hallazgos")) .halla_modelo(el, fuente, .pp_sig(), plan) else
    .resumen_dif_modelo(el, fuente, .pp_sig(), plan))
}

# Lo que el editor guarda: el payload sin los campos de sólo lectura, de ida y vuelta por JSON como la UI.
.pp_como_editor <- function(capitulos, registro) {
  solo_lectura <- c("pregunta", "frase", "cifra", "n", "diferencia", "diferencia_estado", "rotulo_lamina")
  caps <- lapply(capitulos, function(c) { c[[registro]] <- lapply(c[[registro]], function(x) x[setdiff(names(x), solo_lectura)]); c })
  jsonlite::fromJSON(jsonlite::toJSON(caps, auto_unbox = TRUE), simplifyVector = FALSE)
}

.pp_kpis <- function(e) lapply(e$kpis, function(k) list(var = k$var, fila = k$fila, cifra = k$cifra, texto = k$texto,
                                                         comparacion = k$comparacion, n = k$n))

test_that("resumen ejecutivo: la propuesta es la selección automática del motor, en la forma del payload", {
  p <- .pp_calcular(.pp_hallazgos())
  expect_identical(p$tipo, "p_slide_hallazgos")
  expect_identical(p$base, "default")
  auto <- .pp_motor(.pp_hallazgos())
  expect_identical(vapply(p$capitulos, `[[`, "", "titulo"), vapply(unlist(auto$paginas, recursive = FALSE), `[[`, "", "titulo"))
  cifras <- unlist(lapply(p$capitulos, `[[`, "cifras"), recursive = FALSE)
  expect_identical(vapply(cifras, `[[`, "", "var"), vapply(auto$kpis, `[[`, "", "var"))
  expect_identical(vapply(cifras, `[[`, "", "cifra"), vapply(auto$kpis, `[[`, "", "cifra"))
  expect_true(all(vapply(cifras, function(x) identical(x$comparacion, "auto"), TRUE)))
  # Las variables van sin la base, como las escribe el editor; la escala suma su Top Two Box.
  expect_false(any(grepl("$", vapply(cifras, `[[`, "", "var"), fixed = TRUE)))
  # La diferencia principal en una línea: «grupo N% ▲ frente al M% del resto» o «Sin diferencias por …».
  q <- cifras[[which(vapply(cifras, `[[`, "", "var") == "q")]]
  expect_identical(q$diferencia_estado, "diferencia")
  expect_match(q$diferencia, "^.+ [0-9]+% [▲▼△▽] frente al [0-9]+% del resto$")
  z <- cifras[[which(vapply(cifras, `[[`, "", "var") == "z")]]
  expect_identical(z$diferencia_estado, "sin_diferencias")
  expect_match(z$diferencia, "^Sin diferencias por ")
  expect_identical(q$pregunta, "Pregunta q")
})

test_that("resumen ejecutivo: la propuesta puesta en manual dibuja la misma lámina", {
  p <- .pp_calcular(.pp_hallazgos())
  auto <- .pp_motor(.pp_hallazgos())
  manual <- .pp_motor(.pp_hallazgos(seleccion = "manual", capitulos = .pp_como_editor(p$capitulos, "cifras")))
  expect_gt(length(auto$kpis), 0L)
  expect_identical(.pp_kpis(manual), .pp_kpis(auto))
  expect_identical(lapply(manual$paginas, function(pg) vapply(pg, `[[`, "", "titulo")),
                   lapply(auto$paginas, function(pg) vapply(pg, `[[`, "", "titulo")))
})

test_that("titulares: un hallazgo por capítulo, y el modo «cifras» no tiene propuesta", {
  p <- .pp_calcular(.pp_hallazgos(modo = "titulares"))
  expect_identical(p$modo, "titulares")
  expect_true(all(vapply(p$capitulos, function(c) length(c$cifras), 0L) == 1L))
  err <- tryCatch(.pp_calcular(.pp_hallazgos(modo = "cifras")), api_error = function(e) e)
  expect_identical(err$code, "E_PROPUESTA_TIPO"); expect_identical(err$status, 422)
  err2 <- tryCatch(.pp_calcular(list(id = "x", tipo = "p_slide_1_grafico", payload = list())), api_error = function(e) e)
  expect_identical(err2$code, "E_PROPUESTA_TIPO")
})

test_that("la propuesta no depende de lo que el analista ya escribió en manual", {
  escrito <- list(list(titulo = "Mío", cifras = list(list(var = "t", fila = "Sí", texto = "trabaja", comparacion = "auto"))))
  expect_identical(.pp_calcular(.pp_hallazgos(seleccion = "manual", capitulos = escrito))$capitulos, .pp_calcular(.pp_hallazgos())$capitulos)
  # Manual sin capítulos no se puede armar como lámina, pero sí tiene propuesta.
  expect_gt(length(.pp_calcular(.pp_hallazgos(seleccion = "manual"))$capitulos), 0L)
})

test_that("resumen de diferencias: la propuesta son las filas que elige el motor y, en manual, la misma tabla", {
  p <- .pp_calcular(.pp_resumen())
  expect_identical(p$tipo, "p_slide_resumen_diferencias")
  auto <- .pp_motor(.pp_resumen())
  expect_identical(vapply(p$capitulos, `[[`, "", "titulo"), vapply(auto$capitulos, `[[`, "", "titulo"))
  filas <- unlist(lapply(p$capitulos, `[[`, "filas"), recursive = FALSE)
  expect_true(all(vapply(filas, function(f) identical(f$diferencia_estado, "diferencia"), TRUE)))   # sólo filas con diferencia
  expect_true(all(vapply(filas, function(f) nzchar(f$rotulo) && nzchar(f$cifra), TRUE)))
  manual <- .pp_motor(.pp_resumen(seleccion = "manual", capitulos = .pp_como_editor(p$capitulos, "filas")))
  resumen <- function(e) lapply(e$capitulos, function(c) list(titulo = c$titulo, filas = lapply(c$filas, function(f)
    list(rotulo = f$rotulo, var = f$var, fila = f$fila, total = f$total, n = f$n, celdas = f$celdas))))
  expect_identical(resumen(manual), resumen(auto))
})

test_that("con los rótulos cortos del estudio, la respuesta vuelve con el rótulo del instrumento y la lámina no cambia", {
  ds <- list(default = .pp_base()); is <- list(default = .pp_inst())
  # Un rótulo corto sobre una respuesta que no decide la selección («Sí» sí la decide: es la opción principal de una
  # dicotómica, y renombrarla cambia legítimamente lo que elige el motor).
  cortos <- list(Mucho = "Muy")
  inc <- .inclusivo_preparar_preview(ds, is, NULL, rotulos_cortos = cortos)
  p <- .propuesta_resumen_calcular(.pp_hallazgos(), .pp_plan(), inc$data_sources, inc$inst_sources, sig_informe = .pp_sig(),
                                   mapa = inc$mapa, inclusivo = TRUE, base = "default", crudas = list(data_sources = ds, inst_sources = is))
  cifras <- unlist(lapply(p$capitulos, `[[`, "cifras"), recursive = FALSE)
  filas <- unlist(lapply(cifras, function(x) x$fila))
  expect_true("Mucho" %in% filas)
  expect_false("Muy" %in% filas)
  expect_true(any(grepl("«Muy»", unlist(lapply(cifras, `[[`, "frase")), fixed = TRUE)))   # la lámina sí dice el corto
  # Sin la traducción, la misma cifra (las proporciones no dependen del rótulo).
  p0 <- .pp_calcular(.pp_hallazgos())
  expect_identical(lapply(p$capitulos, function(c) vapply(c$cifras, `[[`, "", "cifra")),
                   lapply(p0$capitulos, function(c) vapply(c$cifras, `[[`, "", "cifra")))
})

test_that("la respuesta se serializa sin campos vacíos y en registro formal", {
  p <- .pp_calcular(.pp_hallazgos())
  js <- jsonlite::toJSON(p, auto_unbox = TRUE, na = "null")
  expect_false(grepl(":{}", js, fixed = TRUE))
  expect_true(grepl('"avisos":[', js, fixed = TRUE))
  textos <- unlist(lapply(unlist(lapply(p$capitulos, `[[`, "cifras"), recursive = FALSE), `[[`, "diferencia"))
  expect_false(any(grepl("[;·—–]", textos)))
})

# ---- Contrato HTTP: la ruta tal como la sirve Plumber, con una sesión de dos bases -------------------------------------

.pp_xlsform_inst <- function() {
  testthat::skip_if_not_installed("openxlsx")
  i <- .pp_inst()
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
  suppressMessages(reporte_instrumento(x))
}

# Dos bases con la misma forma; la activa es la SEGUNDA («estudiantes») y la primera no tiene diferencias en q, de modo que
# la base que se lee cambia la propuesta y el test ve cuál fue.
.pp_sesion <- function() {
  inst <- .pp_xlsform_inst()
  otra <- .pp_base(); otra$q <- rep(c("1", "2"), 200)
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", list(docentes = otra, estudiantes = .pp_base()))
  session_set(sid, "rp_inst_sources", list(docentes = inst, estudiantes = inst))
  .graficos_config_set(sid, list(plan = list(slides = .pp_plan())))
  sid
}

.pp_http <- function(sid, metodo, query = "", body = NULL) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_propuesta(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- if (is.null(body)) raw(0) else charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = metodo, PATH_INFO = "/api/graficos/resumenes/propuesta", QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = if (is.null(body)) NULL else crudo, postBody = body %||% "",
                             CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: GET y POST validan la lámina con los códigos registrados", {
  sid <- .pp_sesion(); on.exit(session_delete(sid), add = TRUE)
  r1 <- .pp_http(sid, "GET", "")
  expect_identical(r1$status, 400L); expect_identical(r1$body$error$code %||% r1$body$code, "E_PROPUESTA_SIN_LAMINA")
  r2 <- .pp_http(sid, "GET", "?slide_id=no-existe")
  expect_identical(r2$status, 404L); expect_identical(r2$body$error$code %||% r2$body$code, "E_PROPUESTA_SIN_LAMINA")
  r3 <- .pp_http(sid, "GET", "?slide_id=g1")
  expect_identical(r3$status, 422L); expect_identical(r3$body$error$code %||% r3$body$code, "E_PROPUESTA_TIPO")
  r4 <- .pp_http(sid, "POST", "", '{"config": {}}')
  expect_identical(r4$status, 400L); expect_identical(r4$body$error$code %||% r4$body$code, "E_PROPUESTA_SIN_LAMINA")
})

test_that("HTTP: GET lee la lámina guardada de la base activa, y POST la lámina sin guardar", {
  sid <- .pp_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- .pp_http(sid, "GET", "?slide_id=h1")
  expect_identical(r$status, 200L)
  expect_identical(r$body$tipo, "p_slide_hallazgos")
  # Sin `fuente`, la lámina lee la PRIMERA base de las fuentes del procesamiento, en la vista previa y en el PPT
  # (`.dif_fuente_render` → `.cifra_fuente`), no la activa. La propuesta reproduce lo que dibujaría la lámina y lo
  # declara en `base`; el defecto del motor queda reportado (H13, multibase).
  primera <- names(.graficos_processing_sources(sid)$data_sources)[1]
  expect_identical(r$body$base, primera)
  directo <- .propuesta_resumen_sesion(sid, slide_id = "h1")
  expect_identical(vapply(unlist(lapply(r$body$capitulos, `[[`, "cifras"), recursive = FALSE), `[[`, "", "cifra"),
                   vapply(unlist(lapply(directo$capitulos, `[[`, "cifras"), recursive = FALSE), `[[`, "", "cifra"))
  # La cifra de cada hallazgo es la de la base declarada.
  datos <- .graficos_processing_sources(sid)$data_sources[[primera]]
  z <- Filter(function(x) identical(x$var, "z"), unlist(lapply(r$body$capitulos, `[[`, "cifras"), recursive = FALSE))
  expect_length(z, 1L)
  expect_identical(z[[1]]$cifra, .tarjetas_pct(100 * mean(datos$z == "1")))
  # POST: la lámina de resumen de diferencias sin guardar, en modo manual vacío, igual tiene propuesta.
  body <- jsonlite::toJSON(list(slide = .pp_resumen(seleccion = "manual")), auto_unbox = TRUE)
  rp <- .pp_http(sid, "POST", "", as.character(body))
  expect_identical(rp$status, 200L)
  expect_identical(rp$body$tipo, "p_slide_resumen_diferencias")
  expect_gt(length(rp$body$capitulos), 0L)
  expect_true(all(vapply(rp$body$capitulos, function(c) length(c$filas) > 0L, TRUE)))
})
