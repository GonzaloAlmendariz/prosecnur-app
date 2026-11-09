source("setup-load-all.R")

# ADR 0135 (U4 del estudio de síntesis): las aperturas dentro de un público avisan al pie el grupo de menos de 30 casos,
# como el resumen de Arte y Diseño FG 2026: «Grupo chico: 24 docentes TC.».

.gc_fuentes <- function(n_tc = 24L, n_tpa = 91L) {
  n <- n_tc + n_tpa
  d <- data.frame(ded = c(rep("1", n_tc), rep("2", n_tpa)),
                  q1 = rep(c("1", "2", "3", "4", "5"), length.out = n), q2 = rep(c("4", "5", "2", "3", "1"), length.out = n),
                  stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("ded", "q1", "q2"), type = c("select_one ded", "select_one lk", "select_one lk"),
                                   list_name = c("ded", "lk", "lk"), label = c("Dedicación", "Servicio de salud", "Reglamentos"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("ded", "ded", rep("lk", 5)), name = c("1", "2", as.character(1:5)),
                                    label = c("TC", "TPA", "Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  list(data_sources = list(docentes = d), inst_sources = list(docentes = inst))
}

test_that("la nota nombra el grupo bajo 30 casos con su número, su unidad y su rótulo", {
  e <- list(grupos = c("TC", "TPA"), casos = matrix(c(24, 24, 91, 91), 2))
  expect_identical(.dumbbell_nota_grupo_chico(e, "docentes"), "Grupo chico: 24 docentes TC.")
  e2 <- list(grupos = c("TC", "TPA", "TPB"), casos = matrix(c(24, 23, 91, 91, 12, 12), 2))
  expect_identical(.dumbbell_nota_grupo_chico(e2, "docentes"), "Grupos chicos: 24 docentes TC; 12 docentes TPB.")
  e3 <- list(grupos = c("TC", "TPA"), casos = matrix(c(30, 30, 91, 91), 2))
  expect_null(.dumbbell_nota_grupo_chico(e3, "docentes"))   # 30 ya no es chico
  expect_identical(.GRUPO_CHICO_UMBRAL, 30L)
})

test_that("la apertura del resumen lleva la nota al pie de la lámina nativa; entre bases no se escribe", {
  skip_if_not_installed("officer")
  src <- .gc_fuentes()
  el <- p_dumbbell(vars = list(`Servicio de salud` = "docentes$q1", Reglamentos = "docentes$q2"), corte = c("4", "5"),
                   cruce = "docentes$ded", grupos = c("1", "2"), estilo = "resumen")
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Aperturas")))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  expect_identical(attr(salida$rendered[[1]], "pulso_espec")$nota_grupo_chico, "Grupo chico: 24 docentes TC.")
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  texto <- paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//a:t")), collapse = " ")
  expect_false(grepl("Grupo chico", texto, fixed = TRUE))   # 8c9b5ffca: va a los avisos del analista, no al pie
  # Con grupos de 30 o más no hay nota.
  src2 <- .gc_fuentes(40L, 91L)
  s2 <- suppressWarnings(reporte_ppt_plan(data = src2$data_sources, instrumento = src2$inst_sources, plan = plan,
                                          solo_lista = TRUE, mensajes_progreso = FALSE))
  expect_null(attr(s2$rendered[[1]], "pulso_espec")$nota_grupo_chico)
})
