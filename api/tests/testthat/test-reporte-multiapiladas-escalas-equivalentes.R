# B42/G-20: "comparar publicos por tema" en multibase. Cada instrumento
# nombra sus listas distinto y las etiquetas divergen en mayusculas o en la
# presencia de SIN INF; la firma exacta rechazaba escalas identicas en
# significado y la lamina moria degradada a "Sin datos" (visto con el
# proyecto Conta real: lst_p12/lst_p10/lst_p17/lst_p9).

.mk_base <- function(labels, var = "q1", lst = "lst_x", n = 20) {
  codes <- as.character(seq_along(labels))
  data <- data.frame(
    q = sample(codes, n, replace = TRUE),
    stringsAsFactors = FALSE
  )
  names(data) <- var
  inst <- list(
    survey = data.frame(
      name = var,
      type = paste("select_one", lst),
      list_name = lst,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = lst,
      name = codes,
      label = labels,
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  list(data = data, inst = inst)
}

test_that("escalas iguales salvo mayusculas y SIN INF comparan como equivalentes", {
  set.seed(42)
  a <- .mk_base(c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
                  "Totalmente de acuerdo", "SIN INF"),
                var = "p12_1", lst = "lst_p12")
  b <- .mk_base(c("Totalmente en Desacuerdo", "En Desacuerdo", "De Acuerdo",
                  "Totalmente de Acuerdo"),
                var = "p10_1", lst = "lst_p10")

  out <- reporte_ppt_plan(
    data = list(docentes = a$data, estudiantes = b$data),
    instrumento = list(docentes = a$inst, estudiantes = b$inst),
    plan = list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list("Claridad de propositos" = c("docentes$p12_1", "estudiantes$p10_1"))
      )
    )),
    presets = p_presets(multi_apiladas = list(usar_canvas = TRUE)),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$plan, 1L)
  # La lamina NO se degrada: el elemento renderizado existe y no es el canvas
  # "Sin datos" (que llega como ggplot_raw de texto).
  rendered <- out$rendered[[1]]
  expect_false(is.null(rendered))
  gb <- ggplot2::ggplot_build(rendered)
  textos <- unique(unlist(lapply(gb$data, function(x) {
    if ("label" %in% names(x)) as.character(x$label) else character(0)
  })))
  expect_false(any(grepl("Sin datos", textos, fixed = TRUE)))

  # G-20b: las categorias se FUNDEN en la etiqueta canonica — no puede haber
  # dos series por la misma opcion con distinta capitalizacion.
  grupos <- unique(as.character(rendered$data$.grupo %||% character(0)))
  variantes_desacuerdo <- grupos[grepl("^en desacuerdo$", tolower(trimws(grupos)))]
  expect_lte(length(variantes_desacuerdo), 1L)
})

test_that("escalas de verdad distintas siguen rechazandose con error claro", {
  set.seed(7)
  a <- .mk_base(c("Si", "No"), var = "p1", lst = "lst_a")
  b <- .mk_base(c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"),
                var = "p2", lst = "lst_b")

  expect_warning(
    reporte_ppt_plan(
      data = list(x = a$data, y = b$data),
      instrumento = list(x = a$inst, y = b$inst),
      plan = list(diapo_001 = p_slide_1_grafico(
        grafico = p_barras_multiapiladas(
          modo = "var_cruce",
          vars = list(bloque = c("x$p1", "y$p2"))
        )
      )),
      presets = p_presets(multi_apiladas = list(usar_canvas = TRUE)),
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    ),
    "no comparten una escala compatible"
  )
})
