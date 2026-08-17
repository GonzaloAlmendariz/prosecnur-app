# Contrato de graficador_dimensiones.R (unidad 5.7 — grandes sin test dedicado).
#
# Los graficadores públicos (radar/heatmap/foda/comparativo) ya tienen suites
# propias (test-engine-dimensiones-ppt-radar.R, -iconos-foda-radar.R,
# -criterios-heatmap.R). Lo que NO tenía cobertura era la capa de
# transformación payload → plot que TODOS comparten, y el graficador
# `graficar_radar_tabla_dimensiones` (flujo Analítica, retirado del PPT):
#
#   - .dim_payload_to_plot_df / .dim_payload_to_numeric_wide: el contrato
#     "payload de indicador → data lista para graficar" (series saneadas,
#     orden de ejes preservado e invertido para barras horizontales)
#   - .dim_payload_to_total_cruce_df / .dim_payload_to_axis_total_df: los dos
#     modos chip (por cruce y por eje, anclado al grupo Total)
#   - .dim_normalize_visual_mode: aliases legacy del modo visual
#   - .dim_alias_radar_extra_args: aliases de canvas_h_* legacy
#   - .dim_make_table_df: la tabla Top 2 Box adjunta (formato %)
#   - graficar_radar_tabla_dimensiones end-to-end con data sintética mínima

source("setup-load-all.R")

# Payload sintético con el shape que emite el motor de indicadores
# (score_plot/score_heat + órdenes). Dos ejes, grupos Total/Norte.
.gd_payload <- function() {
  list(
    score_plot = tibble::tibble(
      axis_label = c("Confianza", "Claridad", "Confianza", "Claridad"),
      grupo = c("Total", "Total", "Norte", "Norte"),
      score_raw = c(71.2, 64.9, 80.1, 55.4),
      score_round = c(71, 65, 80, 55),
      base = c(120, 120, 60, 60)
    ),
    score_heat = tibble::tibble(
      tipo = c("total_cruce", "total_cruce", "celda"),
      grupo = c("Norte", "Sur", "Norte"),
      score_raw = c(67.7, 58.2, 80.1),
      score_round = c(68, 58, 80),
      base = c(60, 60, 60)
    ),
    group_order = c("Total", "Norte"),
    group_order_natural = c("Total", "Norte", "Sur"),
    axis_order_plot = c("Confianza", "Claridad")
  )
}

test_that("payload_to_plot_df: normaliza score_plot a eje/grupo/valor/base", {
  df <- .dim_payload_to_plot_df(.gd_payload())
  expect_identical(names(df), c("eje", "grupo", "valor", "base"))
  expect_identical(df$valor, c(71, 65, 80, 55))
  expect_identical(df$eje[1], "Confianza")
  expect_type(df$eje, "character")
})

test_that("payload_to_numeric_wide: series saneadas y ejes en orden invertido para barras", {
  w <- .dim_payload_to_numeric_wide(.gd_payload())
  expect_identical(names(w), c("data", "vars_valor", "etiquetas_series"))
  expect_identical(w$vars_valor, c("serie_Total", "serie_Norte"))
  expect_identical(
    w$etiquetas_series,
    stats::setNames(c("Total", "Norte"), c("serie_Total", "serie_Norte"))
  )
  expect_identical(names(w$data), c("categoria", "serie_Total", "serie_Norte"))
  # Los levels van invertidos respecto de axis_order_plot (barras horizontales).
  expect_identical(levels(w$data$categoria), c("Claridad", "Confianza"))
  expect_identical(w$data$serie_Norte[w$data$categoria == "Confianza"], 80)

  # Grupos con nombres sucios/duplicados producen columnas únicas y seguras.
  p2 <- .gd_payload()
  p2$score_plot$grupo <- c("Zona A!", "Zona A!", "Zona-A", "Zona-A")
  p2$group_order <- c("Zona A!", "Zona-A")
  w2 <- .dim_payload_to_numeric_wide(p2)
  expect_identical(length(unique(w2$vars_valor)), 2L)
  expect_true(all(grepl("^serie_", w2$vars_valor)))
})

test_that("payload chips: total_cruce filtra el heat y axis_total ancla al grupo Total", {
  tc <- .dim_payload_to_total_cruce_df(.gd_payload())
  # Solo filas tipo total_cruce, en el orden natural del cruce.
  expect_identical(as.character(tc$categoria), c("Norte", "Sur"))
  expect_identical(levels(tc$categoria), c("Norte", "Sur"))
  expect_identical(tc$valor_round, c(68, 58))
  expect_true(all(tc$fill_bar == tc$fill_bar[1]))

  at <- .dim_payload_to_axis_total_df(.gd_payload())
  expect_identical(unique(at$grupo), "Total")
  expect_identical(as.character(at$categoria), c("Confianza", "Claridad"))
  expect_identical(at$valor_round, c(71, 65))
})

test_that("normalize_visual_mode: aliases legacy y fallback a default", {
  expect_identical(.dim_normalize_visual_mode("chip"), "barras_chip_total")
  expect_identical(.dim_normalize_visual_mode("barras_total_chip"), "barras_chip_total")
  expect_identical(.dim_normalize_visual_mode("axis_chip"), "barras_chip_ejes")
  expect_identical(.dim_normalize_visual_mode("RADAR"), "radar")
  expect_identical(.dim_normalize_visual_mode("cualquier_cosa"), "auto")
  expect_identical(.dim_normalize_visual_mode(NULL), "auto")
  expect_identical(.dim_normalize_visual_mode(NA_character_, default = "radar"), "radar")
})

test_that("alias_radar_extra_args: mapea canvas_h_* legacy sin pisar el canónico", {
  out <- .dim_alias_radar_extra_args(list(canvas_h_title = 0.5, canvas_h_legend = 0.3))
  expect_identical(out$canvas_h_header_in, 0.5)
  expect_identical(out$canvas_h_legend_in, 0.3)
  expect_false("canvas_h_title" %in% names(out))
  expect_false("canvas_h_legend" %in% names(out))

  # Si el canónico ya viene, el alias legacy se descarta sin pisarlo.
  out2 <- .dim_alias_radar_extra_args(list(canvas_h_header_in = 0.9, canvas_h_title = 0.5))
  expect_identical(out2$canvas_h_header_in, 0.9)

  expect_null(.dim_alias_radar_extra_args(NULL))
})

test_that("make_table_df: tabla Top 2 Box con porcentajes por grupo", {
  tb <- .dim_make_table_df(.gd_payload(), titulo_left = "Top 2 Box")
  expect_s3_class(tb, "data.frame")
  expect_identical(names(tb)[1], "Top 2 Box")
  expect_setequal(setdiff(names(tb), "Top 2 Box"), c("Total", "Norte"))
  expect_true(all(grepl("^[0-9]+%$", unlist(tb[, -1]))))
  fila_conf <- tb[tb[["Top 2 Box"]] == "Confianza", ]
  expect_identical(fila_conf$Total, "71%")
  expect_identical(fila_conf$Norte, "80%")
})

test_that("graficar_radar_tabla_dimensiones: end-to-end con data sintética devuelve un ggplot", {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("5", "4", "5", "4", "5", "4"),
    servicio = c("A", "A", "B", "B", "A", "B"),
    stringsAsFactors = FALSE
  )
  survey <- data.frame(
    name = c("p1", "p2", "servicio"),
    type = c("select_one sat", "select_one sat", "select_one srv"),
    list_name = c("sat", "sat", "srv"),
    stringsAsFactors = FALSE
  )
  choices <- rbind(
    data.frame(list_name = "sat", name = as.character(1:5),
               label = as.character(1:5), stringsAsFactors = FALSE),
    data.frame(list_name = "srv", name = c("A", "B"), label = c("A", "B"),
               stringsAsFactors = FALSE)
  )
  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  d1 <- reporte_dimensiones(
    data = dat, instrumento = inst, vars = c("p1", "p2"),
    prefijo = "r100_", reemplazar = FALSE,
    orden_por_lista = list(sat = as.character(1:5))
  )
  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(subindice("s1", "S1", "r100_p1"), subindice("s2", "S2", "r100_p2")),
    indices = list(indice("idx", "Indice", c("s1", "s2")))
  )

  g <- graficar_radar_tabla_dimensiones(
    data = d2, instrumento = inst, modo = "general", objetivo = "idx_idx",
    cruce = "servicio", exportar = "rplot"
  )
  expect_s3_class(g, "ggplot")
})


# --- P35: el tercer sistema de guia -----------------------------------------
#
# Este archivo dibujaba el marco —ya con el color y el grosor de la guia— pero
# SIN una sola cota, mientras barras, pie y radar acotaban cada caja. Un marco
# sin medida no deja comprobar nada, que es lo que la guia viene a permitir.

test_that("apagada, la guia devuelve el bloque intacto", {
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_identical(.dim_wrap_debug_canvas(g, debug_ph_bordes = FALSE), g)
})


test_that("con el tamaño fisico del bloque la guia acota; sin el, solo enmarca", {
  # `.guia_ph_grobs()` no puede convertir npc a centimetros sin saber cuanto
  # mide la caja: sin ese dato sale el marco a secas, que es el comportamiento
  # de antes. Por eso los dos llamadores que envuelven el canvas ENTERO siguen
  # funcionando sin tocarlos.
  skip_if_not_installed("cowplot")
  g <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  con <- .dim_wrap_debug_canvas(g, TRUE, etiqueta = "panel",
                                ancho_in = 8.5, alto_in = 5)
  sin <- .dim_wrap_debug_canvas(g, TRUE, etiqueta = "panel")
  expect_s3_class(con, "ggplot")
  expect_s3_class(sin, "ggplot")
  # El acotado suma mas capas: marco + rotulo + las cotas.
  expect_gt(length(con$layers), length(sin$layers))
})


test_that("la guia de dimensiones no inventa un color propio", {
  # Era el TERCER sistema del paquete; el color ya coincidia y las cotas no.
  expect_equal(eval(formals(.dim_wrap_debug_canvas)$debug_ph_col), .GUIA_COL)
  expect_equal(eval(formals(.dim_wrap_debug_canvas)$debug_ph_lwd), .GUIA_LWD)
})
