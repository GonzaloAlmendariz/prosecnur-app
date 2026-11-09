source("setup-load-all.R")

# H1 (Arte, 2026-11-09): el arnés de QA (scripts/qa_graficos_medir.R) llamaba a `reporte_ppt_plan` sin el contexto del
# informe, así que ni los nombres cortos del plan (E4) ni los del mazo (ADR 0141) llegaban a su render: rojos falsos.
# Ahora el export y el arnés arman los argumentos del worker en el mismo sitio (`.graficos_ppt_job_args`) y renderizan
# con el mismo worker (`graficos_job_worker_ppt`).

.pja_plan <- function() list(
  rotulos_cortos = list(preguntas = list(`docentes$p1` = "Reglamentos")),
  slides = list(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_categoricas",
    args = list(var = "docentes$p2", overrides = list(etiquetas_vars = list(`docentes$p2` = "Biblioteca"))))))))

.pja_fuentes <- function() list(
  data_sources = list(docentes = data.frame(p1 = c("1", "2"), p2 = c("1", "2"))),
  inst_sources = list(docentes = list(survey = data.frame(name = c("p1", "p2"), type = "select_one lk", label = c("x", "y")))))

.pja_args <- function() {
  dir <- withr::local_tempdir(.local_envir = parent.frame())
  testthat::local_mocked_bindings(
    .graficos_delivery_options = function(cfg, template_id = NULL, auto_otros_slides = NULL)
      list(profile_id = NULL, template_id = NULL, auto_otros_slides = FALSE),
    .graficos_resolve_template_pptx = function(...) NULL,
    job_save_rds = function(sid, prefix, value) { p <- file.path(dir, paste0(prefix, ".rds")); saveRDS(value, p); p },
    .graficos_icon_registry = function(sid, cfg) list(),
    .graficos_active_base_name = function(sid) "docentes",
    .graficos_estilo_cliente_arg = function(sid, cfg, medio = "word") list(estilo_cliente = list()),
    .analitica_get_config = function(sid) list(),
    .tpub_equivalencias_sesion = function(sid) NULL,
    .env = parent.frame()
  )
  .graficos_ppt_job_args("sid-x", list(plan = .pja_plan(), presets = list(), paletas = list()), .pja_plan(), list(), .pja_fuentes())
}

test_that("los argumentos cubren la firma del worker del export, salvo las rutas del job", {
  args <- .pja_args()
  esperados <- setdiff(names(formals(graficos_job_worker_ppt)), c("result_path", "progress_path"))
  expect_setequal(names(args), esperados)
  expect_false(isTRUE(.build_presets(args$presets)$base$debug_ph_bordes))   # D17: sin guías en el entregable
})

test_that("con esos argumentos el worker fija los nombres cortos del plan y del mazo (E4 y ADR 0141)", {
  args <- .pja_args()
  previa <- suppressMessages(.sig_informe_preparar(args$significancia, args$rp_data_path, args$rp_inst_path, args$active_base))
  on.exit(options(previa), add = TRUE)
  ctx <- getOption("prosecnur.sig_informe")
  expect_identical(ctx$nombres_cortos$`docentes$p2`, "Biblioteca")
  expect_identical(ctx$rotulos_preguntas$`docentes$p1`, "Reglamentos")
  expect_identical(.nombre_corto_del_plan("docentes$p1"), "Reglamentos")
})

test_that("el arnés de QA y el endpoint /ppt arman los argumentos en el mismo sitio y renderizan con el mismo worker", {
  arnes <- file.path("..", "..", "..", "scripts", "qa_graficos_medir.R")
  router <- file.path("..", "..", "R", "router_graficos.R")
  skip_if(!file.exists(arnes) || !file.exists(router), "fuentes no disponibles")
  a <- paste(readLines(arnes, warn = FALSE), collapse = "\n")
  expect_true(grepl(".graficos_ppt_job_args(", a, fixed = TRUE))
  expect_true(grepl("do.call(graficos_job_worker_ppt", a, fixed = TRUE))
  expect_false(grepl("reporte_ppt_plan(", a, fixed = TRUE))   # un render a mano pierde el contexto del informe
  rg <- readLines(router, warn = FALSE)
  ini <- grep('"/api/graficos/ppt"', rg, fixed = TRUE)[1]
  fin <- ini + grep("plumber::pr_(post|get)\\(", rg[(ini + 1L):length(rg)])[1]
  expect_true(any(grepl("args = .graficos_ppt_job_args(", rg[ini:fin], fixed = TRUE)))
})
