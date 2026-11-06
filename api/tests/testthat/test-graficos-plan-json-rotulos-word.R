source("setup-load-all.R")

# Tres defectos del motor de gráficos vistos al generar el Perfil del Estudiante CCSS 2026 por la API (2026-11-02):
#   1. `excluir_opciones` como arreglo JSON pasaba `/validar` y el job caía en el constructor (`character()` exigido).
#   2. El subtítulo de `p_slide_1_grafico` no entraba al rótulo Word: dos láminas de la misma batería salían iguales.
#   3. (ver abajo) el título de la figura única de una multiapilada `var` sin `word_titulo_figura`.

.pj_plan_json <- function(graficador, excluir) {
  body <- jsonlite::toJSON(list(plan = list(slides = list(list(
    tipo = "p_slide_1_grafico",
    payload = list(titulo = "Uso de redes", grafico = list(graficador = graficador,
                                                           args = list(var = "p1", cruces = "sexo", excluir_opciones = excluir)))
  )))), auto_unbox = TRUE)
  jsonlite::fromJSON(body, simplifyVector = FALSE)$plan   # como `.graficos_body_sin_simplificar` en /ppt y /word
}

test_that("1: un arreglo JSON en `excluir_opciones` llega al constructor como texto (agrupadas, categóricas, apiladas)", {
  for (graf in c("p_barras_agrupadas", "p_barras_apiladas")) {
    plan <- .normalize_plan(.pj_plan_json(graf, list("NS/NR", "No sabe")))
    expect_true(.validar_plan_json(plan)$ok)
    slide <- .graficos_rebuild_slide_json(plan$slides[[1]])
    expect_identical(slide$slots$plot$excluir_opciones, c("NS/NR", "No sabe"))
  }
  expect_identical(p_barras_categoricas(var = "p1", excluir_opciones = list("9", 8))$excluir_opciones, c("9", "8"))
})

test_that("1: validar y renderizar coinciden: lo que el constructor rechaza, /validar lo rechaza", {
  plan <- .normalize_plan(.pj_plan_json("p_barras_agrupadas", list(list(a = 1))))
  v <- .validar_plan_json(plan)
  expect_false(v$ok)
  expect_match(v$errors, "Opciones a ocultar", all = FALSE)
  expect_error(.graficos_rebuild_slide_json(plan$slides[[1]]), "excluir_opciones")
})

.pj_data <- function(n = 60) {
  set.seed(7)
  data.frame(sexo = sample(c("1", "2"), n, TRUE), tiktok = sample(c("1", "2", "3"), n, TRUE),
             youtube = sample(c("1", "2", "3"), n, TRUE), stringsAsFactors = FALSE)
}
.pj_inst <- function() {
  list(
    survey = data.frame(name = c("sexo", "tiktok", "youtube"),
                        type = c("select_one sx", "select_one frec", "select_one frec"),
                        list_name = c("sx", "frec", "frec"),
                        label = c("Sexo", "Frecuencia de uso", "Frecuencia de uso"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("sx", "sx", "frec", "frec", "frec"), name = c("1", "2", "1", "2", "3"),
                         label = c("Hombre", "Mujer", "Diario", "Semanal", "Nunca"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
}
.pj_titulos <- function(plan) {
  meta <- reporte_ppt_plan(
    data = .pj_data(), instrumento = .pj_inst(), plan = plan,
    presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets()),
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )$render_meta
  vapply(Filter(function(m) identical(m$kind %||% "chart", "chart"), meta), function(m) as.character(m$title %||% NA), "")
}

test_that("2: el subtítulo de la lámina entra al rótulo Word y distingue dos láminas de la misma batería", {
  skip_if_not_installed("officer")
  tit <- .pj_titulos(list(
    diapo_001 = p_slide_1_grafico(p_barras_agrupadas(var = "tiktok", cruces = "sexo"), titulo = "Uso de redes según sexo",
                                  subtitulo = "TikTok"),
    diapo_002 = p_slide_1_grafico(p_barras_agrupadas(var = "youtube", cruces = "sexo"), titulo = "Uso de redes según sexo",
                                  subtitulo = "YouTube"),
    diapo_003 = p_slide_1_grafico(p_barras_agrupadas(var = "youtube", cruces = "sexo"), titulo = "Uso de redes según sexo")
  ))
  expect_length(tit, 3L)
  expect_match(tit[1], " — TikTok$")
  expect_match(tit[2], " — YouTube$")
  expect_false(identical(tit[1], tit[2]))
  expect_false(grepl("—", tit[3]))   # sin subtítulo, el rótulo de siempre
})

test_that("2: el subtítulo no se repite si el título ya lo trae, y solo, hace de título", {
  expect_identical(.word_titulo_con_subtitulo("Uso de TikTok", "tiktok"), "Uso de TikTok")
  expect_identical(.word_titulo_con_subtitulo(.WORD_TITULO_VACIO, "YouTube"), "YouTube")
  expect_identical(.word_titulo_con_subtitulo("Uso", NULL), "Uso")
  expect_identical(.word_titulo_con_subtitulo("Uso", "  "), "Uso")
})
