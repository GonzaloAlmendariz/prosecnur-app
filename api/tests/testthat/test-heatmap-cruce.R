source("setup-load-all.R")

# ADR 0137, decisión 1 de Gonzalo («Tipo propio»): la variante pregunta × cruce de `p_dim_heatmap` (L10-6 y L10-10 de
# CCSS Perfil) pasa a «Mapa de calor por cruce» (`p_heatmap_cruce`). Las cifras son las que dibujaba la ruta anterior
# (en la fase 1 se compararon byte a byte con ella; desde la fase 2 quedan fijadas aquí); el `p_dim_heatmap` con una
# pregunta como objetivo se migra 1:1 una sola vez (dirty y aviso únicos), y el que llega sin migrar al rearmado se
# redirige en memoria.

# Fixture de L10-6 (test-l10-variantes.R): Carrera 1: p = 1,1,2,3; carrera 2: p = 3 × 8.
.hmc_inst <- function() list(
  survey = data.frame(name = c("niv", "car", "p", "t"), type = c("select_one nv", "select_one cr", "select_one lk", "select_one sn"),
                      list_name = c("nv", "cr", "lk", "sn"), label = c("Nivel", "Carrera", "Afirmación", "Trabaja"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("nv", 3), rep("cr", 2), rep("lk", 3), rep("sn", 2)),
                       name = c("8", "6", "7", "1", "2", "1", "2", "3", "1", "2"),
                       label = c("VIII", "VI", "VII", "Economía", "Derecho", "Nada", "Algo", "Mucho", "Sí", "No"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("8", "6", "7"), labels = c("VIII", "VI", "VII"), label = "Nivel"),
                     car = list(names = c("1", "2"), labels = c("Economía", "Derecho"), label = "Carrera"),
                     p = list(names = c("1", "2", "3"), labels = c("Nada", "Algo", "Mucho"), label = "Afirmación"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Trabaja")))
.hmc_dat <- function() data.frame(
  niv = rep(c("6", "7", "8"), each = 4), car = rep(c("1", "2", "2"), each = 4),
  p = c("1", "1", "2", "3", "3", "3", "3", "3", "3", "3", "3", "3"), t = c("1", "1", "2", "2", "1", "2", "2", "2", "1", "1", "1", "2"),
  stringsAsFactors = FALSE)

# Fixture de L10-10 (test-l10b-heatmap-top2box.R): Economía TTB 60 %, Derecho 30 %, Total 45 %.
.hmc_lk <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.hmc_inst_box <- function() list(
  survey = data.frame(name = c("car", "p"), type = c("select_one cr", "select_one lk"), list_name = c("cr", "lk"),
                      label = c("Carrera", "Afirmación"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("cr", "cr", rep("lk", 5)), name = c("1", "2", as.character(1:5)),
                       label = c("Economía", "Derecho", .hmc_lk), stringsAsFactors = FALSE),
  orders_list = list(car = list(names = c("1", "2"), labels = c("Economía", "Derecho"), label = "Carrera"),
                     p = list(names = as.character(1:5), labels = .hmc_lk, label = "Afirmación")))
.hmc_dat_box <- function() data.frame(
  car = rep(c("1", "2"), each = 10),
  p = as.character(c(1, 2, 3, 3, 4, 4, 4, 5, 5, 5, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5)), stringsAsFactors = FALSE)

.hmc_slide_xml <- function(el, data, inst) {
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out))
  plan <- list(a = p_slide_1_grafico(grafico = el, titulo = "L10"))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = data, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "\n")
}
.hmc_txt <- function(xml, n) {
  doc <- xml2::read_xml(xml)
  xml2::xml_text(xml2::xml_find_all(doc, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
}
.hmc_avisos <- function(expr) {
  out <- character()
  val <- withCallingHandlers(expr, message = function(m) {
    if (grepl("[PULSO-AVISO]", conditionMessage(m), fixed = TRUE)) out <<- c(out, conditionMessage(m))
    invokeRestart("muffleMessage")
  })
  list(valor = val, avisos = out)
}

test_that("L10-6: la lámina de p_heatmap_cruce dibuja las cifras de la ruta anterior", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  ahora <- .hmc_slide_xml(p_heatmap_cruce(var = "p", cruce = "car"), .hmc_dat(), .hmc_inst())
  expect_match(ahora, "prosecnur:grafico:heatmap_dim", fixed = TRUE)   # la pieza nativa, no la ruta anterior
  expect_identical(.hmc_txt(ahora, "calor:columna"), c("Nada", "Algo", "Mucho"))
  expect_identical(.hmc_txt(ahora, "calor:fila"), c("Total (12*)", "Economía (4*)", "Derecho (8*)"))
  expect_identical(.hmc_txt(ahora, "calor:cifra"), c("17%", "8%", "75%", "50%", "25%", "25%", "0%", "0%", "100%"))
  expect_match(ahora, "Base: 12 casos que respondieron", fixed = TRUE)
})

test_that("L10-10: con el Top Two Box declarado, el box dice 45 / 60 / 30; apagado, no hay columna", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  ov <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  ahora <- .hmc_slide_xml(p_heatmap_cruce(var = "p", cruce = "car", overrides = ov), .hmc_dat_box(), .hmc_inst_box())
  expect_identical(.hmc_txt(ahora, "calor:box_cifra"), c("45%", "60%", "30%"))
  expect_identical(.hmc_txt(ahora, "calor:fila"), c("Total (20)", "Economía (10*)", "Derecho (10*)"))
  ov0 <- list(top2box = FALSE, top2box_labels = ov$top2box_labels)
  apagado <- .hmc_slide_xml(p_heatmap_cruce(var = "p", cruce = "car", overrides = ov0), .hmc_dat_box(), .hmc_inst_box())
  expect_length(.hmc_txt(apagado, "calor:box_cifra"), 0L)
  expect_length(.hmc_txt(apagado, "calor:cifra"), 15L)   # 3 filas × 5 opciones, sin la columna del box
})

test_that("el constructor pide una pregunta y un cruce y guarda la pregunta fuera de `var`", {
  el <- p_heatmap_cruce(var = " p ", cruce = "car", filtros = list(t = "1"))
  expect_identical(el$.element_type, "heatmap_cruce")
  expect_identical(el$pregunta, "p")
  expect_null(el$var)   # la base de la lámina la declara la especificación, no la base automática
  expect_error(p_heatmap_cruce(var = "", cruce = "car"), "var")
  expect_error(p_heatmap_cruce(var = "p", cruce = NA_character_), "cruce")
})

test_that("un cruce que no es de respuesta única se avisa con su motivo y la ranura no se inventa cifras", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  inst <- .hmc_inst(); inst$survey$type[inst$survey$name == "car"] <- "text"
  r <- .hmc_avisos(suppressWarnings({
    out <- tempfile(fileext = ".pptx")
    reporte_ppt_plan(data = .hmc_dat(), instrumento = inst, plan = list(a = p_slide_1_grafico(grafico = p_heatmap_cruce("p", "car"), titulo = "X")),
                     path_ppt = out, mensajes_progreso = FALSE)
    paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "\n")
  }))
  expect_true(any(grepl("necesita dos preguntas de respuesta única", r$avisos, fixed = TRUE)))
  expect_length(.hmc_txt(r$valor, "calor:cifra"), 0L)
})

test_that("el registro ofrece el tipo con su pregunta, su cruce y el Top Two Box por overrides", {
  meta <- .GRAFICADORES_META$p_heatmap_cruce
  expect_identical(meta$titulo_humano, "Mapa de calor por cruce")
  nm <- vapply(meta$args, function(a) a$name, "")
  expect_true(all(c("var", "cruce", "top2box", "top2box_labels", "filtros", "overrides") %in% nm))
  expect_true(all(vapply(meta$args[nm %in% c("top2box", "top2box_labels")], function(a) isTRUE(a$via_overrides), TRUE)))
  expect_true(meta$en_selector)
  expect_identical(meta$salida, "nativa")
  expect_true(is.function(getExportedValue("prosecnurapp", "p_heatmap_cruce")))
})

# --- el p_dim_heatmap del plan --------------------------------------------------------------------------------------
.hmc_slot <- function(objetivo, ...) list(graficador = "p_dim_heatmap",
                                          args = c(list(modo = "general", objetivo = objetivo, cruce = "car"), list(...)))
.hmc_plan <- function() list(slides = list(
  list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "Por carrera", grafico = .hmc_slot("p", titulo = "Afirmación"))),
  list(id = "s2", tipo = "p_slide_1_grafico", payload = list(titulo = "Índice", grafico = .hmc_slot("idx_comp"))),
  list(id = "s3", tipo = "p_slide_1_grafico", payload = list(titulo = "Trabajo", grafico = .hmc_slot("t", overrides = list(top2box = FALSE))))
))

test_that("rearmado: un p_dim_heatmap con una pregunta se redirige en memoria y dibuja lo mismo que p_heatmap_cruce", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  s <- .rebuild_slide(.hmc_plan()$slides[[1]])
  expect_identical(s$slots$plot$.element_type, "heatmap_cruce")
  expect_identical(s$slots$plot$.retirado_de, "p_dim_heatmap")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .hmc_dat(), instrumento = .hmc_inst(), plan = list(a = s), path_ppt = out, mensajes_progreso = FALSE)))
  xml <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "\n")
  expect_identical(.hmc_txt(xml, "calor:cifra"), c("17%", "8%", "75%", "50%", "25%", "25%", "0%", "0%", "100%"))
  # El rearmado del worker hace lo mismo.
  expect_identical(.graficos_rebuild_slide_json(.hmc_plan()$slides[[1]])$slots$plot$.element_type, "heatmap_cruce")
})

test_that("rearmado: un p_dim_heatmap de dimensiones sale en blanco con el aviso del retiro, sin citar el ADR", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  s <- .rebuild_slide(.hmc_plan()$slides[[2]])
  out <- tempfile(fileext = ".pptx")
  r <- .hmc_avisos(suppressWarnings(reporte_ppt_plan(data = .hmc_dat(), instrumento = .hmc_inst(), plan = list(a = s), path_ppt = out, mensajes_progreso = FALSE)))
  expect_true(any(grepl("\"Heatmap de dimensiones\" ya no existe y sale en blanco", r$avisos, fixed = TRUE)))
  expect_false(any(grepl("0137|ADR", r$avisos)))
  xml <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "\n")
  expect_false(grepl("0137|ADR", xml))
  expect_length(.hmc_txt(xml, "calor:cifra"), 0L)
})

test_that("migración: sólo el p_dim_heatmap con una pregunta pasa a p_heatmap_cruce, con sus filtros, título y overrides", {
  plan <- .hm_cruce_migrar_plan(.hmc_plan(), list(default = .hmc_inst()))
  expect_identical(attr(plan, "laminas_migradas"), c(1L, 3L))
  g1 <- plan$slides[[1]]$payload$grafico
  expect_identical(g1$graficador, "p_heatmap_cruce")
  expect_identical(g1$args, list(var = "p", cruce = "car", titulo = "Afirmación"))
  expect_identical(plan$slides[[3]]$payload$grafico$args$overrides, list(top2box = FALSE))
  expect_identical(plan$slides[[2]]$payload$grafico, .hmc_plan()$slides[[2]]$payload$grafico)   # dimensión: intacto
  # Idempotente.
  expect_null(attr(.hm_cruce_migrar_plan(plan, list(default = .hmc_inst())), "laminas_migradas"))
  # Sin instrumentos no decide.
  expect_null(attr(.hm_cruce_migrar_plan(.hmc_plan(), NULL), "laminas_migradas"))
})

test_that("validar: el p_dim_heatmap con una pregunta advierte que sale como mapa de calor por cruce; no bloquea", {
  v <- .validar_plan_json(.hmc_plan(), inst_sources = list(default = .hmc_inst()))
  expect_true(v$ok)
  expect_true(any(grepl("Lámina 1, “Por carrera”: el espacio \"Gráfico principal\" usa \"Heatmap de dimensiones\", que ya no existe; sale como \"Mapa de calor por cruce\", con las mismas cifras.",
                        v$warnings, fixed = TRUE)))
  expect_true(any(grepl("Lámina 2, “Índice”: el espacio \"Gráfico principal\" usa \"Heatmap de dimensiones\", que ya no existe; sale en blanco.", v$warnings, fixed = TRUE)))
})

# --- GET de la config: persiste una vez, dirty una vez, un aviso ------------------------------------------------------
.hmc_get_config <- function(sid, inst) {
  testthat::local_mocked_bindings(session_header = function(req) sid, estudio_inst_sources = function(sid) inst, .package = "prosecnurapp")
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, "/api/graficos/config") && "GET" %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv()); res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}
.hmc_grafs <- function(plan) vapply(plan$slides, function(s) s$payload$grafico$graficador, "")

test_that("GET config: migra una vez, marca el proyecto como modificado una vez y avisa una vez", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "graficos_config", list(plan = .hmc_plan()))
  session_set(sid, "project_dirty", FALSE)
  r1 <- .hmc_get_config(sid, list(default = .hmc_inst()))
  av <- as.character(unclass(r1$avisos))
  expect_length(av, 1L)
  expect_identical(av, "Las láminas 1 y 3 usaban \"Heatmap de dimensiones\" con una pregunta como objetivo, un tipo que ya no existe: ahora son \"Mapa de calor por cruce\", con las mismas cifras.")
  expect_identical(.hmc_grafs(session_get(sid)$graficos_config$plan), c("p_heatmap_cruce", "p_dim_heatmap", "p_heatmap_cruce"))
  expect_true(isTRUE(session_get(sid)$project_dirty))
  session_set(sid, "project_dirty", FALSE)
  r2 <- .hmc_get_config(sid, list(default = .hmc_inst()))
  expect_length(as.character(unclass(r2$avisos)), 0L)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("GET config multibase: la config de cada base se migra con su instrumento y el aviso nombra la base", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  otra <- .hmc_inst(); otra$survey$type[otra$survey$name == "p"] <- "integer"   # en esta base p no es de respuesta única
  session_set(sid, "graficos_config_por_base", list(egresados = list(plan = .hmc_plan()), docentes = list(plan = .hmc_plan())))
  av <- as.character(unclass(.hmc_get_config(sid, list(egresados = .hmc_inst(), docentes = otra))$avisos))
  expect_length(av, 2L)
  expect_match(av[1], "^Base \"egresados\": Las láminas 1 y 3")
  expect_match(av[2], "^Base \"docentes\": La lámina 3 usaba")
  cfgs <- session_get(sid)$graficos_config_por_base
  expect_identical(.hmc_grafs(cfgs$egresados$plan), c("p_heatmap_cruce", "p_dim_heatmap", "p_heatmap_cruce"))
  expect_identical(.hmc_grafs(cfgs$docentes$plan), c("p_dim_heatmap", "p_dim_heatmap", "p_heatmap_cruce"))
})
