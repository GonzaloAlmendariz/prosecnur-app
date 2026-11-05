source("setup-load-all.R")

# H14 del checklist de usabilidad del editor (2026-11-05): las preguntas clave del estudio (`plan$preguntas_clave`) y la
# selección automática del resumen ejecutivo y del resumen de diferencias que las prefiere. Fixture: 40 aulas de 10 casos.
#
#   q  Sí/No, depende del área (diferencia de unos 40 puntos)
#   m  tres opciones: la 1 domina en un área y la 2 en la otra (dos filas con diferencia de la MISMA pregunta)
#   t  Sí/No, sube con el nivel (diferencia más débil que q y m)
#   w  80/20 exacto en cada aula: sin diferencia y lejos del 50 %
#   k, k2  60/40 exacto en cada aula: sin diferencia y cerca del 50 % (empatadas)
#   z  50/50 exacto (capítulo «Dos», sin preguntas clave)

.pk_base <- function() {
  set.seed(14)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  niv <- c("6", "7", "8", "9")[((na - 1L) %% 4L) + 1L]
  sexo <- rep(c("1", "1", "2", "2"), 100)
  u <- stats::runif(400)
  q <- ifelse(u < ifelse(area == "1", 0.65, 0.25), "1", "2")
  u2 <- stats::runif(400)
  m <- ifelse(area == "1", ifelse(u2 < 0.85, "1", ifelse(u2 < 0.9, "2", "3")), ifelse(u2 < 0.05, "1", ifelse(u2 < 0.9, "2", "3")))
  t <- ifelse(stats::runif(400) < c(`6` = 0.25, `7` = 0.3, `8` = 0.35, `9` = 0.6)[niv], "1", "2")
  bloque <- function(n1) rep(c(rep("1", n1), rep("2", 10 - n1)), 40)
  data.frame(aula = aula, area = area, niv = niv, sexo = sexo, q = q, m = m, t = t, w = bloque(8), k = bloque(6), k2 = bloque(6),
             z = bloque(5), stringsAsFactors = FALSE)
}
.pk_inst <- function() {
  sn <- list(names = c("1", "2"), labels = c("Sí", "No"))
  ol <- lapply(c(q = "Pregunta q", t = "¿Trabajas?", w = "Pregunta w", k = "Pregunta k", k2 = "Pregunta k2", z = "Pregunta z"),
               function(l) c(sn, list(label = l)))
  ol$m <- list(names = c("1", "2", "3"), labels = c("Opción uno", "Opción dos", "Opción tres"), label = "Pregunta m")
  vars <- c("q", "m", "t", "w", "k", "k2", "z")
  list(
    survey = data.frame(name = c("area", "niv", "sexo", vars),
                        type = c("select_one ar", "select_one nv", "select_one sx", "select_one sn", "select_one mm", rep("select_one sn", 5)),
                        list_name = c("ar", "nv", "sx", "sn", "mm", rep("sn", 5)),
                        label = c("Área", "Nivel", "Sexo", vapply(vars, function(v) ol[[v]]$label, "")), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("ar", "ar", rep("nv", 4), "sx", "sx", "sn", "sn", "mm", "mm", "mm"),
                         name = c("1", "2", "6", "7", "8", "9", "1", "2", "1", "2", "1", "2", "3"),
                         label = c("Economía", "Ciencias", "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9", "Mujer", "Hombre", "Sí", "No",
                                   "Opción uno", "Opción dos", "Opción tres"), stringsAsFactors = FALSE),
    orders_list = ol)
}
.pk_sig <- function(claves = NULL) {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  s <- list(regla = r, familia = NULL, m = 500L, cruces = c("area", "niv", "sexo"))
  .preguntas_clave_en_contexto(s, claves)
}
.pk_plan <- function() list(
  p_slide_seccion("Uno"),
  p_slide_1_grafico(p_barras_agrupadas(var = "q"), titulo = "Pregunta q"),
  p_slide_1_grafico(p_barras_agrupadas(var = "m"), titulo = "Pregunta m"),
  p_slide_1_grafico(p_barras_agrupadas(var = "t"), titulo = "¿Trabajas?"),
  p_slide_1_grafico(p_barras_agrupadas(var = "w"), titulo = "Pregunta w"),
  p_slide_1_grafico(p_barras_agrupadas(var = "k"), titulo = "Pregunta k"),
  p_slide_1_grafico(p_barras_agrupadas(var = "k2"), titulo = "Pregunta k2"),
  p_slide_seccion("Dos"),
  p_slide_1_grafico(p_barras_agrupadas(var = "z"), titulo = "Pregunta z"))
.pk_rot <- list(area = "Área", niv = "Nivel", sexo = "Sexo")
.pk_auto <- function(claves = NULL, por_cap = 2L) {
  fuente <- .sig_fuente(.pk_base(), .pk_inst())
  el <- p_slide_hallazgos(modo = "resumen", seleccion = "auto", rotulos = .pk_rot)$slots$plot
  sig <- .pk_sig(claves)
  cx <- .dif_cruces(el, .pk_plan(), sig, fuente)
  avisos <- character(0)
  caps <- withCallingHandlers(.halla_res_auto(fuente, sig, cx, list(), .pk_plan(), por_cap),
                              message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(caps = caps, avisos = avisos)
}
.pk_vars <- function(cap) vapply(cap$cifras, function(x) .sig_var_local(x$var), "")
.pk_cap <- function(r, titulo) Filter(function(c) identical(c$titulo, titulo), r$caps)[[1]]

# La regla de antes (`.halla_res_auto` hasta v7.26), para mostrar qué cambia: la diferencia más fuerte, la más rotunda
# sin diferencia y, para completar el tope, más diferencias, aunque repitan pregunta.
.pk_regla_anterior <- function(fuente, sig, cx, plan, por_cap) {
  cands <- unlist(lapply(.resumen_dif_preguntas_plan(plan), function(q) .resumen_dif_candidatas(fuente, q, sig$regla)), recursive = FALSE)
  v <- list()
  for (cd in cands) {
    it <- .dif_item(cd); fi <- .dif_indicador(fuente, it, sig$regla)
    if (!is.null(fi$excluir) || !is.finite(fi$total)) next
    ev <- .dif_evaluar(fuente, fi, cx$cruces, sig, list())
    v[[length(v) + 1L]] <- list(capitulo = cd$capitulo, var = fi$var, fuerza = .dif_fuerza(ev$celdas), total = fi$total)
  }
  cp <- v[vapply(v, function(x) identical(x$capitulo, "Uno"), TRUE)]
  dif <- Filter(function(x) x$fuerza[["tam"]] > 0, cp)
  dif <- dif[order(-vapply(dif, function(x) x$fuerza[["firme"]], 0), -vapply(dif, function(x) x$fuerza[["tam"]], 0))]
  vapply(dif, `[[`, "", "var")
}

test_that("el fixture tiene lo que el test necesita: m es la diferencia más fuerte y repite pregunta entre sus opciones", {
  fuente <- .sig_fuente(.pk_base(), .pk_inst())
  el <- p_slide_hallazgos(modo = "resumen", seleccion = "auto", rotulos = .pk_rot)$slots$plot
  sig <- .pk_sig()
  orden <- suppressMessages(.pk_regla_anterior(fuente, sig, .dif_cruces(el, .pk_plan(), sig, fuente), .pk_plan(), 3L))
  expect_identical(orden[1:2], c("m", "m"))   # la regla de antes completaba con la otra opción de m
  expect_true(all(c("q", "t") %in% orden))
  expect_false(any(c("w", "k", "k2") %in% orden))
})

test_that("sin preguntas clave: la regla de siempre, pero nunca dos filas de la misma pregunta", {
  r <- .pk_auto(por_cap = 3L)
  uno <- .pk_cap(r, "Uno")
  vars <- .pk_vars(uno)
  expect_identical(vars[1:2], c("m", "w"))   # la diferencia más fuerte y la que más se aparta del 50% sin diferencia
  expect_false(anyDuplicated(vars) > 0L)   # antes, la tercera era la otra opción de m
  expect_identical(vars[3], "q")
  # Sin diferencias en el capítulo, las dos que más se apartan: sólo hay una pregunta.
  expect_identical(.pk_vars(.pk_cap(r, "Dos")), "z")
  expect_true(any(grepl("la cifra que más se aparta del 50% sin diferencia, sin repetir pregunta", r$avisos, fixed = TRUE)))
  expect_true(any(grepl("Marca las preguntas clave del estudio", r$avisos, fixed = TRUE)))
})

test_that("con preguntas clave: la diferencia más fuerte es la de las clave y la cifra sin diferencia sale de ellas", {
  r <- .pk_auto(claves = c("t", "k"))
  uno <- .pk_cap(r, "Uno")
  expect_identical(.pk_vars(uno), c("t", "k"))   # t difiere menos que m y q, pero es clave; k está más cerca del 50% que w
  # El capítulo sin preguntas clave sigue la regla de siempre.
  expect_identical(.pk_vars(.pk_cap(r, "Dos")), "z")
  expect_true(any(grepl("una cifra de las preguntas clave del estudio, sin repetir pregunta", r$avisos, fixed = TRUE)))
  expect_false(any(grepl("[;·—–]", r$avisos)))
})

test_that("varias clave sin diferencia: la que más se aparta del 50% y, a igualdad, la primera del plan", {
  expect_identical(.pk_vars(.pk_cap(.pk_auto(claves = c("k", "w")), "Uno"))[2], "w")
  # k y k2 empatan: gana la primera del PLAN aunque la lista de clave las nombre al revés.
  expect_identical(.pk_vars(.pk_cap(.pk_auto(claves = c("k2", "k")), "Uno"))[2], "k")
})

test_that("con clave sólo sin diferencia, la diferencia más fuerte sigue siendo la del capítulo", {
  uno <- .pk_cap(.pk_auto(claves = "k", por_cap = 3L), "Uno")
  expect_identical(.pk_vars(uno), c("m", "k", "q"))   # el relleno es la siguiente diferencia, sin repetir m
})

test_that("con una clave con diferencia y ninguna sin ella, el segundo lugar es la siguiente diferencia, no la más rotunda", {
  expect_identical(.pk_vars(.pk_cap(.pk_auto(claves = "q"), "Uno")), c("q", "m"))
})

test_that("titulares: un hallazgo por capítulo, el de la clave", {
  expect_identical(.pk_vars(.pk_cap(.pk_auto(claves = "t", por_cap = 1L), "Uno")), "t")
})

test_that("resumen de diferencias en auto: las clave primero en su capítulo y sin repetir pregunta", {
  fuente <- .sig_fuente(.pk_base(), .pk_inst())
  modelo <- function(claves) {
    el <- p_slide_resumen_diferencias(seleccion = "auto", rotulos = .pk_rot)$slots$plot
    suppressMessages(.resumen_dif_modelo(el, fuente, .pk_sig(claves), .pk_plan()))
  }
  vars <- function(e) vapply(e$capitulos[[1]]$filas, function(f) .sig_var_local(f$var), "")
  sin <- vars(modelo(NULL))
  expect_identical(sin[1], "m")
  expect_false(anyDuplicated(sin) > 0L)
  con <- vars(modelo("t"))
  expect_identical(con[1], "t")
  expect_false(anyDuplicated(con) > 0L)
  expect_setequal(con, sin)
})

test_that("las referencias con base sólo cuentan en su base y quedan sin ella", {
  expect_identical(.preguntas_clave_locales(list("default$k", "otra$w", "t", "t", ""), "default"), c("k", "t"))
  expect_identical(.preguntas_clave_locales(c("default$k", "otra$w"), ""), c("k", "w"))
  expect_identical(.preguntas_clave_locales(NULL), character(0))
  # Sin preguntas clave el contexto no cambia: la huella de las miniaturas sigue igual.
  ctx <- list(regla = list(prueba = "z"), familia = NULL)
  expect_identical(.preguntas_clave_en_contexto(ctx, list()), ctx)
  expect_identical(.preguntas_clave_en_contexto(ctx, "otra$w", "default"), ctx)
  expect_null(.preguntas_clave_en_contexto(NULL, "k"))
})

test_that("el worker del PPT toma las preguntas clave del plan del pedido, resueltas para su base", {
  ds <- list(default = .pk_base()); is <- list(default = .pk_inst())
  previa <- suppressMessages(.sig_informe_preparar(
    list(graficos_config = list(plan = list(slides = list(), preguntas_clave = list("default$q", "otra$z", "t"))), analitica_config = list()),
    ds, is, "default"))
  on.exit(options(previa), add = TRUE)
  expect_identical(.preguntas_clave_de(.sig_contexto_render(ds$default)), c("q", "t"))
})

# ---- Ida y vuelta por el guardado ---------------------------------------------------------------------------------------

test_that("plan$preguntas_clave sobrevive a la normalización de la config y del plan, siempre como arreglo", {
  cfg <- .graficos_normalize_config(list(plan = list(slides = list(), preguntas_clave = list("A11_recod", "B16", "default$B12_1", "B16", " "))))
  expect_identical(cfg$plan$preguntas_clave, list("A11_recod", "B16", "default$B12_1"))
  uno <- .graficos_normalize_config(list(plan = list(slides = list(), preguntas_clave = list("B16"))))
  expect_identical(as.character(jsonlite::toJSON(uno$plan$preguntas_clave, auto_unbox = TRUE)), '["B16"]')
  vacia <- .graficos_normalize_config(list(plan = list(slides = list(), preguntas_clave = list())))
  expect_false("preguntas_clave" %in% names(vacia$plan))
  # El plan del cuerpo de /ppt y /word (simplificado por plumber: un vector de texto).
  expect_identical(.normalize_plan(list(slides = list(), preguntas_clave = c("q", "t")))$preguntas_clave, list("q", "t"))
})

test_that("HTTP: POST /api/graficos/config guarda las preguntas clave y GET las devuelve", {
  testthat::skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_graficos(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  llamar <- function(metodo, body = NULL) {
    crudo <- if (is.null(body)) raw(0) else charToRaw(enc2utf8(body))
    entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
    req <- as.environment(list(REQUEST_METHOD = metodo, PATH_INFO = "/api/graficos/config", QUERY_STRING = "",
                               HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                               bodyRaw = if (is.null(body)) NULL else crudo, postBody = body %||% "", CONTENT_TYPE = "application/json"))
    r <- pr$call(req)
    list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
  }
  plan <- list(slides = list(list(id = "g1", tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "q", grafico = list(graficador = "p_barras_agrupadas", args = list(var = "q"))))),
               preguntas_clave = list("q"))
  w <- llamar("POST", as.character(jsonlite::toJSON(list(config = list(plan = plan)), auto_unbox = TRUE)))
  expect_identical(w$status, 200L)
  r <- llamar("GET")
  expect_identical(r$status, 200L)
  expect_identical(r$body$config$plan$preguntas_clave, list("q"))   # un arreglo de uno, no un texto suelto
  # El guardado siguiente sin preguntas clave las quita: ausente es «sin preguntas clave».
  plan$preguntas_clave <- list()
  llamar("POST", as.character(jsonlite::toJSON(list(config = list(plan = plan)), auto_unbox = TRUE)))
  expect_null(llamar("GET")$body$config$plan$preguntas_clave)
})
