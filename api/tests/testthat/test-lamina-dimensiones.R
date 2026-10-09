# Mapas de calor y comparativo de dimensiones con formas nativas (ADR 0093, N5; recetario_m3d.R).

.dm_fixture <- function() {
  set.seed(4); n <- 60
  dat <- data.frame(p1 = sample(c("1", "2", "3", "4"), n, TRUE, prob = c(.05, .1, .4, .45)), p2 = sample(c("1", "2", "3", "4"), n, TRUE),
                    p3 = sample(c("1", "2", "3", "4"), n, TRUE, prob = c(.1, .1, .3, .5)), sexo = sample(c("1", "2"), n, TRUE), stringsAsFactors = FALSE)
  for (v in c("p1", "p2", "p3")) attr(dat[[v]], "label") <- toupper(v)
  attr(dat$sexo, "label") <- "Sexo"
  inst <- list(survey = data.frame(name = c("p1", "p2", "p3", "sexo"), type = c(rep("select_one sat", 3), "select_one sx"), list_name = c(rep("sat", 3), "sx"),
                                   stringsAsFactors = FALSE),
               choices = rbind(data.frame(list_name = "sat", name = c("1", "2", "3", "4"), label = c("1", "2", "3", "4")),
                               data.frame(list_name = "sx", name = c("1", "2"), label = c("Masculino", "Femenino"))), orders_list = NULL)
  d1 <- suppressMessages(reporte_dimensiones(data = dat, instrumento = inst, vars = c("p1", "p2", "p3"), prefijo = "r100_", reemplazar = FALSE,
                                             orden_por_lista = list(sat = c("1", "2", "3", "4")), verbose = FALSE))
  d2 <- suppressMessages(reporte_dimensiones_indices(data = d1, subindices = list(subindice("a", "Técnicas", c("r100_p1", "r100_p2")),
                                                                                  subindice("b", "Transversales", "r100_p3")),
                                                     indices = list(indice("idx", "Índice", c("a", "b")))))
  list(data = d2, instrumento = inst)
}
.dm_xml <- function(out, k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
.dm_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.dm_print <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); out }
.dm_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dm_payload <- function() {
  sc <- data.frame(axis_label = rep(c("Total cruce", "Técnicas", "Transversales"), 3), grupo = rep(c("Total", "Masculino", "Femenino"), each = 3),
                   tipo = rep(c("total_cruce", "apertura", "apertura"), 3), score_raw = c(95, 94.6, 79.6, 95, 93.4, 82.2, 95, 96.1, 77),
                   base = rep(c(109, 56, 53), each = 3))
  list(score_heat = sc, axis_order_heat = c("Total cruce", "Técnicas", "Transversales"), group_order_natural = c("Total", "Masculino", "Femenino"))
}

test_that("preparar_heatmap_dim redondea cifras, guarda el valor crudo y saca el rango del crudo (como el recetario)", {
  e <- preparar_heatmap_dim(.dm_payload(), titulo_cruce = "Sexo")
  expect_identical(e$filas, c("Técnicas", "Transversales"))                        # sin la fila «Total cruce»
  expect_identical(e$columnas$rotulo, c("Total", "Masculino", "Femenino")); expect_equal(e$columnas$n, c(109, 56, 53))
  expect_equal(unname(e$valores["Técnicas", ]), c(95, 93, 96)); expect_equal(unname(e$valores_crudos["Transversales", 1]), 79.6)
  expect_equal(e$rango, c(75, 100))                                                 # 79.6 cae en el tramo desde 75
  expect_identical(e$bloques[[1]]$cols, 2:3)
})

test_that("el mapa de calor nativo escribe la diferencia con el total bajo cada cifra y el color contrasta con su tramo", {
  e <- preparar_heatmap_dim(.dm_payload(), titulo_cruce = "Sexo")
  o <- .lam_laminas_heatmap_dim(.dm_doc(), e, "Competencias", folio = 92)
  xml <- .dm_xml(.dm_print(o$doc), length(o$doc))
  expect_identical(.dm_txt(xml, "calor:diferencia"), c("-2", "+1", "+2", "-3"))      # Técnicas 93-95, 96-95; Transversales 82-80, 77-80
  expect_identical(.dm_txt(xml, "calor:bloque"), "Sexo")
  expect_length(.dm_txt(xml, "calor:escala_corte"), 6L)
  tramos <- unlist(.std_paleta("calor")$tramos)
  expect_identical(.lam_calor(c(75, 79.6, 99.9), 75, 100), tramos[c(1, 1, 5)])
})

test_that("el comparativo de dos grupos escribe la diferencia sin signo entre cifras redondeadas", {
  e <- preparar_comparativo_dim(.dm_payload())
  expect_identical(e$grupos, c("Masculino", "Femenino"))
  expect_identical(unname(e$textos_diferencia), c("3 pts", "5 pts"))               # |96-93| y |77-82|
  o <- .lam_laminas_comparativo_dim(.dm_doc(), e, "Índices por sexo", folio = 94)
  xml <- .dm_xml(.dm_print(o$doc), length(o$doc))
  expect_identical(.dm_txt(xml, "comparativo:diferencia"), c("3 pts", "5 pts"))
  expect_true("Masculino (56)" %in% .dm_txt(xml, "leyenda:texto"))
  p3 <- .dm_payload(); p3$score_heat <- rbind(p3$score_heat, transform(p3$score_heat[p3$score_heat$grupo == "Femenino", ], grupo = "Otro"))
  p3$group_order_natural <- c(p3$group_order_natural, "Otro")
  expect_null(preparar_comparativo_dim(p3))                                         # con tres grupos no es un comparativo de dos
})

test_that("la compuerta deja en la ruta anterior lo que no cabe", {
  e <- preparar_heatmap_dim(.dm_payload())
  expect_true(.lam_dimensiones_cabe(e))
  e$valores <- e$valores[, rep(1:3, 4)]; e$columnas <- e$columnas[rep(1:3, 4), ]
  expect_false(.lam_dimensiones_cabe(e))                                            # 12 columnas
})

test_that("en la ruta real p_dim_heatmap y p_dim_comparativo_radarbar salen nativos con su espec", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  f <- .dm_fixture()
  plan <- list(a = p_slide_1_grafico(grafico = p_dim_heatmap(objetivo = "idx_idx", cruce = "sexo", modo = "general"), titulo = "Por sexo"),
               b = p_slide_1_grafico(grafico = p_dim_comparativo_radarbar(objetivo = "idx_idx", cruce = "sexo", modo = "general"), titulo = "Índices"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$instrumento, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  g <- function(k) xml2::xml_attr(xml2::xml_find_all(.dm_xml(out, k), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:heatmap_dim" %in% g(1))
  expect_true("prosecnur:grafico:comparativo_dim" %in% g(2))
  expect_identical(.dm_txt(.dm_xml(out, 1), "calor:fila"), c("Técnicas", "Transversales"))
  expect_identical(.dm_txt(.dm_xml(out, 1), "calor:bloque"), "Sexo")
  expect_identical(.dm_txt(.dm_xml(out, 2), "Folio lamina"), "2")
})

# ---- Hallazgos del verificador de N5 (ruta real con datos de borde) ----------

test_that("sin una sola cifra no hay mapa ni comparativo: la lámina sigue por la ruta anterior y el mazo no se cae", {
  p <- .dm_payload(); p$score_heat$score_raw <- NA_real_
  expect_null(preparar_heatmap_dim(p))                                              # hallazgo 1: antes rango Inf/-Inf
  p2 <- .dm_payload(); p2$score_heat$score_raw[p2$score_heat$grupo == "Femenino"] <- NA_real_
  expect_null(preparar_comparativo_dim(p2))                                         # hallazgo 3: antes «NA» en Diferencia
  e <- preparar_heatmap_dim(p2); expect_true(is.na(e$columnas$n[3]))                # columna sin cifras: sin n
})

test_that("el adjuntador respeta el default del config, las brechas declaradas y el Total del comparativo", {
  f <- .dm_fixture()
  cfg <- reporte_dimensiones_config(f$data); cfg$visual$incluir_total_default <- FALSE; attr(f$data, "dimensiones_config") <- cfg
  args <- list(data = f$data, instrumento = f$instrumento, modo = "general", objetivo = "idx_idx", cruce = "sexo")
  e <- attr(.espec_dim_adjuntar(ggplot2::ggplot(), args, "heatmap"), "pulso_espec")
  expect_false("Total" %in% e$columnas$rotulo)                                       # hallazgo 2
  expect_null(attr(.espec_dim_adjuntar(ggplot2::ggplot(), c(args, brecha_cols = TRUE), "heatmap"), "pulso_espec"))       # hallazgo 6
  expect_null(attr(.espec_dim_adjuntar(ggplot2::ggplot(), c(args, incluir_total = TRUE), "comparativo"), "pulso_espec"))
})

test_that("los casos de cada columna son los que respondieron la batería, no el total del grupo", {
  f <- .dm_fixture()
  for (v in grep("^sub_|^r100_", names(f$data), value = TRUE)) f$data[[v]][1:10] <- NA   # 10 casos sin ninguna respuesta
  args <- list(data = f$data, instrumento = f$instrumento, modo = "general", objetivo = "idx_idx", cruce = "sexo", incluir_total = TRUE)
  e <- attr(.espec_dim_adjuntar(ggplot2::ggplot(), args, "heatmap"), "pulso_espec")
  expect_equal(e$columnas$n[e$columnas$rotulo == "Total"], 50)                       # hallazgo 8: 60 casos, 10 sin respuestas
})

test_that("la compuerta mide los rótulos de fila y la leyenda del comparativo", {
  e <- preparar_heatmap_dim(.dm_payload())
  largo <- "Pensamiento crítico y resolución de problemas en contextos profesionales"
  e8 <- e; e8$filas <- rep(largo, 8); e8$valores <- e$valores[rep(1, 8), ]; e8$valores_crudos <- e8$valores
  expect_false(.lam_dimensiones_cabe(e8))                                            # hallazgo 4: 8 filas de dos líneas
  c2 <- preparar_comparativo_dim(.dm_payload())
  expect_true(.lam_dimensiones_cabe(c2))
  c2$grupos <- c("Facultad de Ciencias e Ingeniería con un nombre muy largo", "Facultad de Ciencias Sociales con otro nombre largo")
  expect_false(.lam_dimensiones_cabe(c2))                                            # hallazgo 5: la leyenda no cabe
})

test_that("el pie del mapa explica el asterisco y la diferencia bajo cada cifra (recetario 92)", {
  p <- .dm_payload(); p$score_heat$base[p$score_heat$grupo == "Femenino"] <- 9
  e <- preparar_heatmap_dim(p)
  o <- .lam_laminas_heatmap_dim(.dm_doc(), e, "Competencias", base = "Base: 109 estudiantes", folio = 92)
  pie <- .dm_txt(.dm_xml(.dm_print(o$doc), length(o$doc)), "Base lamina")
  expect_identical(pie, "Base: 109 estudiantes. * Menos de 15 casos. Debajo de cada cifra, la diferencia con el total en puntos")   # hallazgo 7
})

test_that("una lámina, una base: si las columnas cuentan respondientes, el pie dice el mismo total", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  f <- .dm_fixture()
  for (v in grep("^sub_|^r100_", names(f$data), value = TRUE)) f$data[[v]][1:10] <- NA
  plan <- list(a = p_slide_1_grafico(grafico = p_dim_heatmap(objetivo = "idx_idx", cruce = "sexo", modo = "general", incluir_total = TRUE), titulo = "Por sexo"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$instrumento, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- .dm_xml(out, 1)
  expect_identical(.dm_txt(xml, "calor:casos")[1], "50")
  expect_match(.dm_txt(xml, "Base lamina"), "^Base: 50 .*que respondieron la batería")        # antes «Base: 60» con Total 50
  args <- list(data = f$data, instrumento = f$instrumento, modo = "general", objetivo = "idx_idx", cruce = "sexo", incluir_total = TRUE,
               filtros = list(sexo = "1"))
  e <- attr(.espec_dim_adjuntar(ggplot2::ggplot(), args, "heatmap"), "pulso_espec")
  expect_equal(e$n_respondieron_total, sum(f$data$sexo[11:60] == "1"))                        # con filtro también cuenta respondientes
})
