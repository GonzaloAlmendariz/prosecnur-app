source("setup-load-all.R")

# B4 (decisión del lead, opción A): las láminas gemelas de un mazo (misma firma: las mismas barras de escala) salen con la
# misma barra, la mínima de su familia; una lámina sin gemela conserva su engrosamiento.

test_that("las familias se arman por firma y sólo cuentan las de dos o más láminas", {
  L <- list(list(firma = "escala:4", grosor = 0.57), list(firma = "escala:4", grosor = 0.44), list(firma = "escala:2", grosor = 0.7))
  f <- .lam_gf_familias(L)
  expect_identical(f$firma, "escala:4"); expect_equal(f$minimo, 0.44)
  lz <- .lam_lienzo(); .lam_gf_anotar(lz, 0.5, 2, 5); .lam_gf_anotar(lz, 0.5, 1, 2)
  expect_identical(.lam_gf_firma(lz), "escala:2")   # la Sí/No no cuenta en la firma
  lz2 <- .lam_lienzo(); .lam_gf_anotar(lz2, 0.5, 3, 2); expect_identical(.lam_gf_firma(lz2), "si_no:3")
  op <- options(prosecnur.lam_gf_tope = 0.45); on.exit(options(op))
  expect_lte(.lam_grosor_holgado(4), 0.45)
})

.gf_inst <- function(etiquetas) list(
  survey = data.frame(name = paste0("p", seq_along(etiquetas)), type = "select_one lk", list_name = "lk", label = etiquetas, stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = as.character(1:4), label = c("Nada", "Poco", "Algo", "Mucho"), stringsAsFactors = FALSE), orders_list = NULL)

test_that("dos láminas gemelas salen con la misma barra en el mazo; la que tiene alto de sobra cede hasta la de su gemela", {
  set.seed(4)
  d <- as.data.frame(replicate(8, sample(as.character(1:4), 120, TRUE)), stringsAsFactors = FALSE); names(d) <- paste0("p", 1:8)
  largo <- paste("Enunciado largo de una pregunta que ocupa varias líneas en la columna de las premisas y que obliga a la fila a crecer", 1:4)
  inst <- .gf_inst(c(paste("Corta", 1:4), largo))
  plan <- list(p_slide_1_grafico(p_barras_multiapiladas(vars = paste0("p", 1:4)), titulo = "Cortas"),
               p_slide_1_grafico(p_barras_multiapiladas(vars = paste0("p", 5:8)), titulo = "Largas"))
  out <- withr::local_tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = d, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  ps <- .pptx_slide_paths(out)
  g <- vapply(1:2, function(i) .verif_grosores_de_lamina(.verif_formas(.pptx_leer_parte(out, ps[i])), i)$grosor, 0)
  expect_equal(g[1], g[2], tolerance = 0.01)
  expect_identical(nrow(verificar_mazo(out)$hallazgos[verificar_mazo(out)$hallazgos$regla == "B4 gemelas desiguales", ]), 0L)
})
