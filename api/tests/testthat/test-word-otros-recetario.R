# La tabla «Respuestas «Otros»» del recetario Word (decisión 21; recetario_word.R:564-568, propuesta-word.docx p. 28).
# Reusa la agrupación, el orden y el umbral de la lámina del PPT (`.otros_items`, `.otros_minimo()`), sin ponderar.

# Fixture de la p. 203 del recetario (test-otros-recetario.R): 22 textos distintos que suman 45 respuestas.
.wo_fixture <- function(k_otros = NULL) {
  textos <- c(
    rep(c("Ingeniero de proyectos", "ingeniero de proyectos", "INGENIERO DE PROYECTOS", " Ingeniero  de proyectos "), c(4, 1, 1, 1)),
    rep(c("Ingeniero de diseño", "Ingeniero de diseno", "ingeniero de diseño"), c(4, 1, 1)),
    rep("Ingeniero de aplicaciones", 5), rep(c("Planificador de mantenimiento", "planificador de mantenimiento"), c(4, 1)),
    rep(c("Ingeniero de diseño mecánico", "Ingeniero de tuberías", "Ingeniero mecánico", "Ingeniero mecánico intermedio"), each = 2),
    "Asesor técnico comercial", "Comprador corporativo", "Consultor técnico", "Ejecutivo comercial", "Ejecutivo de riesgos",
    "Gestor comercial", "Gestor de proyectos", "Ingeniera de manufactura", "Ingeniero de estrategias",
    "Ingeniero de mantenimiento mecánico", "Ingeniero de planeamiento", "Ingeniero de procesos de información",
    "Ingeniero de soporte de producto", "Ingeniero de ventas"
  )
  if (!is.null(k_otros)) textos <- paste("Respuesta distinta", seq_len(k_otros))
  n_otros <- length(textos)
  dat <- data.frame(puesto = c(rep("99", n_otros), rep("1", 20), rep("2", 10), "99"),
                    puesto_other = c(textos, rep("", 30), ""), stringsAsFactors = FALSE)
  attr(dat$puesto, "label") <- "¿Cuál es su\npuesto actual?"
  inst <- list(
    survey = data.frame(name = c("puesto", "puesto_other"), type = c("select_one lst_puesto", "text"),
                        list_name = c("lst_puesto", NA_character_), stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst_puesto", name = c("1", "2", "99"),
                         label = c("Analista", "Docente", "Otro (especifique)"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  list(data = dat, inst = inst, textos = textos)
}

.wo_plan <- function() list(diapo_001 = p_slide_seccion("Resultados"),
                            diapo_002 = p_slide_1_grafico(grafico = p_barras_agrupadas("puesto")),
                            diapo_003 = p_slide_seccion("Otro capítulo"))

.wo_presets <- function() p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE))

.wo_word <- function(fx, auto = NA, path = NULL, ...) {
  args <- list(data = fx$data, instrumento = fx$inst, plan = .wo_plan(), presets_ppt = .wo_presets(),
               mensajes_progreso = FALSE, fuente = "Fuente: PULSO PUCP 2026.", ...)
  if (is.null(path)) args$solo_lista <- TRUE else args$path_docx <- path
  if (!is.na(auto)) args$auto_otros_slides <- auto
  do.call(reporte_word_plan, args)
}

# render_meta que ve el Word con la opción (la misma llamada que hace `reporte_word_plan`).
.wo_meta <- function(fx, auto = TRUE) {
  r <- reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = .wo_plan(),
                        presets = .apply_word_chart_presets(.wo_presets(), w_presets()),
                        solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE, auto_otros_slides = auto)
  list(r = r, meta = if (auto) .word_otros_insertar(r$render_meta, r$plan, fuente = "Fuente: PULSO PUCP 2026.") else r$render_meta)
}

.wo_tablas_otros <- function(xml) {
  ns <- xml2::xml_ns(xml)
  tbls <- xml2::xml_find_all(xml, "//w:tbl", ns)
  Filter(function(t) {
    cab <- xml2::xml_text(xml2::xml_find_all(t, "./w:tr[1]/w:tc", ns))
    identical(trimws(cab), c("Respuesta", "N.º", "", "Respuesta", "N.º"))
  }, tbls)
}

test_that("la opción viene apagada y, apagada, el Word no lleva tabla «Otros»", {
  expect_false(eval(formals(reporte_word_plan)$auto_otros_slides))
  fx <- .wo_fixture()
  m <- .wo_meta(fx, auto = FALSE)$meta
  expect_false(any(vapply(m, function(e) identical(e$kind, "otros_tabla"), logical(1))))
  expect_identical(.word_otros_insertar(m, .wo_meta(fx, auto = FALSE)$r$plan), m)   # sin láminas «Otros» no cambia nada
})

test_that("encendida, la tabla va justo después del gráfico y antes del capítulo siguiente", {
  m <- .wo_meta(.wo_fixture())$meta
  kinds <- vapply(m, function(e) e$kind %||% "chart", "")
  expect_identical(kinds, c("section", "chart", "otros_tabla", "section"))
  t <- m[[3]]
  expect_identical(t$title, "Respuestas «Otros» a la pregunta ¿Cuál es su puesto actual?")
  expect_identical(t$base, "Base: 45 respuestas en «Otros». Fuente: PULSO PUCP 2026.")
  expect_equal(t$total, 45)
  expect_equal(sum(t$items$n), t$total)                    # la base es la suma de las cuentas (casos)
  expect_equal(nrow(t$items), 22L)                         # agrupadas: sin agrupar serían 45 filas
  expect_equal(head(t$items$n, 4), c(7, 6, 5, 5))
  expect_identical(t$items, .otros_items(textos = .wo_fixture()$textos)[, c("texto", "n")])   # una sola fuente de agrupación
})

test_that("bajo el umbral de 5 respuestas no hay tabla, y con 5 sí", {
  expect_false(any(vapply(.wo_meta(.wo_fixture(k_otros = 4))$meta, function(e) identical(e$kind, "otros_tabla"), logical(1))))
  expect_true(any(vapply(.wo_meta(.wo_fixture(k_otros = 5))$meta, function(e) identical(e$kind, "otros_tabla"), logical(1))))
})

test_that("las láminas «(cont.)» del PPT se reúnen en una sola tabla del Word", {
  s <- .otros_slides(list(title = "Actividad preferida", respuestas = paste("respuesta abierta", 1:30)))
  expect_length(s, 2L)
  plan <- c(list(p_slide_1_grafico(grafico = p_barras_agrupadas("x"))), s)
  t <- .word_otros_desde_plan(plan)
  expect_length(t, 1L)
  expect_equal(nrow(t[[1]]$items), 30L)
  expect_identical(t[[1]]$title, "Respuestas «Otros» a la pregunta Actividad preferida")
  expect_identical(t[[1]]$base, "Base: 30 respuestas en «Otros».")
  expect_identical(t[[1]]$slide_i, 1L)
  # Dos preguntas seguidas son dos tablas.
  s2 <- .otros_slides(list(title = "Otra", respuestas = rep("igual", 6)))
  expect_length(.word_otros_desde_plan(c(plan, s2)), 2L)
})

test_that("los dos bloques llevan la primera mitad a la izquierda y el resto a la derecha, en orden", {
  it <- .otros_items(textos = .wo_fixture()$textos)
  df <- .word_otros_df(it)
  expect_equal(nrow(df), 11L)
  expect_identical(df[[1]], it$texto[1:11]); expect_identical(df[[4]], it$texto[12:22])
  expect_identical(df[[2]][1:4], c("7", "6", "5", "5"))
  expect_true(all(df[[3]] == ""))
  impar <- .word_otros_df(data.frame(texto = c("a", "b", "c", "d", "e"), n = 5:1))
  expect_identical(impar[[1]], c("a", "b", "c")); expect_identical(impar[[4]], c("d", "e", ""))
  expect_identical(impar[[5]], c("2", "1", ""))
})

test_that("la ancla cae tras las entradas sin lámina (multiapiladas) y no salta a la lámina siguiente", {
  expect_identical(.word_otros_ancla(c(NA, 2L, 2L, 5L), 2L), 3L)
  expect_identical(.word_otros_ancla(c(1L, NA, NA, 5L), 3L), 3L)       # bloques de multiapiladas de la lámina 3
  expect_identical(.word_otros_ancla(c(1L, NA, NA), 3L), 3L)
})

test_that("el DOCX del recetario lleva la tabla de dos bloques numerada, con su base, tras el gráfico", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  fx <- .wo_fixture()
  path <- withr::local_tempfile(fileext = ".docx")
  res <- .wo_word(fx, auto = TRUE, path = path)
  expect_true(file.exists(path))
  expect_equal(res$tablas, 1L)
  d <- withr::local_tempdir(); utils::unzip(path, files = "word/document.xml", exdir = d)
  xml <- xml2::read_xml(file.path(d, "word/document.xml")); ns <- xml2::xml_ns(xml)
  tb <- .wo_tablas_otros(xml)
  expect_length(tb, 1L)
  filas <- xml2::xml_find_all(tb[[1]], "./w:tr", ns)
  expect_length(filas, 12L)                                              # encabezado + 11 filas por bloque
  celdas <- function(i) trimws(xml2::xml_text(xml2::xml_find_all(filas[[i]], "./w:tc", ns)))
  expect_identical(celdas(2), c("Ingeniero de proyectos", "7", "", "Ejecutivo comercial", "1"))   # el 12.º de 22 abre el segundo bloque
  # Anchos del recetario (2.3, 0.5, 0.3, 2.3, 0.5) escalados al ancho útil.
  grid <- as.numeric(xml2::xml_attr(xml2::xml_find_all(tb[[1]], "./w:tblGrid/w:gridCol", ns), "w"))
  expect_equal(grid / sum(grid), c(2.3, 0.5, 0.3, 2.3, 0.5) / 5.9, tolerance = 0.01)
  # Primera columna del cuerpo sin negrita (a diferencia de la tabla técnica).
  b1 <- xml2::xml_find_all(filas[[2]], "./w:tc[1]//w:rPr/w:b", ns)
  expect_true(!length(b1) || all(xml2::xml_attr(b1, "val") %in% c("0", "false")))
  texto <- xml2::xml_text(xml2::xml_find_all(xml, "//w:p", ns))
  expect_true(any(grepl("Respuestas «Otros» a la pregunta ¿Cuál es su puesto actual?", texto, fixed = TRUE)))
  expect_true("Base: 45 respuestas en «Otros». Fuente: PULSO PUCP 2026." %in% texto)
  instr <- xml2::xml_text(xml2::xml_find_all(xml, "//w:instrText", ns))
  expect_true(any(grepl("SEQ Tabla", instr, fixed = TRUE)))
  # Orden en el cuerpo: el rótulo del gráfico, luego la tabla «Otros», luego el capítulo siguiente.
  cuerpo <- xml2::xml_text(xml2::xml_find_all(xml, "/w:document/w:body/*", ns))
  i_tab <- which(grepl("Respuestas «Otros» a la pregunta", cuerpo, fixed = TRUE))[1]
  i_graf <- which(grepl("puesto actual", cuerpo, fixed = TRUE) & !grepl("Otros", cuerpo, fixed = TRUE))[1]
  i_cap <- which(grepl("Otro capítulo", cuerpo, fixed = TRUE))
  expect_true(i_graf < i_tab); expect_true(i_tab < max(i_cap))
})

test_that("apagada, el DOCX sale igual que antes: sin tabla «Otros»", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  path <- withr::local_tempfile(fileext = ".docx")
  res <- .wo_word(.wo_fixture(), auto = NA, path = path)
  expect_equal(res$tablas, 0L)
  d <- withr::local_tempdir(); utils::unzip(path, files = "word/document.xml", exdir = d)
  xml <- xml2::read_xml(file.path(d, "word/document.xml"))
  expect_length(.wo_tablas_otros(xml), 0L)
  expect_false(any(grepl("respuestas en «Otros»", xml2::xml_text(xml), fixed = TRUE)))
})

# --- contrato HTTP de /api/graficos/word y worker: la opción viaja sólo encendida -------------------------------------
.wo_http_word <- function(sid, body) {
  cap <- new.env()
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) { cap$args <- args; cap$kind <- kind; "job-wo" },
    .package = "prosecnurapp")
  pr <- mount_graficos(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- eps[[which(vapply(eps, function(e) identical(e$path, "/api/graficos/word") && "POST" %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  list(out = out, status = res$status, args = cap$args, kind = cap$kind)
}
.wo_plan_json <- function() list(slides = list(list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "T"))))

test_that("/api/graficos/word pasa auto_otros_slides al worker sólo si la opción del proyecto está encendida", {
  sid <- session_create(); withr::defer(session_delete(sid))
  r <- .wo_http_word(sid, list(plan = .wo_plan_json()))
  expect_identical(r$kind, "graficos.word")
  expect_false("auto_otros_slides" %in% names(r$args))                        # apagada por defecto: no viaja
  r <- .wo_http_word(sid, list(plan = .wo_plan_json(), config = list(auto_otros_slides = FALSE)))
  expect_false("auto_otros_slides" %in% names(r$args))
  r <- .wo_http_word(sid, list(plan = .wo_plan_json(), config = list(auto_otros_slides = TRUE)))
  expect_identical(r$args$auto_otros_slides, TRUE)
  # La misma opción guardada del proyecto (la que lee el PPT) también la enciende.
  .graficos_config_set(sid, list(plan = .wo_plan_json(), auto_otros_slides = TRUE))
  r <- .wo_http_word(sid, list(plan = .wo_plan_json()))
  expect_identical(r$args$auto_otros_slides, TRUE)
})

test_that("el worker de Word recibe la opción apagada por defecto y la entrega a reporte_word_plan", {
  expect_false(eval(formals(graficos_job_worker_word)$auto_otros_slides))
  cap <- new.env()
  testthat::local_mocked_bindings(
    .graficos_job_rebuild_slides = function(...) list(),
    reporte_word_plan = function(..., auto_otros_slides = NA) { cap$auto <- auto_otros_slides; invisible(NULL) },
    .package = "prosecnurapp")
  run <- function(...) graficos_job_worker_word(
    rp_data_path = "no", rp_inst_path = "no", plan = list(slides = list()), presets = list(), w_presets = list(), paletas = list(),
    slide_registry = list(), graficador_registry = character(), icon_registry = list(), active_base = "", result_path = tempfile(), ...)
  run(); expect_identical(cap$auto, FALSE)
  run(auto_otros_slides = TRUE); expect_identical(cap$auto, TRUE)
})
