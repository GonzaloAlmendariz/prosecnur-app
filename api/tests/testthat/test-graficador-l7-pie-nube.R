# B19 del GOAL motor PPT (carril L7, sesion B):
# - max_palabras/min_chars de p_nube_palabras eran FANTASMAS: la UI los curaba
#   pero el puente payload->constructor los descartaba por no ser formals.
# - pie/donut duplicaban la Base (caption del grafico + placeholder del slide):
#   entran a la regla de dedup de P9/P17/P23.

test_that("p_nube_palabras acepta max_palabras y min_chars (ex fantasmas)", {
  el <- p_nube_palabras(var = "opinion", max_palabras = 5, min_chars = 6)
  expect_identical(el$overrides$max_palabras, 5L)
  expect_identical(el$overrides$min_chars, 6L)
})

test_that("pie y donut no duplican la Base en el placeholder del slide", {
  df <- data.frame(
    satisf = c("Sí", "Sí", "No", "Sí"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(name = "satisf", type = "select_one sn",
                        list_name = "sn", label = "Satisfecho",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sn", name = c("Sí", "No"),
                         label = c("Sí", "No"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  out <- reporte_ppt_plan(
    data = df, instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(p_pie(var = "satisf"), titulo = "pie"),
      diapo_002 = p_slide_1_grafico(p_donut(var = "satisf"), titulo = "donut")
    ),
    solo_lista = TRUE, build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )
  bases <- lapply(out$render_meta, function(m) m$base)
  expect_true(all(vapply(bases, is.null, logical(1))))
})
