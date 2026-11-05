# H1 del checklist de usabilidad del editor (docs/qa/checklist-usabilidad-editor-2026-11-05.md): la vista previa y las
# miniaturas aplican los rótulos cortos del estudio (`plan$rotulos_cortos`) y la regla inclusiva igual que el job de PPT
# y Word (`.inclusivo_preparar_job`, graficos_inclusivo.R). Antes sólo los jobs: el editor mostraba
# «Académica (grupos de lectura, seminarios…)» y el PPT «Académica».

.rc_fuentes <- function() {
  df <- data.frame(act = rep(c("aca", "abu"), c(6, 4)), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = "act", type = "select_one l_act", list_name = "l_act", label = "Actividad", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "l_act", name = c("aca", "abu"),
                         label = c("Académica (grupos de lectura, seminarios temáticos)", "Con mis abuelos/as"), stringsAsFactors = FALSE),
    orders_list = list(act = list(names = c("aca", "abu"), labels = c("Académica (grupos de lectura, seminarios temáticos)", "Con mis abuelos/as"))))
  list(data_sources = list(principal = df), inst_sources = list(principal = inst), consolidado = FALSE, reglas_metodologia = list())
}

.rc_slide <- function() list(id = "s1", tipo = "p_slide_1_grafico", payload = list(
  titulo = "Actividad", grafico = list(graficador = "p_barras_categoricas", args = list(var = "act"))))

.rc_cfg <- function(cortos = NULL) {
  cfg <- .graficos_default_config(NULL)
  cfg$plan <- list(slides = list(.rc_slide()))
  if (!is.null(cortos)) cfg$plan$rotulos_cortos <- cortos
  cfg
}

.rc_texto <- function(pptx) {
  xml <- xml2::read_xml(.pptx_leer_parte(pptx, .pptx_slide_paths(pptx)[[1]]))
  paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
}

.rc_previa <- function(cfg, fuentes = .rc_fuentes()) {
  testthat::local_mocked_bindings(
    .graficos_config_get = function(sid, ...) .graficos_default_config(NULL),
    .graficos_active_base_name = function(sid) "principal",
    session_get = function(sid, ...) list(dir = tempdir(), files = list()),
    .package = "prosecnurapp"
  )
  comun <- .graficos_preview_comun("sid-x", list(config = cfg), fuentes)
  ctx <- .graficos_preview_lamina_ctx(comun, .rc_slide())
  raiz <- withr::local_tempdir()
  r <- suppressWarnings(suppressMessages(.mini_resolver(ctx, raiz, list(preview_quality = "quick", render_slide_preview = FALSE,
                                                                         preview_partes = FALSE))))
  list(texto = .rc_texto(r$pptx), hash = ctx$hash)
}

test_that("H1: la vista previa con un rótulo corto declarado lo muestra, con la regla inclusiva como el PPT", {
  skip_if_not_installed("officer")
  p <- .rc_previa(.rc_cfg(list(`Académica (grupos de lectura, seminarios temáticos)` = "Académica")))
  expect_match(p$texto, "Académica", fixed = TRUE)
  expect_false(grepl("grupos de lectura", p$texto, fixed = TRUE))
  expect_match(p$texto, "Con mis abuelos(as)", fixed = TRUE)   # la regla inclusiva va junto, como en el job
  expect_false(grepl("abuelos/as", p$texto, fixed = TRUE))
})

test_that("H1: sin rótulos cortos la vista previa conserva el rótulo completo; declararlos cambia la huella de la caché", {
  skip_if_not_installed("officer")
  sin <- .rc_previa(.rc_cfg())
  con <- .rc_previa(.rc_cfg(list(`Académica (grupos de lectura, seminarios temáticos)` = "Académica")))
  expect_match(sin$texto, "Académica (grupos de lectura, seminarios temáticos)", fixed = TRUE)
  expect_false(identical(sin$hash, con$hash))
})

test_that("H1: la vista previa convierte lo mismo que el job (datos, instrumento, lámina y paletas)", {
  f <- .rc_fuentes()
  cortos <- list(`Académica (grupos de lectura, seminarios temáticos)` = "Académica", `Con mis abuelos/as` = "Abuelos")
  paletas <- list(act = list(`Con mis abuelos/as` = "#112233"))
  dir <- withr::local_tempdir()
  saveRDS(f$data_sources, file.path(dir, "d.rds")); saveRDS(f$inst_sources, file.path(dir, "i.rds"))
  job <- .inclusivo_preparar_job(file.path(dir, "d.rds"), file.path(dir, "i.rds"), list(rotulos_cortos = cortos, slides = list(.rc_slide())), paletas)
  previa <- .inclusivo_preparar_preview(f$data_sources, f$inst_sources, paletas, cortos)
  expect_identical(previa$inst_sources, readRDS(job$inst))
  expect_identical(previa$data_sources, readRDS(job$data))
  expect_identical(previa$paletas, job$paletas)
  expect_identical(.inclusivo_preparar_lamina(.rc_slide(), previa$mapa), job$plan$slides[[1]])
  expect_identical(previa$inst_sources$principal$choices$label, c("Académica", "Abuelos"))
  # El consolidado no la aplica en su export, así que su vista previa tampoco.
  sin <- .inclusivo_preparar_preview(f$data_sources, f$inst_sources, paletas, cortos, activo = FALSE)
  expect_identical(sin$inst_sources, f$inst_sources)
})
