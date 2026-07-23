source("setup-load-all.R")

# =============================================================================
# Condiciones clasificadas del motor de reportes por plan (unidad 5.1).
#
# Tres invariantes:
#   1) Spec invalida en constructores `p_*()` = condicion dual
#      `pulso_plan_spec_error` + `api_error` (400, E_REPORTE_PLAN_SPEC) con el
#      MISMO mensaje que el `stop()` historico.
#   2) Input/estructura invalida a nivel deck en `reporte_ppt_plan()` =
#      `pulso_plan_input_error` + `api_error` (400, E_REPORTE_PLAN_INPUT).
#   3) Fallo de render POR ELEMENTO degrada ESA lamina a canvas "Sin datos"
#      (warning para trazabilidad) sin matar el deck — la clase exacta del bug
#      `current_code` de 0.5.17, generalizada.
# =============================================================================

.cond_fixture <- function() {
  dat <- data.frame(
    p1 = c("si", "no", "si"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = "p1",
      type = "select_one lst_sino",
      list_name = "lst_sino",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_sino", "lst_sino"),
      name = c("si", "no"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  list(data = dat, instrumento = inst)
}

test_that("spec invalida en p_*() aborta con condicion clasificada api_error 400", {
  cnd <- tryCatch(
    p_barras_agrupadas(var = ""),
    condition = function(c) c
  )
  expect_s3_class(cnd, "pulso_plan_spec_error")
  expect_s3_class(cnd, "api_error")
  expect_s3_class(cnd, "error")
  expect_identical(cnd$status, 400L)
  expect_identical(cnd$code, "E_REPORTE_PLAN_SPEC")
  # El mensaje historico se preserva (los tests viejos asertan por regexp).
  expect_match(conditionMessage(cnd), "`var` debe ser character\\(1\\) no vacio")

  # El constructor retirado tambien es spec clasificada, no stop() crudo.
  cnd2 <- tryCatch(p_dim_radar_tabla(objetivo = "x"), condition = function(c) c)
  expect_s3_class(cnd2, "pulso_plan_spec_error")
  expect_match(conditionMessage(cnd2), "fue retirado del flujo PPT")
})

test_that("input invalido a nivel deck aborta con pulso_plan_input_error", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  cnd <- tryCatch(
    reporte_ppt_plan(
      data = "no soy un data.frame",
      instrumento = NULL,
      plan = list(diapo_001 = p_slide_portada("X")),
      presets = p_presets(),
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    ),
    condition = function(c) c
  )
  expect_s3_class(cnd, "pulso_plan_input_error")
  expect_s3_class(cnd, "api_error")
  expect_identical(cnd$code, "E_REPORTE_PLAN_INPUT")
  expect_match(conditionMessage(cnd), "`data` debe ser un data.frame")
})

test_that("un fallo de render por-lamina degrada ESA lamina y el deck sobrevive", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .cond_fixture()

  # diapo_002 referencia una variable inexistente: su renderer explota, pero el
  # deck completo (portada + lamina buena + lamina rota) debe producirse.
  plan <- list(
    diapo_001 = p_slide_portada("Deck resiliente"),
    diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas("var_fantasma")),
    diapo_003 = p_slide_1_grafico(grafico = p_barras_apiladas("p1"))
  )

  out_ppt <- tempfile(fileext = ".pptx")
  warns <- character(0)
  withCallingHandlers(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    ),
    warning = function(w) {
      warns <<- c(warns, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )

  # El deck salio con las 3 laminas (portada + degradada + buena).
  expect_true(file.exists(out_ppt))
  slides_en_zip <- grep(
    "^ppt/slides/slide\\d+\\.xml$",
    utils::unzip(out_ppt, list = TRUE)$Name,
    value = TRUE
  )
  expect_length(slides_en_zip, 3L)

  # La degradacion dejo rastro (no es un try() silencioso).
  expect_true(any(grepl("Lamina degradada a canvas 'Sin datos'", warns, fixed = TRUE)))

  # La lamina buena sigue rindiendo datos reales.
  slide3 <- paste(
    readLines(unz(out_ppt, "ppt/slides/slide3.xml"), warn = FALSE, encoding = "UTF-8"),
    collapse = "\n"
  )
  expect_match(slide3, "Sí|No")
})

test_that("un slot mangleado (no ppt_element) degrada la lamina, no el deck", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .cond_fixture()

  plan <- list(
    diapo_001 = p_slide_portada("Deck resiliente"),
    diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas("p1"))
  )
  # Simula el plan mangleado post-JSON (la clase del bug current_code): el slot
  # pierde la clase ppt_element.
  plan$diapo_002$slots$plot <- unclass(plan$diapo_002$slots$plot)

  out_ppt <- tempfile(fileext = ".pptx")
  warns <- character(0)
  withCallingHandlers(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    ),
    warning = function(w) {
      warns <<- c(warns, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  expect_true(any(grepl("debe ser `ppt_element`", warns, fixed = TRUE)))
  expect_true(file.exists(out_ppt))
})

test_that("helpers de degradacion: canvas es ggplot y el renderer del elemento degradado existe", {
  canvas <- .plan_canvas_sin_datos()
  expect_s3_class(canvas, "ggplot")

  el <- suppressWarnings(.plan_elemento_degradado("mensaje de prueba"))
  expect_s3_class(el, "ppt_element")
  expect_identical(el$.element_type, "canvas_degradado")
  expect_s3_class(.render_canvas_degradado(el), "ggplot")

  # La condicion recuperable conserva clase y mensaje.
  cnd <- tryCatch(.slide_abort_render("boom ", "detallado"), condition = function(c) c)
  expect_s3_class(cnd, "pulso_slide_render_error")
  expect_identical(conditionMessage(cnd), "boom detallado")
})
