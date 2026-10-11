source("setup-load-all.R")

# D8 (contrato docs/qa/contrato-orden-categorias-f6-2026-10-10.md): el orden de las categorías de un gráfico se elige por
# gráfico —recetario, frecuencia, instrumento o personalizado (por código)— y vale igual en la lámina nativa, la ruta
# anterior y el Word.

# «Sector» nominal: el instrumento pone «Otro» segundo (como «Otro (especifique)» en p7 de acrconta).
.oc_sector <- data.frame(codigo = c("2", "5", "1", "4", "3"), etiqueta = c("Público", "Otro", "Privado", "ONG", "Estudio propio"),
                         n = c(25, 12, 40, 8, 15), stringsAsFactors = FALSE)
.oc_nivel <- data.frame(codigo = c("1", "2", "3", "4"), etiqueta = c("Muy bajo", "Bajo", "Alto", "Muy alto"), n = c(5, 10, 40, 30),
                        stringsAsFactors = FALSE)
.oc_sino <- data.frame(codigo = c("1", "2"), etiqueta = c("Sí", "No"), n = c(20, 60), stringsAsFactors = FALSE)
.oc_medio <- data.frame(codigo = c("1", "2", "3"), etiqueta = c("Alfa", "Otro", "Beta"), n = c(40, 25, 10), stringsAsFactors = FALSE)

.oc_fixture <- function() {
  testthat::skip_if_not_installed("openxlsx")
  col <- function(t) rep(t$codigo, t$n)
  m <- max(sum(.oc_sector$n), sum(.oc_nivel$n), sum(.oc_sino$n), sum(.oc_medio$n))
  pad <- function(x) c(x, rep(NA_character_, m - length(x)))
  df <- data.frame(sector = pad(col(.oc_sector)), nivel = pad(col(.oc_nivel)), sino = pad(col(.oc_sino)), medio = pad(col(.oc_medio)), stringsAsFactors = FALSE)
  ch <- function(ln, t) data.frame(list_name = ln, name = t$codigo, label = t$etiqueta, stringsAsFactors = FALSE)
  # Instrumento procesado, como el de la app (`orders_list`, `dicc_code_to_label`): los datos traen códigos.
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = data.frame(type = c("select_one ls", "select_one ln", "select_one lsn", "select_one lm"),
                                                name = c("sector", "nivel", "sino", "medio"),
                                                label = c("Sector en el que trabaja", "Nivel de satisfacción", "¿Trabaja?", "Medio"), stringsAsFactors = FALSE),
                            choices = rbind(ch("ls", .oc_sector), ch("ln", .oc_nivel), ch("lsn", .oc_sino), ch("lm", .oc_medio))), x)
  list(df = df, inst = suppressMessages(reporte_instrumento(x)))
}

.oc_avisos <- function(expr) {
  out <- character()
  withCallingHandlers(expr, message = function(m) {
    t <- conditionMessage(m)
    if (grepl(.PULSO_AVISO_SELLO, t, fixed = TRUE)) out <<- c(out, trimws(sub(".*\\[PULSO-AVISO\\]", "", t)))
    invokeRestart("muffleMessage")
  }, warning = function(w) invokeRestart("muffleWarning"))
  out
}

# Rótulos de las categorías de la lámina nativa, en orden de lectura, y avisos del mazo.
.oc_lamina <- function(graf, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO)) {
  f <- .oc_fixture(); out <- tempfile(fileext = ".pptx")
  av <- .oc_avisos(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = list(a = p_slide_1_grafico(grafico = graf, titulo = "T")),
                                    presets = presets, path_ppt = out, mensajes_progreso = FALSE))
  x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[[1]]))
  list(estado = .pptx_lamina_estado(as.character(x)), avisos = av,
       rotulos = xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo']]")))
}

test_that("el normalizador fija la forma {modo, lista, invertir}, es idempotente y no rompe con un modo desconocido", {
  expect_null(.graficos_orden_cat_normalizar(NULL))
  expect_null(.graficos_orden_cat_normalizar(list()))
  a <- .graficos_orden_cat_normalizar(list(modo = "Personalizado", lista = list("3", 1, "", NA, "3"), invertir = "true"))
  expect_identical(a, list(modo = "personalizado", lista = c("3", "1"), invertir = TRUE))
  expect_identical(.graficos_orden_cat_normalizar(a), a)
  b <- .graficos_orden_cat_normalizar(list(modo = "alfabetico"))
  expect_identical(b$modo, "recetario"); expect_identical(b$modo_invalido, "alfabetico")
  expect_identical(.graficos_orden_cat_normalizar(b), b)
  expect_identical(.graficos_orden_cat_normalizar("frecuencia")$modo, "frecuencia")
})

test_that("el orden por código sigue las reglas del contrato en cada modo", {
  cats <- .goc_categorias(.oc_fixture()$inst, "sector")
  expect_identical(cats$codigo, .oc_sector$codigo)
  n <- .oc_sector$n
  expect_identical(.goc_orden_codigos(cats, "instrumento")$codigos, c("2", "1", "4", "3", "5"))         # Otro al final
  expect_identical(.goc_orden_codigos(cats, "frecuencia", n = n)$codigos, c("1", "2", "3", "4", "5"))
  expect_identical(.goc_orden_codigos(cats, "frecuencia", invertir = TRUE, n = n)$codigos, c("4", "3", "2", "1", "5"))
  expect_identical(.goc_orden_codigos(cats, "instrumento", invertir = TRUE)$codigos, c("3", "4", "1", "2", "5"))
  p <- .goc_orden_codigos(cats, "personalizado", c("5", "3", "1"))
  expect_identical(p$codigos, c("5", "3", "1", "2", "4"))                                                # «Otro» donde lo puso la lista
  expect_identical(p$no_listadas, c("2", "4"))
  q <- .goc_orden_codigos(cats, "personalizado", c("3", "9"))
  expect_identical(q$codigos, c("3", "2", "1", "4", "5"))                                                # residual no listado: al final de todo
  expect_identical(q$ausentes, "9")
  expect_identical(.goc_orden_codigos(cats, "personalizado", c("5", "3", "1"), invertir = TRUE)$codigos, c("1", "3", "5", "2", "4"))
})

test_that("recetario: nominal de más de dos por frecuencia, ordinal y dicotomía en orden del instrumento", {
  f <- .oc_fixture()
  rec <- function(v) { cats <- .goc_categorias(f$inst, v); sv <- .goc_survey(f$inst, v); .goc_modo_recetario(cats, .goc_ordinal(f$inst, sv$list_name), sv$tipo) }
  expect_identical(rec("sector"), "frecuencia")
  expect_identical(rec("sino"), "instrumento")
  inst <- f$inst; inst$listas_ordinales <- "ln"
  cats <- .goc_categorias(inst, "nivel")
  expect_identical(.goc_modo_recetario(cats, .goc_ordinal(inst, "ln"), "select_one"), "instrumento")
  inst$listas_ordinales <- character(); inst$listas_nominales <- "ln"
  expect_identical(.goc_modo_recetario(cats, .goc_ordinal(inst, "ln", cats$etiqueta), "select_one"), "frecuencia")   # «no ordinal» de Analítica manda
  inst$listas_nominales <- NULL
  expect_identical(.goc_modo_recetario(cats, .goc_ordinal(inst, "ln", cats$etiqueta), "select_one"), "instrumento")  # sin marca, las pistas
  expect_identical(.goc_modo_recetario(cats, FALSE, "select_multiple"), "frecuencia")
})

test_that("las pistas de orden reconocen rangos, años y grados que la heurística compartida deja fuera (acrconta)", {
  expect_true(.goc_pistas_orden(c("De 30 a 35 años", "De 22 a 25 años", "De 26 a 29 años", "De 36 años a más")))
  expect_true(.goc_pistas_orden(c("2021", "2022", "2023", "2024", "2025")))
  expect_true(.goc_pistas_orden(c("Bachiller", "Magíster", "Doctor")))
  expect_true(.goc_pistas_orden(c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo", "Octavo ciclo", "Noveno ciclo", "Décimo ciclo")))   # p68
  expect_true(.goc_pistas_orden(c("Menos de 2 meses", "Entre 2 y 5 meses", "Más de un año", "No he encontrado trabajo")))
  expect_false(.goc_pistas_orden(c("Privado", "Público", "Estudio propio o independiente", "ONG u organismo internacional", "Otro")))
  expect_false(.goc_pistas_orden(c("Departamento de Ciencias Contables", "Departamento de Derecho", "Departamento de Economía", "Otro (especifique)")))
})

test_that("la lámina nativa dibuja cada modo, con los residuales al final salvo en personalizado", {
  rot <- function(oc) .oc_lamina(p_barras_categoricas("sector", orden_categorias = oc))$rotulos
  r <- .oc_lamina(p_barras_categoricas("sector"))
  expect_identical(r$estado, "nativa")
  expect_identical(r$rotulos, c("Privado", "Público", "Estudio propio", "ONG", "Otros"))                 # recetario = frecuencia
  expect_identical(rot(list(modo = "instrumento")), c("Público", "Privado", "ONG", "Estudio propio", "Otros"))
  expect_identical(rot(list(modo = "frecuencia", invertir = TRUE)), c("ONG", "Estudio propio", "Público", "Privado", "Otros"))
  expect_identical(rot(list(modo = "personalizado", lista = c("5", "3", "1", "2", "4"))), c("Otros", "Estudio propio", "Privado", "Público", "ONG"))
})

test_that("personalizado incompleto avisa de las no listadas y de los códigos que no existen", {
  r <- .oc_lamina(p_barras_categoricas("sector", orden_categorias = list(modo = "personalizado", lista = c("3", "9"))))
  expect_identical(r$rotulos, c("Estudio propio", "Público", "Privado", "ONG", "Otros"))
  expect_true("“Sector en el que trabaja”: 4 categorías no estaban en el orden personalizado y van al final: Público, Privado, ONG, Otro." %in% r$avisos)
  expect_true("“Sector en el que trabaja”: el orden personalizado nombra códigos que la pregunta no tiene: 9." %in% r$avisos)
  uno <- .oc_lamina(p_barras_categoricas("sector", orden_categorias = list(modo = "personalizado", lista = c("5", "3", "1", "2"))))
  expect_true("“Sector en el que trabaja”: 1 categoría no estaba en el orden personalizado y va al final: ONG." %in% uno$avisos)
})

test_that("un orden heredado del gráfico o un preset global distinto del de fábrica mandan sobre el recetario", {
  heredado <- .oc_lamina(p_barras_categoricas("sector", overrides = list(orden_barras = "instrumento")))
  expect_identical(heredado$rotulos, c("Público", "Privado", "ONG", "Estudio propio", "Otros"))
  pres <- .PRESETS_DEFAULT_PULSO; pres$barras_categoricas$orden_barras <- "instrumento"
  expect_identical(.oc_lamina(p_barras_categoricas("sector"), do.call(p_presets, pres))$rotulos[1], "Privado")   # el de fábrica no decide
  pres$barras_categoricas$orden_barras <- "menor_mayor"
  expect_identical(.oc_lamina(p_barras_categoricas("sector"), do.call(p_presets, pres))$rotulos[1], "ONG")       # el global elegido sí
  expect_identical(.oc_lamina(p_barras_categoricas("sector", orden_categorias = list(modo = "instrumento")),
                              do.call(p_presets, pres))$rotulos[1], "Público")                                 # y el del gráfico, más
})

test_that("el Word recibe la misma espec que la lámina nativa", {
  f <- .oc_fixture()
  graf <- p_barras_categoricas("sector", orden_categorias = list(modo = "personalizado", lista = c("5", "3", "1", "2", "4")))
  r <- suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = list(a = p_slide_1_grafico(grafico = graf, titulo = "T")),
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)))
  espec <- attr(r$render_meta[[1]]$plot_word, "pulso_espec") %||% attr(r$render_meta[[1]]$plot, "pulso_espec")
  expect_identical(espec$rotulos, c("Otros", "Estudio propio", "Privado", "Público", "ONG"))
})

test_that("pie y agrupadas también siguen el orden declarado", {
  f <- .oc_fixture()
  run <- function(graf) {
    r <- suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = list(a = p_slide_1_grafico(grafico = graf, titulo = "T")),
      presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)))
    r$render_meta[[1]]
  }
  pie <- run(p_pie("sino", orden_categorias = list(modo = "personalizado", lista = c("2", "1"))))
  d <- attr(pie$plot_word, "pulso_espec") %||% attr(pie$plot, "pulso_espec")
  expect_identical(as.character(d$rotulos %||% d$categorias %||% d$etiquetas)[1:2], c("No", "Sí"))
  ag <- run(p_barras_agrupadas("sector", orden_categorias = list(modo = "instrumento")))
  e <- attr(ag$plot_word, "pulso_espec") %||% attr(ag$plot, "pulso_espec")
  expect_identical(e$rotulos, c("Público", "Privado", "ONG", "Estudio propio", "Otros"))
})

test_that("en una escala o con un modo desconocido, la validación del plan avisa", {
  esc <- .graficos_orden_cat_avisos_slot(list(graficador = "p_barras_apiladas", args = list(var = "x", orden_categorias = list(modo = "frecuencia"))), "slide[1]")
  expect_match(esc, "no aplica a una escala", fixed = TRUE)
  mal <- .graficos_orden_cat_avisos_slot(list(graficador = "p_barras_categoricas", args = list(var = "x", orden_categorias = list(modo = "alfabetico"))), "slide[2]")
  expect_match(mal, "el orden de categorías guardado no existe en esta versión", fixed = TRUE)
  expect_false(grepl("alfabetico", mal, fixed = TRUE))   # sin el valor crudo (A8 B-g, test-avisos-sin-jerga.R)
  expect_length(.graficos_orden_cat_avisos_slot(list(graficador = "p_barras_categoricas", args = list(var = "x")), "s"), 0L)
  plan <- list(slides = list(list(tipo = "p_slide_1_grafico", payload = list(titulo = "T", grafico = list(graficador = "p_barras_apiladas",
    args = list(var = "x", orden_categorias = list(modo = "frecuencia")))))))
  expect_true(any(grepl("no aplica a una escala", .validar_plan_json(plan)$warnings, fixed = TRUE)))
})

test_that("orden_categorias sobrevive a .normalize_plan y a guardar y abrir el .pulso", {
  oc <- list(modo = "personalizado", lista = list("3", "1"), invertir = TRUE)
  plan <- list(slides = list(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "T",
    grafico = list(graficador = "p_barras_categoricas", args = list(var = "sector", orden_categorias = oc))))))
  ida <- .normalize_plan(jsonlite::fromJSON(jsonlite::toJSON(plan, auto_unbox = TRUE), simplifyVector = FALSE))
  got <- ida$slides[[1]]$payload$grafico$args$orden_categorias
  expect_identical(.graficos_orden_cat_normalizar(got), list(modo = "personalizado", lista = c("3", "1"), invertir = TRUE))
  sid <- session_create(); s <- session_get(sid); s$graficos_config <- list(plan = plan); .session_env[[sid]] <- s
  dest <- tempfile(fileext = ".pulso")
  expect_true(isTRUE(build_pulso(sid, dest, project_name = "Orden")$ok))
  abierto <- suppressMessages(suppressWarnings(load_pulso(dest)))
  vuelta <- session_get(abierto$session_id)$graficos_config$plan$slides[[1]]$payload$grafico$args$orden_categorias
  expect_identical(.graficos_orden_cat_normalizar(vuelta), list(modo = "personalizado", lista = c("3", "1"), invertir = TRUE))
})

test_that("el payload de categorías trae código, etiqueta, frecuencia y el orden de cada modo", {
  f <- .oc_fixture()
  p <- .graficos_categorias_payload(list(data_sources = list(principal = f$df), inst_sources = list(principal = f$inst)), "sector")
  expect_identical(vapply(p$categorias, `[[`, "", "codigo"), .oc_sector$codigo)
  expect_identical(vapply(p$categorias, `[[`, 0L, "n"), as.integer(.oc_sector$n))
  expect_identical(vapply(p$categorias, `[[`, logical(1), "residual"), c(FALSE, TRUE, FALSE, FALSE, FALSE))
  expect_identical(p$modo_recetario, "frecuencia")
  expect_identical(as.character(p$orden$recetario), c("1", "2", "3", "4", "5"))
  expect_identical(as.character(p$orden$instrumento), c("2", "1", "4", "3", "5"))
  expect_equal(sum(vapply(p$categorias, `[[`, 0, "pct")), 1, tolerance = 1e-3)
  src <- list(data_sources = list(principal = f$df), inst_sources = list(principal = f$inst))
  expect_error(.graficos_categorias_payload(src, ""), class = "api_error")
  expect_error(.graficos_categorias_payload(src, "no_existe"), class = "api_error")
})

test_that("la reconstrucción del plan JSON (vista previa y workers) conserva orden_categorias en los cuatro graficadores", {
  for (g in c("p_barras_categoricas", "p_barras_agrupadas", "p_pie", "p_donut")) {
    el <- .graficos_rebuild_graf_json(list(graficador = g, args = list(var = "x", orden_categorias = list(modo = "personalizado", lista = list("2", "1")))))
    expect_identical(el$orden_categorias, list(modo = "personalizado", lista = c("2", "1"), invertir = FALSE), info = g)
  }
})

# Verificador de D8: torta y dona por frecuencia (y por recetario en una nominal de más de dos) no mandaban los residuales
# al final, y la dona tomaba el «ninguno» que hereda del pie como un preset elegido. «Otro» (12) cae entre Estudio (15) y
# ONG (8): sólo la regla de residuales lo lleva al final.
.oc_circular <- function(graf, etiquetas = c("Privado", "Público", "Estudio propio", "ONG", "Otros")) {
  f <- .oc_fixture()
  plan <- list(a = p_slide_1_grafico(grafico = graf, titulo = "T")); pres <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, presets = pres, path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[[1]]))
  nativo <- trimws(xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='torta:rotulo' or @name='dona:rotulo']]")))
  r <- suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, presets = pres, solo_lista = TRUE,
                                                         build_render_meta = TRUE, mensajes_progreso = FALSE)))
  word <- attr(r$render_meta[[1]]$plot_word, "pulso_espec") %||% attr(r$render_meta[[1]]$plot, "pulso_espec")
  list(estado = .pptx_lamina_estado(as.character(x)), nativo = nativo, word = as.character(word$rotulos))
}

test_that("torta: por frecuencia el residual va al final en la lámina nativa y en el Word, también al invertir", {
  r <- .oc_circular(p_pie("medio", orden_categorias = list(modo = "frecuencia")))
  expect_identical(r$estado, "nativa")
  expect_identical(r$nativo, c("Alfa", "Beta", "Otros")); expect_identical(r$word, c("Alfa", "Beta", "Otros"))
  inv <- .oc_circular(p_pie("medio", orden_categorias = list(modo = "frecuencia", invertir = TRUE)))
  expect_identical(inv$nativo, c("Beta", "Alfa", "Otros")); expect_identical(inv$word, c("Beta", "Alfa", "Otros"))
  per <- .oc_circular(p_pie("medio", orden_categorias = list(modo = "personalizado", lista = c("2", "3", "1"))))
  expect_identical(per$nativo, c("Otros", "Beta", "Alfa"))                                          # personalizado: manda la lista
})

test_that("torta y dona: por recetario (nominal de más de dos) y por frecuencia los residuales van al final en la espec del Word", {
  freq <- c("Privado", "Público", "Estudio propio", "ONG", "Otros")
  for (ctor in list(p_pie, p_donut)) {
    for (oc in list(NULL, list(modo = "frecuencia"))) expect_identical(.oc_circular(ctor("sector", orden_categorias = oc))$word, freq)
    expect_identical(.oc_circular(ctor("sector", orden_categorias = list(modo = "frecuencia", invertir = TRUE)))$word,
                     c("ONG", "Estudio propio", "Público", "Privado", "Otros"))
    expect_identical(.oc_circular(ctor("sector", orden_categorias = list(modo = "personalizado", lista = c("5", "1", "2", "3", "4"))))$word,
                     c("Otros", "Privado", "Público", "Estudio propio", "ONG"))
  }
})

test_that("con los presets de fábrica la dona no toma el «ninguno» heredado del pie como un orden elegido", {
  el <- p_donut("sector")
  expect_false(.goc_orden_heredado(el, list(donut = list(args = list(ordenar_categorias = "ninguno")))))
  expect_true(.goc_orden_heredado(el, list(donut = list(args = list(ordenar_categorias = "desc")))))
})

test_that("si resolver el orden falla, el gráfico sale como venía y el analista recibe el aviso (no se traga el error)", {
  local_mocked_bindings(.goc_traducir = function(...) stop("lista corrupta"))
  f <- .oc_fixture()
  plan <- p_plan(slides = list(p_slide_1_grafico(grafico = p_barras_categoricas("sector"), titulo = "T")))
  av <- .oc_avisos(out <- .plan_orden_categorias(plan, list(principal = f$inst), NULL, "principal"))
  expect_identical(out[[1]]$slots, plan[[1]]$slots)
  expect_true(any(grepl("no se pudo aplicar el orden de categorías (lista corrupta)", av, fixed = TRUE)))
})

# Verificador de D8: una referencia sin base (`p7`) se resolvía contra la PRIMERA base, no la activa.
test_that("el payload de categorías resuelve una variable sin base contra la base activa", {
  f <- .oc_fixture()
  otra <- f$df; otra$sector <- rep(c("1", "2"), length.out = nrow(otra))
  src <- list(data_sources = list(docentes = f$df, estudiantes = otra), inst_sources = list(docentes = f$inst, estudiantes = f$inst))
  expect_identical(.graficos_categorias_payload(src, "sector")$base, "docentes")
  p <- .graficos_categorias_payload(src, "sector", base_activa = "estudiantes")
  expect_identical(p$base, "estudiantes")
  expect_identical(vapply(p$categorias, `[[`, 0L, "n")[match(c("1", "2"), .oc_sector$codigo)] > 0, c(TRUE, TRUE))
  expect_identical(.graficos_categorias_payload(src, "docentes$sector", base_activa = "estudiantes")$base, "docentes")   # la calificada manda
})
