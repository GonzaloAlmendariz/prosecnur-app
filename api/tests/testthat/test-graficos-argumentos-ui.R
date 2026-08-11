.fixture_apiladas_args_ui <- function() {
  data.frame(
    categoria = "Disena y construye la infraestructura fisica que requiere la sociedad, mediante el uso de herramientas y tecnicas modernas con alto contenido cientifico",
    N = 4,
    pct_1 = 0.25,
    pct_2 = 0.25,
    pct_3 = 0.50,
    stringsAsFactors = FALSE
  )
}

.render_apiladas_args_ui <- function(
    df,
    path,
    ...,
    mostrar_leyenda = FALSE,
    color_ejes = "#111111",
    size_ejes = 9,
    colores_grupos = c("Nada util 1" = "#5E97F6", "2" = "#00B839", "3" = "#F8766D")) {
  graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Nada util 1", pct_2 = "2", pct_3 = "3"),
    colores_grupos = colores_grupos,
    usar_canvas = TRUE,
    mostrar_leyenda = mostrar_leyenda,
    mostrar_valores = FALSE,
    mostrar_barra_extra = FALSE,
    canvas_w_bars = 0.60,
    canvas_w_extra = 0,
    color_ejes = color_ejes,
    size_ejes = size_ejes,
    ancho = 8,
    alto = 4,
    dpi = 150,
    exportar = "png",
    path_salida = path,
    ...
  )
}

.fixture_agrupadas_args_ui <- function() {
  data.frame(
    categoria = c("Nada util 1", "2", "3"),
    N = c(4, 4, 4),
    pct = c(0.25, 0.25, 0.50),
    stringsAsFactors = FALSE
  )
}

.render_agrupadas_args_ui <- function(df, path, ..., colores_categorias = NULL) {
  graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    colores_categorias = colores_categorias,
    usar_canvas = TRUE,
    mostrar_leyenda = FALSE,
    mostrar_valores = FALSE,
    mostrar_barra_extra = FALSE,
    canvas_w_bars = 0.60,
    canvas_w_extra = 0,
    ancho = 8,
    alto = 4,
    dpi = 150,
    exportar = "png",
    path_salida = path,
    ...
  )
}

.fixture_numericas_args_ui <- function() {
  data.frame(
    categoria = c("Grupo A", "Grupo B", "Grupo C"),
    N = c(10, 12, 9),
    media = c(1.5, 2.4, 3.2),
    stringsAsFactors = FALSE
  )
}

.render_numericas_args_ui <- function(df, path, ..., colores_categorias = NULL) {
  graficar_barras_numericas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    vars_valor = "media",
    etiquetas_series = c(media = "Media"),
    colores_categorias = colores_categorias,
    usar_canvas = FALSE,
    mostrar_leyenda = FALSE,
    mostrar_valores = FALSE,
    mostrar_n_sobre_barras = FALSE,
    ancho = 8,
    alto = 4,
    dpi = 150,
    exportar = "png",
    path_salida = path,
    ...
  )
}

.first_blue_bar_x <- function(img) {
  rgb <- img[, , 1:3, drop = FALSE]
  blue_mask <-
    rgb[, , 1] > 0.25 & rgb[, , 1] < 0.50 &
    rgb[, , 2] > 0.45 & rgb[, , 2] < 0.70 &
    rgb[, , 3] > 0.80
  xs <- which(colSums(blue_mask) > 5)
  min(xs)
}

.count_near_color_pixels <- function(img, hex, tolerance = 0.035) {
  rgb <- img[, , 1:3, drop = FALSE]
  target <- as.numeric(grDevices::col2rgb(hex)) / 255
  mask <-
    abs(rgb[, , 1] - target[1]) <= tolerance &
    abs(rgb[, , 2] - target[2]) <= tolerance &
    abs(rgb[, , 3] - target[3]) <= tolerance
  sum(mask)
}

test_that("metadata de graficadores expone controles claros y sin duplicados", {
  ui_tipo_input_soportado <- c(
    "variable", "variable_opt", "variables_list", "string", "textarea",
    "number", "bool", "choice", "codigos_list", "multiflag", "color",
    "series_colors", "criteria_config", "technical_rows", "icono", "overrides", "filtros",
    # `base_labels` dibuja una caja por base del estudio. Existe porque pedirle
    # al analista que escriba «clave=Titulo» por linea le traslada un detalle de
    # serializacion: la aplicacion ya sabe cuantas bases hay y como se llaman.
    "base_labels",
    "base_config", "meta",
    # Cuatro controles que reemplazaron a un campo de texto libre. La lista
    # quedó atrás cuando llegaron, así que este contrato estaba en rojo desde
    # entonces: el registro servía tipos que la lista no reconocía aunque la UI
    # sí los pinta.
    #   `iconos_list`      — una ranura por foco, contra el catálogo de íconos
    #   `colores_list`     — muestra de color por foco, no HEX tecleado
    #   `orden_categorias` — filas que se suben y bajan, como los slides
    #   `categorias_escala`— marcar categorías sobre las escalas reales
    "iconos_list", "colores_list", "orden_categorias", "categorias_escala"
  )
  ui_grupo_soportado <- c(
    "datos", "lectura", "valores", "leyenda", "espacio", "tabla",
    "diagnostico", "textos", "estilo", "filtro", "semaforo", "canvas",
    "avanzado"
  )

  slide_args <- unlist(lapply(.SLIDES_META, `[[`, "args"), recursive = FALSE)
  graf_args <- unlist(lapply(.GRAFICADORES_META, `[[`, "args"), recursive = FALSE)
  preset_args <- unlist(lapply(.PRESETS_META, `[[`, "args"), recursive = FALSE)
  all_args <- c(slide_args, graf_args, preset_args)
  all_args <- all_args[vapply(all_args, is.list, logical(1))]
  get_arg_field <- function(arg, field) {
    value <- arg[[field]]
    if (is.null(value)) "" else as.character(value[[1]])
  }

  expect_equal(
    setdiff(unique(vapply(all_args, get_arg_field, character(1), field = "tipo_input")), ui_tipo_input_soportado),
    character(0)
  )
  expect_equal(
    setdiff(unique(vapply(all_args, get_arg_field, character(1), field = "grupo")), ui_grupo_soportado),
    character(0)
  )

  payload <- .presets_metadata_payload()
  presets <- stats::setNames(payload$presets, vapply(payload$presets, `[[`, character(1), "name"))

  apiladas <- presets$barras_apiladas$args
  names_apiladas <- vapply(apiladas, `[[`, character(1), "name")
  by_name <- stats::setNames(apiladas, names_apiladas)

  expect_false("exportar" %in% names_apiladas)
  expect_false("wrap_y" %in% names_apiladas)
  expect_equal(by_name$canvas_w_etiquetas$grupo, "espacio")
  expect_equal(by_name$canvas_w_etiquetas$label, "Espacio para etiquetas")
  expect_equal(by_name$ancho_max_eje_y$label, "Ancho de texto de etiquetas")
  expect_equal(by_name$leyenda_posicion$grupo, "leyenda")
  expect_match(by_name$leyenda_posicion$label, "leyenda")

  agrupadas <- presets$barras_agrupadas$args
	  by_name_agr <- stats::setNames(agrupadas, vapply(agrupadas, `[[`, character(1), "name"))
	  expect_equal(by_name_agr$mostrar_ceros$tipo_input, "bool")
	  expect_false(isTRUE(by_name_agr$mostrar_ceros$default))
	  expect_equal(by_name_agr$orden_barras$tipo_input, "choice")
	  expect_equal(by_name_agr$orden_barras$default, "instrumento")
  expect_equal(by_name_agr$orden_barras$choices[[1]]$label, "Orden del instrumento")
  expect_equal(by_name_agr$otros_al_final$default, TRUE)
  expect_equal(by_name_agr$max_categorias$default, 12)
	  expect_equal(by_name_agr$agrupar_resto_en_otros$default, TRUE)
	  expect_match(by_name_agr$umbral_posicion$label, "etiquetas pequeñas")
	  expect_equal(by_name_agr$excluir_opciones$tipo_input, "codigos_list")
  expect_equal(by_name_agr$lineheight_eje_y$label, "Interlineado de etiquetas")
  expect_equal(by_name_agr$lineheight_eje_y$grupo, "espacio")
  expect_equal(by_name_agr$lineheight_eje_y$step, 0.05)
  expect_equal(by_name_agr$normalizar_etiquetas$tipo_input, "choice")
  expect_equal(by_name_agr$normalizar_etiquetas$grupo, "lectura")
  expect_true("mayuscula_inicial" %in% vapply(by_name_agr$normalizar_etiquetas$choices, `[[`, character(1), "value"))

  expect_true("barras_categoricas" %in% names(presets))
  cat <- presets$barras_categoricas$args
  by_name_cat <- stats::setNames(cat, vapply(cat, `[[`, character(1), "name"))
  expect_equal(by_name_cat$max_categorias$default, 10)
  expect_equal(by_name_cat$max_categorias$max, 10)
  expect_equal(by_name_cat$colores_categorias$tipo_input, "series_colors")
  expect_equal(by_name_cat$mostrar_promedio$tipo_input, "bool")
  expect_false(isTRUE(by_name_cat$mostrar_promedio$default))
  expect_equal(by_name_cat$formato_valor$tipo_input, "choice")
  expect_true("porcentaje_n" %in% vapply(by_name_cat$formato_valor$choices, `[[`, character(1), "value"))
  expect_equal(by_name_cat$grosor_barras$grupo, "espacio")
  expect_equal(by_name_cat$size_ejes$default, 16)
  expect_equal(by_name_cat$size_texto_barras$default, 5.6)
  expect_false(isTRUE(by_name_cat$mostrar_eje_y$default))
  expect_false(isTRUE(by_name_cat$mostrar_linea_eje_x$default))
  expect_false(isTRUE(by_name_cat$mostrar_linea_eje_y$default))
  expect_false(isTRUE(by_name_cat$mostrar_grid_y$default))
  expect_equal(by_name_cat$ancho_max_eje_x$default, 18)

  expect_true("histograma" %in% names(presets))
  hist <- presets$histograma$args
  by_name_hist <- stats::setNames(hist, vapply(hist, `[[`, character(1), "name"))
  expect_equal(by_name_hist$modo$tipo_input, "choice")
  expect_true("porcentaje_bin" %in% vapply(by_name_hist$modo$choices, `[[`, character(1), "value"))
  expect_equal(by_name_hist$mostrar_frecuencia$grupo, "valores")
  expect_equal(by_name_hist$posicion_etiquetas$tipo_input, "choice")
  expect_true("cima" %in% vapply(by_name_hist$posicion_etiquetas$choices, `[[`, character(1), "value"))
  hist_top_modes <- vapply(by_name_hist$etiqueta_cima_modo$choices, `[[`, character(1), "value")
  expect_true("porcentaje_conteos_grupo" %in% hist_top_modes)
  expect_true("porcentaje_grupo_conteos_grupo" %in% hist_top_modes)
  expect_equal(by_name_hist$etiqueta_cima_formato$tipo_input, "choice")
  expect_equal(by_name_hist$etiqueta_cima_orden_grupo$tipo_input, "choice")
  expect_equal(by_name_hist$abreviaturas_grupos$tipo_input, "codigos_list")
  expect_equal(by_name_hist$mostrar_resumen_grupos_subtitulo$tipo_input, "bool")
  expect_equal(by_name_hist$mostrar_resumen_grupos_subtitulo$grupo, "valores")
  expect_equal(by_name_hist$prefijo_resumen_grupos_subtitulo$tipo_input, "string")
  expect_equal(by_name_hist$separador_resumen_grupos_subtitulo$tipo_input, "string")
  expect_equal(by_name_hist$pos_y_subtitulo$tipo_input, "number")
  expect_equal(by_name_hist$pos_y_subtitulo$grupo, "lectura")
  expect_equal(by_name_hist$orden_grupos$tipo_input, "codigos_list")
  expect_equal(by_name_hist$mostrar_bins_vacios$tipo_input, "bool")
  expect_equal(by_name_hist$legend_key_cm$grupo, "leyenda")

  expect_true("nube_palabras" %in% names(presets))
  nube <- presets$nube_palabras$args
  by_name_nube <- stats::setNames(nube, vapply(nube, `[[`, character(1), "name"))
  expect_equal(by_name_nube$max_palabras$default, 40)
  expect_equal(by_name_nube$min_chars$default, 3)

  registry <- .graficos_registry_payload()
  grafs <- stats::setNames(registry$graficadores, vapply(registry$graficadores, `[[`, character(1), "name"))
  args_agr <- grafs$p_barras_agrupadas$args
  by_name_graf_agr <- stats::setNames(args_agr, vapply(args_agr, `[[`, character(1), "name"))
  expect_equal(by_name_graf_agr$mostrar_ceros$tipo_input, "bool")
  expect_false(isTRUE(by_name_graf_agr$mostrar_ceros$default))
  expect_equal(by_name_graf_agr$orden_barras$tipo_input, "choice")
  expect_equal(by_name_graf_agr$orden_barras$default, "instrumento")
  expect_equal(by_name_graf_agr$max_categorias$default, 12)
  expect_equal(by_name_graf_agr$canvas_w_etiquetas$label, "Espacio para etiquetas")
  expect_equal(by_name_graf_agr$normalizar_etiquetas$tipo_input, "choice")
  expect_true("p_barras_categoricas" %in% names(grafs))
  args_cat <- grafs$p_barras_categoricas$args
  by_name_graf_cat <- stats::setNames(args_cat, vapply(args_cat, `[[`, character(1), "name"))
  expect_equal(by_name_graf_cat$var$tipo_input, "variable")
  expect_equal(by_name_graf_cat$max_categorias$max, 10)
  expect_equal(by_name_graf_cat$colores_categorias$tipo_input, "series_colors")
  expect_true("p_nube_palabras" %in% names(grafs))
  expect_equal(
    stats::setNames(grafs$p_nube_palabras$args, vapply(grafs$p_nube_palabras$args, `[[`, character(1), "name"))$var$tipo_input,
    "variable"
  )

  indice_args <- .SLIDES_META$p_slide_indice$args
  by_name_indice <- stats::setNames(indice_args, vapply(indice_args, `[[`, character(1), "name"))
  expect_equal(by_name_indice$titulo$label, "Título")
  expect_equal(by_name_indice$secciones$tipo_input, "textarea")
  expect_match(by_name_indice$secciones$descripcion, "Una sección por línea", fixed = TRUE)
  expect_equal(by_name_indice$subtemas$tipo_input, "textarea")
  expect_equal(by_name_indice$subindices$label, "Subíndices por sección")
  expect_equal(by_name_indice$subindices$tipo_input, "textarea")
  expect_equal(by_name_indice$iconos_focos$label, "Íconos de los focos")
  # Ya no se teclean rutas SVG/PNG a mano: cada foco elige del catálogo de
  # íconos de Configuración global.
  expect_equal(by_name_indice$iconos_focos$tipo_input, "iconos_list")
  expect_equal(by_name_indice$iconos_focos$grupo, "espacio")
  expect_equal(by_name_indice$redibujar_focos$label, "Redibujar focos desde cero")
  expect_equal(by_name_indice$redibujar_focos$tipo_input, "bool")
  expect_equal(by_name_indice$redibujar_focos$grupo, "espacio")
  expect_false(isTRUE(by_name_indice$redibujar_focos$default))
  expect_equal(by_name_indice$mostrar_iconos_focos$tipo_input, "bool")
  # «Colores de focos» era un campo de texto anunciado como HEX cuyo ejemplo
  # («88, 90, 96») no era HEX. Ahora es una muestra de color por foco.
  expect_equal(by_name_indice$iconos_focos_fill$tipo_input, "colores_list")
  expect_equal(by_name_indice$iconos_focos_fill$grupo, "valores")
  expect_equal(by_name_indice$iconos_focos_objeto_unico$label, "Mover círculo e ícono juntos")
  expect_equal(by_name_indice$iconos_focos_objeto_unico$tipo_input, "bool")
  expect_true(isTRUE(by_name_indice$iconos_focos_objeto_unico$default))
  expect_equal(by_name_indice$iconos_focos_diametro_cm$tipo_input, "number")
  expect_equal(by_name_indice$iconos_focos_diametro_cm$default, 2.18)
  expect_equal(by_name_indice$iconos_focos_diametro_cm$step, 0.01)
  expect_equal(by_name_indice$iconos_focos_icon_scale$tipo_input, "number")
  expect_equal(by_name_indice$iconos_focos_icon_scale$default, 0.76)
  expect_false("iconos_focos_left_cm" %in% names(by_name_indice))
  expect_false("iconos_focos_top_cm" %in% names(by_name_indice))
  expect_equal(by_name_indice$subtopic_badge_fill$label, "Color de numeración de subíndices")
  expect_equal(by_name_indice$subtopic_badge_fill$tipo_input, "color")
  expect_equal(by_name_indice$subtopic_badge_fill$grupo, "lectura")
  expect_equal(by_name_indice$subtopic_badge_width$tipo_input, "number")
  expect_equal(by_name_indice$subtopic_badge_width$grupo, "espacio")
  expect_equal(by_name_indice$subtopic_badge_width$default, 0.26)
  expect_equal(by_name_indice$subtopic_badge_gap$default, 0.13)
  expect_equal(by_name_indice$subtopic_badge_gap$step, 0.01)
  expect_equal(by_name_indice$estilo$tipo_input, "meta")
  expect_equal(by_name_indice$estilo$grupo, "diagnostico")

  top_two_args <- .SLIDES_META$p_slide_top_two_box$args
  by_name_top_two <- stats::setNames(top_two_args, vapply(top_two_args, `[[`, character(1), "name"))
  expect_equal(.SLIDES_META$p_slide_top_two_box$titulo_humano, "Explicación Top Two Box")
  expect_equal(by_name_top_two$valores$label, "Porcentajes de ejemplo")
  expect_equal(by_name_top_two$valores$default, "5, 5, 35, 55")
  expect_equal(by_name_top_two$top_two_indices$grupo, "valores")
  expect_equal(by_name_top_two$extremo_izquierda$grupo, "textos")
  expect_equal(by_name_top_two$accent_color$label, "Color de acento")
  expect_equal(by_name_top_two$accent_color$tipo_input, "color")
  expect_equal(by_name_top_two$accent_color$grupo, "valores")
  expect_equal(by_name_top_two$colores$label, "Paleta de la escala")
  expect_equal(by_name_top_two$colores$grupo, "valores")
  expect_equal(by_name_top_two$colores$default, "#D8504F, #FFD966, #B7D7A8, #70AD47")
  expect_equal(by_name_top_two$grosor_barra$label, "Grosor de la barra")
  expect_equal(by_name_top_two$grosor_barra$tipo_input, "number")
  expect_equal(by_name_top_two$grosor_barra$grupo, "espacio")
  expect_equal(by_name_top_two$grosor_barra$default, 82)
  expect_equal(by_name_top_two$grosor_barra$min, 30)
  expect_equal(by_name_top_two$grosor_barra$max, 130)
  expect_equal(by_name_top_two$size_texto_porcentajes$label, "Tamaño de porcentajes")
  expect_equal(by_name_top_two$size_texto_porcentajes$tipo_input, "number")
  expect_equal(by_name_top_two$size_texto_porcentajes$grupo, "lectura")
  expect_equal(by_name_top_two$size_texto_porcentajes$default, 22)
  expect_equal(by_name_top_two$size_texto_porcentajes$min, 8)
  expect_equal(by_name_top_two$size_texto_porcentajes$max, 42)
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$label, "Tamaño de porcentajes pequeños")
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$tipo_input, "number")
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$grupo, "lectura")
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$default, 16)
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$min, 8)
  expect_equal(by_name_top_two$size_texto_porcentajes_peq$max, 32)
  expect_equal(by_name_top_two$color_texto_porcentajes$label, "Color de porcentajes")
  expect_equal(by_name_top_two$color_texto_porcentajes$tipo_input, "color")
  expect_equal(by_name_top_two$color_texto_porcentajes$grupo, "lectura")
  expect_equal(by_name_top_two$color_texto_porcentajes$default, "#FFFFFF")
  expect_equal(by_name_top_two$margen_llave$label, "Margen de la llave")
  expect_equal(by_name_top_two$margen_llave$tipo_input, "number")
  expect_equal(by_name_top_two$margen_llave$grupo, "espacio")
  expect_equal(by_name_top_two$margen_llave$default, 4)
  expect_equal(by_name_top_two$grosor_flecha$label, "Grosor de la flecha")
  expect_equal(by_name_top_two$grosor_flecha$tipo_input, "number")
  expect_equal(by_name_top_two$grosor_flecha$grupo, "espacio")
  expect_equal(by_name_top_two$grosor_flecha$default, 3.6)
  expect_equal(by_name_top_two$estilo$tipo_input, "meta")
  expect_equal(by_name_top_two$estilo$grupo, "diagnostico")
})

test_that("normalizador de etiquetas de barras agrupadas soporta mayuscula inicial", {
  expect_equal(
    .barras_agrupadas_normalizar_etiquetas(
      c("SUPERVISOR DE MANTENIMIENTO", "¿QUÉ ACTIVIDADES REALIZA?", NA_character_),
      "mayuscula_inicial"
    ),
    c("Supervisor de mantenimiento", "¿Qué actividades realiza?", NA_character_)
  )
  expect_equal(
    .barras_agrupadas_normalizar_etiquetas("TEXTO ORIGINAL", "ninguna"),
    "TEXTO ORIGINAL"
  )
  expect_equal(
    .barras_agrupadas_normalizacion_modo("sin cambio"),
    "ninguna"
  )
})

test_that("barras categoricas grafican pocas categorias con color propio y promedio opcional", {
  df <- data.frame(
    categoria = c("Poco coherente", "Coherente", "Muy coherente"),
    valor = c(1, 2, 4),
    n = c(4, 8, 16),
    stringsAsFactors = FALSE
  )

  p <- graficar_barras_categoricas(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    var_n = "n",
    formato_valor = "valor_n",
    mostrar_frecuencia = TRUE,
    mostrar_promedio = TRUE,
    promedio = 3.1,
    promedio_maximo = 4,
    colores_categorias = c(
      "Poco coherente" = "#CA5651",
      "Coherente" = "#EFD25E",
      "Muy coherente" = "#70AD47"
    )
  )

  datos <- attr(p, "pulso_barras_categoricas_data")
  expect_equal(nrow(datos), 3)
  expect_equal(datos$fill, c("#CA5651", "#EFD25E", "#70AD47"))
  expect_equal(attr(p, "pulso_barras_categoricas_promedio"), 3.1)
  expect_match(ggplot2::ggplot_build(p)$plot$labels$caption, "Promedio: 3.1 / 4.0", fixed = TRUE)
  expect_s3_class(ggplot2::ggplot_build(p)$plot$theme$axis.text.y, "element_blank")
  expect_s3_class(ggplot2::ggplot_build(p)$plot$theme$axis.line.x, "element_blank")
  expect_s3_class(ggplot2::ggplot_build(p)$plot$theme$axis.line.y, "element_blank")

  df_many <- data.frame(categoria = paste0("C", 1:11), valor = 1:11)
  expect_error(
    graficar_barras_categoricas(df_many, "categoria", "valor", max_categorias = 10),
    "admite hasta 10 categorias"
  )
})

test_that("barras agrupadas respetan orden, Otros al final y maximo de categorias", {
  df_order <- data.frame(
    categoria = c("A", "Otros", "B", "C"),
    N = c(10, 80, 30, 20),
    pct = c(0.10, 0.80, 0.30, 0.20),
    stringsAsFactors = FALSE
  )

  p_instr <- graficar_barras_agrupadas(
    data = df_order,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    orden_barras = "instrumento",
    otros_al_final = TRUE,
    mostrar_barra_extra = FALSE
  )
  expect_equal(levels(p_instr$data$categoria), c("A", "B", "C", "Otros"))

  p_freq <- graficar_barras_agrupadas(
    data = df_order,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    orden_barras = "mayor_menor",
    otros_al_final = TRUE,
    mostrar_barra_extra = FALSE
  )
  expect_equal(levels(p_freq$data$categoria), c("B", "C", "A", "Otros"))

  df_many <- data.frame(
    categoria = paste0("C", 1:12),
    N = rep(1, 12),
    pct = seq(0.12, 0.01, length.out = 12),
    stringsAsFactors = FALSE
  )
  p_limited <- graficar_barras_agrupadas(
    data = df_many,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    max_categorias = 5,
    agrupar_resto_en_otros = TRUE,
    orden_barras = "mayor_menor",
    otros_al_final = TRUE,
    mostrar_barra_extra = FALSE
  )
  expect_equal(levels(p_limited$data$categoria), c("C1", "C2", "C3", "C4", "Otros"))
  expect_equal(unique(p_limited$data$N[p_limited$data$categoria == "Otros"]), 8)
  expect_equal(unique(p_limited$data$.valor[p_limited$data$categoria == "Otros"]), sum(df_many$pct[5:12]))
})

test_that("barras agrupadas envian no-respuesta/no-aplica al final", {
  df <- data.frame(
    categoria = c(
      "A",
      "Prefiero no responder",
      "B",
      "No he trabajado",
      "C"
    ),
    N = c(10, 35, 25, 5, 15),
    pct = c(0.10, 0.35, 0.25, 0.05, 0.15),
    stringsAsFactors = FALSE
  )

  p <- graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    orden_barras = "mayor_menor",
    otros_al_final = TRUE,
    mostrar_barra_extra = FALSE
  )

  expect_equal(
    levels(p$data$categoria),
    c("B", "C", "A", "Prefiero no responder", "No he trabajado")
  )
})

test_that("barras agrupadas preservan no-respuesta al limitar categorias", {
  df <- data.frame(
    categoria = c(
      paste0("C", 1:8),
      "Prefiero no responder",
      "No he trabajado"
    ),
    N = rep(1, 10),
    pct = c(0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08, 0.06, 0.04, 0.02),
    stringsAsFactors = FALSE
  )

  p <- graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    max_categorias = 5,
    agrupar_resto_en_otros = TRUE,
    orden_barras = "mayor_menor",
    otros_al_final = TRUE,
    mostrar_barra_extra = FALSE
  )

  expect_equal(
    levels(p$data$categoria),
    c("C1", "C2", "Prefiero no responder", "No he trabajado", "Otros")
  )
  expect_true("Prefiero no responder" %in% as.character(p$data$categoria))
  expect_true("No he trabajado" %in% as.character(p$data$categoria))
})

test_that("barras agrupadas mantienen etiquetas pequenas visibles fuera si no caben", {
  df <- data.frame(
    categoria = c("Minimo", "Medio"),
    N = c(100, 100),
    pct = c(0.01, 0.10),
    stringsAsFactors = FALSE
  )

  p <- graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    mostrar_valores = TRUE,
    mostrar_barra_extra = FALSE,
    umbral_etiqueta = 0.001,
    umbral_posicion = 0.07
  )

  text_layers <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)
  value_layer <- text_layers[[1]]
  row_min <- value_layer$data[value_layer$data$lab == "1%", , drop = FALSE]
  expect_equal(nrow(row_min), 1)
  expect_false(row_min$inside)
  expect_gt(row_min$valor_label, row_min$.valor_plot)
  expect_equal(row_min$col_label, "#081F5C")
})

test_that("paletas configuradas llegan al ambiente y pintan barras apiladas", {
  skip_if_not_installed("png")

  palette_env <- .graficos_palette_env(list(
    lst_respuesta = list(
      "Nada util 1" = "#C1121F",
      "2" = "#2A9D8F",
      "3" = "#F4A261"
    ),
    lst_vacia = list("Sin color" = "")
  ), parent = emptyenv())

  expect_true(exists("paleta_lst_respuesta", envir = palette_env, inherits = FALSE))
  expect_false(exists("paleta_lst_vacia", envir = palette_env, inherits = FALSE))

  paleta <- get("paleta_lst_respuesta", envir = palette_env, inherits = FALSE)
  expect_equal(names(paleta), c("Nada util 1", "2", "3"))
  expect_equal(unname(paleta), c("#C1121F", "#2A9D8F", "#F4A261"))

  out <- tempfile(fileext = ".png")
  .render_apiladas_args_ui(
    .fixture_apiladas_args_ui(),
    out,
    colores_grupos = paleta,
    canvas_w_etiquetas = 0.28
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("paletas sugeridas incluyen listas de todas las fuentes", {
  inst_a <- list(
    choices = data.frame(
      list_name = c("lst_a", "lst_a", "lst_compartida"),
      name = c("1", "2", "1"),
      label = c("A uno", "A dos", "Compartida uno"),
      stringsAsFactors = FALSE
    )
  )
  inst_b <- list(
    choices = data.frame(
      list_name = c("lst_b", "lst_b", "lst_compartida"),
      name = c("1", "2", "1"),
      label = c("B uno", "B dos", "Compartida uno"),
      stringsAsFactors = FALSE
    )
  )

  listas <- .graficos_collect_palette_lists(list(base_a = inst_a, base_b = inst_b))
  by_name <- stats::setNames(listas, vapply(listas, `[[`, character(1), "list_name"))

  expect_true(all(c("lst_a", "lst_b", "lst_compartida") %in% names(by_name)))
  expect_equal(vapply(by_name$lst_b$choices, `[[`, character(1), "label"), c("B uno", "B dos"))
  expect_equal(length(by_name$lst_compartida$choices), 1L)
})

test_that("paletas configuradas pintan barras agrupadas simples por categoria", {
  skip_if_not_installed("png")

  paleta <- c(
    "Nada util 1" = "#C1121F",
    "2" = "#2A9D8F",
    "3" = "#F4A261"
  )

  out <- tempfile(fileext = ".png")
  .render_agrupadas_args_ui(
    .fixture_agrupadas_args_ui(),
    out,
    colores_categorias = paleta,
    canvas_w_etiquetas = 0.28
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("paletas configuradas pintan barras numericas simples por categoria", {
  skip_if_not_installed("png")

  paleta <- c(
    "Grupo A" = "#C1121F",
    "Grupo B" = "#2A9D8F",
    "Grupo C" = "#F4A261"
  )

  out <- tempfile(fileext = ".png")
  .render_numericas_args_ui(
    .fixture_numericas_args_ui(),
    out,
    colores_categorias = paleta
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("Word aplica el preset apilado institucional por defecto", {
  wp <- w_presets()
  applied <- .apply_word_chart_presets(NULL, wp)
  apiladas <- applied$barras_apiladas$args

  expect_equal(as.numeric(apiladas$grosor_barras_mult), 1.5)
  expect_false(isTRUE(apiladas$mostrar_barra_extra))
  expect_equal(as.numeric(apiladas$canvas_w_extra), 0)
  expect_equal(as.numeric(apiladas$canvas_w_bars), 0.82)
  # B52/W-1: leyenda a 8 pt (6 era ilegible en 6.1in) y key 0.18; ademas la
  # etiqueta chica espeja a la normal para que el editorial 5.6 no gobierne.
  expect_equal(as.numeric(apiladas$legend_key_cm), 0.18)
  expect_equal(as.integer(apiladas$legend_n_por_fila), 10L)
  expect_equal(as.numeric(apiladas$legend_espaciado), 0)
  expect_equal(as.numeric(apiladas$size_leyenda), 8)
  expect_equal(as.numeric(apiladas$size_texto_barras_peq), as.numeric(apiladas$size_texto_barras))
  expect_equal(as.numeric(apiladas$canvas_h_legend_in), 0.42)
  expect_equal(as.numeric(apiladas$centro_cowplot), 0.5)

  applied_with_override <- .apply_word_chart_presets(
    presets_ppt = list(
      barras_apiladas = list(
        args = list(
          grosor_barras_mult = 0.72,
          grosor_modo = "manual"
        )
      )
    ),
    presets_word = wp
  )
  expect_equal(applied_with_override$barras_apiladas$args$grosor_barras_mult, 1.5)
  expect_equal(applied_with_override$barras_apiladas$args$grosor_modo, "manual")

  applied_with_chart_preset <- .apply_word_chart_presets(
    presets_ppt = NULL,
    presets_word = w_presets(chart_presets = list(
      barras_apiladas = list(grosor_barras_mult = 1.25)
    ))
  )
  expect_equal(
    applied_with_chart_preset$barras_apiladas$args$grosor_barras_mult,
    1.25
  )
  expect_equal(
    applied_with_chart_preset$barras_apiladas$args$legend_n_por_fila,
    10
  )
})

test_that("build_w_presets resuelve la funcion aunque exista un objeto con el mismo nombre", {
  w_presets <- list(image = list(width_in = 9))
  built <- .build_w_presets(list(image = list(width_in = 7.25)))

  expect_s3_class(built, "word_presets")
  expect_equal(built$image$width_in, 7.25)
  expect_equal(built$image$height_in, 3.9)
  expect_equal(built$chart_presets$barras_apiladas$legend_n_por_fila, 10)
})

test_that("config de graficos expone defaults Word aunque w_presets venga vacio", {
  cfg <- .graficos_normalize_config(list(w_presets = list()))

  expect_equal(cfg$w_presets$chart_options$ocultar_etiqueta_si_titulo, TRUE)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$legend_n_por_fila, 10)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$canvas_w_bars, 0.82)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$legend_key_cm, 0.18)
  expect_false(isTRUE(cfg$w_presets$chart_presets$barras_apiladas$mostrar_barra_extra))

  custom <- .graficos_normalize_config(list(
    w_presets = list(chart_presets = list(
      barras_apiladas = list(size_leyenda = 7.5)
    ))
  ))
  expect_equal(custom$w_presets$chart_presets$barras_apiladas$size_leyenda, 7.5)
  expect_equal(custom$w_presets$chart_presets$barras_apiladas$legend_n_por_fila, 10)
})

test_that("config de graficos serializa paletas como mapas por etiqueta", {
  cfg <- .graficos_normalize_config(list(
    paletas = list(
      acuerdo = c(
        "Totalmente en desacuerdo" = "#C0392B",
        "En desacuerdo" = "#E67E22"
      )
    )
  ))

  expect_type(cfg$paletas$acuerdo, "list")
  expect_equal(cfg$paletas$acuerdo[["Totalmente en desacuerdo"]], "#C0392B")
  json <- jsonlite::toJSON(list(paletas = cfg$paletas), auto_unbox = TRUE)
  expect_match(as.character(json), '"Totalmente en desacuerdo":"#C0392B"', fixed = TRUE)
})

test_that("p_presets acepta media_rango y Word preserva sus overrides", {
  expect_warning(
    presets <- p_presets(media_rango = list(size_media = 4)),
    NA
  )
  expect_equal(presets$media_rango$args$size_media, 4)

  applied <- .apply_word_chart_presets(
    presets_ppt = presets,
    presets_word = w_presets(chart_presets = list(
      media_rango = list(size_delta = 2.5)
    ))
  )

  expect_equal(applied$media_rango$args$size_media, 4)
  expect_equal(applied$media_rango$args$size_delta, 2.5)
})

test_that("preset Pulso deja la barra extra configurable y con defaults neutros", {
  payload <- .presets_metadata_payload()
  presets <- stats::setNames(payload$presets, vapply(payload$presets, `[[`, character(1), "name"))

  apiladas_names <- vapply(presets$barras_apiladas$args, `[[`, character(1), "name")
  multi_names <- vapply(presets$multi_apiladas$args, `[[`, character(1), "name")
  agrupadas_names <- vapply(presets$barras_agrupadas$args, `[[`, character(1), "name")

  expect_true("barra_extra_preset" %in% apiladas_names)
  expect_true("titulo_barra_extra" %in% apiladas_names)
  expect_true("prefijo_barra_extra" %in% apiladas_names)
  expect_true("etiquetas_arriba_si_no_caben" %in% apiladas_names)
  expect_true("mostrar_n_en_etiquetas" %in% apiladas_names)
  expect_true("color_conectores_etiquetas" %in% apiladas_names)
  expect_true("posicion_conector_etiquetas" %in% apiladas_names)
  expect_true("linewidth_conectores_etiquetas" %in% apiladas_names)
  expect_true("barra_extra_preset" %in% multi_names)
  expect_true("titulo_barra_extra" %in% multi_names)
  expect_true("etiquetas_arriba_si_no_caben" %in% multi_names)
  expect_true("mostrar_n_en_etiquetas" %in% multi_names)
  expect_true("color_conectores_etiquetas" %in% multi_names)
  expect_true("posicion_conector_etiquetas" %in% multi_names)
  expect_true("linewidth_conectores_etiquetas" %in% multi_names)
  expect_true("legend_gap_npc" %in% multi_names)
  expect_true("grosor_barras" %in% multi_names)
  expect_true("titulo_barra_extra" %in% agrupadas_names)
  expect_true("mostrar_n_en_etiquetas" %in% agrupadas_names)
  expect_true("grosor_barras" %in% agrupadas_names)

  apiladas_args <- stats::setNames(presets$barras_apiladas$args, apiladas_names)
  multi_args <- stats::setNames(presets$multi_apiladas$args, multi_names)

  expect_equal(apiladas_args$etiquetas_arriba_si_no_caben$label, "Subir porcentajes que no caben")
  expect_equal(apiladas_args$etiquetas_arriba_offset$label, "Distancia sobre la barra")
  expect_equal(apiladas_args$color_conectores_etiquetas$label, "Color de la línea guía")
  expect_equal(apiladas_args$color_conectores_etiquetas$grupo, "valores")
  expect_equal(
    vapply(apiladas_args$color_conectores_etiquetas$choices, `[[`, character(1), "value"),
    c("segmento", "azul_pulso")
  )
  expect_equal(apiladas_args$posicion_conector_etiquetas$label, "Salida de la línea guía")
  expect_equal(apiladas_args$posicion_conector_etiquetas$grupo, "valores")
  expect_equal(
    vapply(apiladas_args$posicion_conector_etiquetas$choices, `[[`, character(1), "value"),
    c("centro", "izquierda", "derecha")
  )
  expect_equal(apiladas_args$linewidth_conectores_etiquetas$label, "Grosor de la línea guía")
  expect_equal(apiladas_args$linewidth_conectores_etiquetas$min, 0.1)
  expect_equal(apiladas_args$linewidth_conectores_etiquetas$max, 2)
  expect_equal(apiladas_args$linewidth_conectores_etiquetas$step, 0.05)
  expect_equal(apiladas_args$mostrar_n_en_etiquetas$label, "Mostrar frecuencia en porcentajes")
  expect_equal(apiladas_args$grosor_barras$grupo, "espacio")
  expect_equal(apiladas_args$legend_key_cm$label, "Tamaño del marcador")
  expect_equal(apiladas_args$legend_gap_npc$grupo, "leyenda")

  expect_equal(multi_args$color_conectores_etiquetas$label, "Color de la línea guía")
  expect_equal(multi_args$color_conectores_etiquetas$grupo, "valores")
  expect_equal(
    vapply(multi_args$color_conectores_etiquetas$choices, `[[`, character(1), "value"),
    c("segmento", "azul_pulso")
  )
  expect_equal(multi_args$posicion_conector_etiquetas$label, "Salida de la línea guía")
  expect_equal(multi_args$posicion_conector_etiquetas$grupo, "valores")
  expect_equal(
    vapply(multi_args$posicion_conector_etiquetas$choices, `[[`, character(1), "value"),
    c("centro", "izquierda", "derecha")
  )
  expect_equal(multi_args$linewidth_conectores_etiquetas$min, 0.1)
  expect_equal(multi_args$linewidth_conectores_etiquetas$max, 2)
  expect_equal(multi_args$linewidth_conectores_etiquetas$step, 0.05)
  expect_equal(multi_args$grosor_barras$grupo, "espacio")

  expect_identical(.PRESETS_DEFAULT_PULSO$barras_apiladas$prefijo_barra_extra, "")
  expect_identical(.PRESETS_DEFAULT_PULSO$barras_agrupadas$prefijo_barra_extra, "")
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_agrupadas$canvas_w_etiquetas, 0.45)
  expect_false(isTRUE(.PRESETS_DEFAULT_PULSO$barras_agrupadas$mostrar_ceros))
  expect_false(isTRUE(.PRESETS_DEFAULT_PULSO$barras_agrupadas$usar_eje_libre))
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_agrupadas$canvas_min_filas, 7)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_agrupadas$face_subtitulo, "bold")
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_agrupadas$size_subtitulo, 13)
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_agrupadas$encabezado_separacion_in, 0.18)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$color_barra_extra, .PULSO_PPT_COLORS$verde_top2)
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$color_barra_extra, .PULSO_PPT_COLORS$verde_top2)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$size_texto_barras, 5.6)
  expect_equal(
    .PRESETS_DEFAULT_PULSO$multi_apiladas$size_texto_barras,
    .PRESETS_DEFAULT_PULSO$barras_apiladas$size_texto_barras
  )
  expect_equal(
    .PRESETS_DEFAULT_PULSO$multi_apiladas$size_texto_barras_peq,
    .PRESETS_DEFAULT_PULSO$barras_apiladas$size_texto_barras_peq
  )
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_apiladas$size_leyenda, 16)
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_apiladas$size_barra_extra, 16)
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_apiladas$grosor_barras, 0.68)
  expect_gte(.PRESETS_DEFAULT_PULSO$barras_agrupadas$grosor_barras, 0.68)
  expect_equal(
    .PRESETS_DEFAULT_PULSO$multi_apiladas$grosor_barras,
    .PRESETS_DEFAULT_PULSO$barras_apiladas$grosor_barras
  )
  expect_lte(.PRESETS_DEFAULT_PULSO$barras_apiladas$legend_espaciado, 3)
  expect_lte(.PRESETS_DEFAULT_PULSO$barras_apiladas$legend_gap_npc, 0.012)
  expect_lte(.PRESETS_DEFAULT_PULSO$multi_apiladas$legend_espaciado, 3)
  expect_lte(.PRESETS_DEFAULT_PULSO$multi_apiladas$legend_gap_npc, 0.012)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$umbral_mostrar_etiqueta, 0.12)
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$umbral_mostrar_etiqueta, 0.12)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$etiquetas_peq_factor_ancho, 2.5)
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$etiquetas_peq_factor_ancho, 2.5)
  # B45 (pedido directo): sacar la etiqueta chica arriba de la barra con
  # conector es una opcion, no el default.
  expect_false(isTRUE(.PRESETS_DEFAULT_PULSO$barras_apiladas$etiquetas_arriba_si_no_caben))
  expect_false(isTRUE(.PRESETS_DEFAULT_PULSO$multi_apiladas$etiquetas_arriba_si_no_caben))
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$color_conectores_etiquetas, "segmento")
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$color_conectores_etiquetas, "segmento")
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$posicion_conector_etiquetas, "centro")
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$posicion_conector_etiquetas, "centro")
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$linewidth_conectores_etiquetas, 0.42)
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$linewidth_conectores_etiquetas, 0.42)
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$size_titulo_extra, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$size_titulo_extra, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$radar_tabla$titulo_tabla, "Top 2 Box")
})

test_that("preset Pulso PPT usa paleta y escala de texto institucional", {
  expect_equal(.PULSO_PPT_COLORS$azul, "#081F5C")
  expect_equal(.PULSO_PPT_COLORS$rojo, "#CA5651")
  expect_equal(.PULSO_PPT_COLORS$verde, "#85BB85")
  expect_equal(.PULSO_PPT_COLORS$verde_top2, "#70AD47")
  expect_equal(.PULSO_PPT_COLORS$amarillo, "#EFD25E")
  expect_equal(.PULSO_PPT_COLORS$gris, "#BFBFBF")

  expect_equal(.PRESETS_DEFAULT_PULSO$base$font_family, "Arial")
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_titulo, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_titulo_slide, 24)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_subtitulo, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_subtitulo_slide, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_cuerpo_slide, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_leyenda, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_ejes, 16)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$size_nota_pie, 14)
  expect_equal(.PRESETS_DEFAULT_PULSO$base$color_titulo, .PULSO_PPT_COLORS$rojo)
	  expect_equal(.PRESETS_DEFAULT_PULSO$base$color_subtitulo, .PULSO_PPT_COLORS$azul)
	  expect_equal(.PRESETS_DEFAULT_PULSO$base$color_leyenda, .PULSO_PPT_COLORS$azul)
	  expect_equal(.PRESETS_DEFAULT_PULSO$barras_numericas$colores_series$Media, .PULSO_PPT_COLORS$azul)
  expect_equal(.PRESETS_DEFAULT_PULSO$histograma$modo, "porcentaje_total")
  # Doctrina P29: un grafico cuyo indicador principal es el porcentaje muestra
  # SOLO el porcentaje; el conteo es opcional y se enciende desde la UI. En modo
  # `conteo` la etiqueta ya es la frecuencia y este arg no interviene.
  expect_false(isTRUE(.PRESETS_DEFAULT_PULSO$histograma$mostrar_frecuencia))
	  expect_equal(.PRESETS_DEFAULT_PULSO$radar_tabla$tabla_header_fill, .PULSO_PPT_COLORS$azul)

  # El recorrido de una escala de valoracion va de rojizo a verde, pasando por un
  # durazno. Antes terminaba en azul marino: es el color de la marca, no el de
  # «lo mejor», y rompia la lectura de un vistazo porque el ojo busca el verde.
  fallback <- .reporte_plan_pulso_palette_for_levels(c("1", "2", "3", "4"))
  expect_equal(unname(fallback), c("#CA5651", "#E4A34C", "#85BB85", "#4F8A3E"))

  choices <- data.frame(
    list_name = rep("likert", 2),
    name = c("1", "2"),
    label = c("Nada", "Mucho"),
    stringsAsFactors = FALSE
  )
  expect_equal(.reporte_plan_labels_for_levels("likert", c("1", "2"), choices), c("Nada", "Mucho"))
  expect_equal(.reporte_plan_legend_labels_for_levels("likert", c("1", "2"), choices), c("Nada", "Mucho"))
})

test_that("metadata principal no expone editores tecnicos JSON", {
  registry <- .graficos_registry_payload()
  exposed <- unlist(lapply(registry$graficadores, function(g) {
    vapply(g$args, function(a) as.character(a$tipo_input %||% ""), character(1))
  }), use.names = FALSE)

  expect_false(any(exposed %in% c("overrides", "filtros", "base_config", "meta")))
})

test_that("metadata numerica expone limites seguros para la UI", {
  collect_args <- function(items) {
    do.call(c, lapply(items, function(item) item$args %||% list()))
  }
  all_args <- c(
    collect_args(.presets_metadata_payload()$presets),
    collect_args(.graficos_registry_payload()$graficadores)
  )
  numeric_args <- Filter(function(arg) identical(as.character(arg$tipo_input %||% ""), "number"), all_args)

  expect_true(length(numeric_args) > 0)
  expect_false(any(vapply(numeric_args, function(arg) is.null(arg$step), logical(1))))

  decimals <- Filter(function(arg) as.character(arg$name %||% "") %in% c("decimales", "tabla_digits"), numeric_args)
  expect_true(length(decimals) > 0)
  for (arg in decimals) {
    expect_equal(arg$min, 0)
    expect_equal(arg$max, 4)
    expect_equal(arg$step, 1)
  }

  # Era `decimales_promedio`, que ningun graficador aceptaba: el arg real que
  # formatea la media del chip es `chip_decimales`.
  avg_decimals <- Filter(function(arg) identical(as.character(arg$name %||% ""), "chip_decimales"), numeric_args)
  expect_true(length(avg_decimals) > 0)
  for (arg in avg_decimals) {
    expect_equal(arg$min, 0)
    expect_equal(arg$max, 2)
    expect_equal(arg$step, 1)
  }
})

test_that("controles expuestos de leyenda llegan a los renderizadores canvas", {
		  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_apiladas)))
		  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_agrupadas)))
		  expect_true("orden_barras" %in% names(formals(graficar_barras_agrupadas)))
  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_numericas)))
  expect_true("grupo" %in% names(formals(graficar_histograma)))
  expect_true("modo" %in% names(formals(graficar_histograma)))
  expect_true("posicion_etiquetas" %in% names(formals(graficar_histograma)))
  expect_true("abreviaturas_grupos" %in% names(formals(graficar_histograma)))
  expect_true("mostrar_resumen_grupos_subtitulo" %in% names(formals(graficar_histograma)))
  expect_true("pos_y_subtitulo" %in% names(formals(graficar_histograma)))
	})

test_that("histograma apilado calcula proporciones por intervalo y total", {
  df <- data.frame(
    edad = c(25, 25, 26, 26, 27, 28, 28, 29),
    sexo = c("Hombre", "Mujer", "Hombre", "Mujer", "Hombre", "Hombre", "Mujer", "Mujer"),
    stringsAsFactors = FALSE
  )

  p_bin <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 2,
    modo = "porcentaje_bin",
    mostrar_valores = FALSE,
    usar_canvas = FALSE
  )
  d_bin <- attr(p_bin, "pulso_histograma_data")
  expect_true(all(c(".bin_label", ".grupo_label", "n", "pct_bin", ".valor") %in% names(d_bin)))
  bin_sums <- stats::aggregate(.valor ~ .bin_label, d_bin[d_bin$n_bin > 0, , drop = FALSE], sum)
  expect_equal(bin_sums$.valor, rep(1, nrow(bin_sums)), tolerance = 1e-8)
  expect_setequal(as.character(d_bin$.grupo_label), c("Hombre", "Mujer"))

  p_total <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 2,
    modo = "porcentaje_total",
    mostrar_valores = FALSE,
    usar_canvas = FALSE
  )
  d_total <- attr(p_total, "pulso_histograma_data")
  expect_equal(sum(d_total$.valor), 1, tolerance = 1e-8)

  p_top <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 2,
    modo = "porcentaje_total",
    posicion_etiquetas = "cima",
    abreviaturas_grupos = c("Hombre" = "H", "Mujer" = "M"),
    umbral_etiqueta = 0,
    usar_canvas = FALSE
  )
  built_labels <- unlist(lapply(ggplot2::ggplot_build(p_top)$data, function(x) {
    if ("label" %in% names(x)) x$label else character()
  }), use.names = FALSE)
  expect_true(any(grepl("H 2\\s+M 2", built_labels)))

  p_top_pct <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 1,
    modo = "porcentaje_total",
    posicion_etiquetas = "cima",
    etiqueta_cima_modo = "porcentaje_conteos_grupo",
    abreviaturas_grupos = c("Hombre" = "H", "Mujer" = "M"),
    umbral_etiqueta = 0,
    mostrar_bins_vacios = FALSE,
    usar_canvas = FALSE
  )
  d_top_pct <- attr(p_top_pct, "pulso_histograma_data")
  expect_true(all(unique(as.character(d_top_pct$.bin_label)) %in% as.character(25:29)))
  expect_false(any(grepl("-", unique(as.character(d_top_pct$.bin_label)), fixed = TRUE)))
  built_labels_pct <- unlist(lapply(ggplot2::ggplot_build(p_top_pct)$data, function(x) {
    if ("label" %in% names(x)) x$label else character()
  }), use.names = FALSE)
  expect_true(any(grepl("25% \\(2\\).*H 1\\s+M 1", built_labels_pct)))

  p_top_group_pct <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 1,
    modo = "porcentaje_total",
    posicion_etiquetas = "cima",
    etiqueta_cima_modo = "porcentaje_grupo_conteos_grupo",
    etiqueta_cima_formato = "dos_lineas",
    abreviaturas_grupos = c("Hombre" = "H", "Mujer" = "M"),
    umbral_etiqueta = 0,
    mostrar_bins_vacios = FALSE,
    usar_canvas = FALSE
  )
  built_labels_group_pct <- unlist(lapply(ggplot2::ggplot_build(p_top_group_pct)$data, function(x) {
    if ("label" %in% names(x)) x$label else character()
  }), use.names = FALSE)
  expect_true(any(grepl("H 1\\(50%\\).*M 1\\(50%\\)", built_labels_group_pct)))
  expect_true(any(grepl("\n", built_labels_group_pct, fixed = TRUE)))

  p_sub <- graficar_histograma(
    df,
    var = "edad",
    grupo = "sexo",
    ancho_bin = 1,
    modo = "porcentaje_total",
    mostrar_resumen_grupos_subtitulo = TRUE,
    prefijo_resumen_grupos_subtitulo = "Sexo: ",
    subtitulo = "Distribución por edad",
    usar_canvas = FALSE
  )
  expect_equal(attr(p_sub, "pulso_histograma_resumen_grupos"), "Sexo: Hombre 50% · Mujer 50%")
  expect_equal(attr(p_sub, "pulso_histograma_subtitulo"), "Distribución por edad\nSexo: Hombre 50% · Mujer 50%")
})

test_that("p_histograma y p_presets exponen contratos publicos", {
  el <- p_histograma("edad", grupo = "sexo", modo = "porcentaje_bin", ancho_bin = 2)
  expect_s3_class(el, "ppt_element")
  expect_equal(el$.element_type, "histograma")
  expect_equal(el$grupo, "sexo")
  expect_equal(el$overrides$modo, "porcentaje_bin")
  expect_equal(el$overrides$ancho_bin, 2)

  presets <- p_presets(histograma = list(modo = "porcentaje_bin", ancho_bin = 2))
  expect_equal(presets$histograma$args$modo, "porcentaje_bin")
  expect_equal(presets$histograma$args$ancho_bin, 2)
})

test_that("canvas_w_etiquetas desplaza visualmente el inicio de barras", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_small <- tempfile(fileext = ".png")
  f_large <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_small, canvas_w_etiquetas = 0.12, ancho_max_eje_y = 20)
  .render_apiladas_args_ui(df, f_large, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 20)

  x_small <- .first_blue_bar_x(png::readPNG(f_small))
  x_large <- .first_blue_bar_x(png::readPNG(f_large))

  expect_gt(x_large - x_small, 150)
})

test_that("ancho_max_eje_y recompone visualmente etiquetas largas", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_narrow <- tempfile(fileext = ".png")
  f_wide <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_narrow, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 14, color_ejes = "#004B8D", size_ejes = 12)
  .render_apiladas_args_ui(df, f_wide, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 70, color_ejes = "#004B8D", size_ejes = 12)

  i_narrow <- png::readPNG(f_narrow)
  i_wide <- png::readPNG(f_wide)
  expect_gt(sum(abs(i_narrow - i_wide)), 10000)
})

test_that("leyenda_posicion cambia el placeholder de leyenda en canvas", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_bottom <- tempfile(fileext = ".png")
  f_top <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_bottom, canvas_w_etiquetas = 0.28, ancho_max_eje_y = 25, mostrar_leyenda = TRUE, leyenda_posicion = "abajo")
  .render_apiladas_args_ui(df, f_top, canvas_w_etiquetas = 0.28, ancho_max_eje_y = 25, mostrar_leyenda = TRUE, leyenda_posicion = "arriba")

  i_bottom <- png::readPNG(f_bottom)
  i_top <- png::readPNG(f_top)
  expect_gt(sum(abs(i_bottom - i_top)), 10000)
})

test_that("barras de PPT pueden mostrar porcentaje con frecuencia", {
  df_apiladas <- data.frame(
    categoria = "Item",
    N = 25,
    pct_1 = 0.64,
    pct_2 = 0.36,
    n_1 = 16,
    n_2 = 9,
    stringsAsFactors = FALSE
  )

  p_apiladas <- graficar_barras_apiladas(
    data = df_apiladas,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_grupos = c(pct_1 = "Si", pct_2 = "No"),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    mostrar_n_en_etiquetas = TRUE,
    mostrar_valores = TRUE,
    etiquetas_uniformes = TRUE,
    umbral_mostrar_etiqueta = 0.01,
    decimales = 0
  )

  labs_apiladas <- unlist(lapply(
    Filter(function(layer) inherits(layer$geom, "GeomText"), p_apiladas$layers),
    function(layer) if ("lab" %in% names(layer$data)) as.character(layer$data$lab) else character()
  ))
  expect_setequal(labs_apiladas, c("64% (16)", "36% (9)"))

  p_apiladas_umbral <- graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.01,
      pct_2 = 0.19,
      pct_3 = 0.80,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Bajo", pct_2 = "Medio", pct_3 = "Alto"),
    mostrar_valores = TRUE,
    etiquetas_uniformes = TRUE,
    umbral_ocultar_etiqueta = 0.035,
    decimales = 0
  )
  labs_apiladas_umbral <- unlist(lapply(
    Filter(function(layer) inherits(layer$geom, "GeomText"), p_apiladas_umbral$layers),
    function(layer) if ("lab" %in% names(layer$data)) as.character(layer$data$lab) else character()
  ))
  expect_false("1%" %in% labs_apiladas_umbral)
  expect_true(all(c("19%", "80%") %in% labs_apiladas_umbral))

  p_apiladas_fuera <- graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.20,
      pct_2 = 0.35,
      pct_3 = 0.45,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Bajo", pct_2 = "Medio", pct_3 = "Alto"),
    mostrar_valores = TRUE,
    etiquetas_uniformes = TRUE,
    umbral_mostrar_etiqueta = 0.40,
    color_texto_barras = "white",
    color_texto_barras_fuera = "#081F5C",
    decimales = 0
  )
  layer_apiladas_fuera <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_apiladas_fuera$layers)[[1]]$data
  expect_true(all(layer_apiladas_fuera$.col_label == "white"))
  expect_true(all(layer_apiladas_fuera$.hjust_label == 0.5))
  expect_false(any(layer_apiladas_fuera$.label_fuera))

  p_apiladas_chicas <- graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.04,
      pct_2 = 0.57,
      pct_3 = 0.39,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Bajo", pct_2 = "Medio", pct_3 = "Alto"),
    mostrar_valores = TRUE,
    umbral_mostrar_etiqueta = 0.12,
    color_texto_barras = "white",
    color_texto_barras_fuera = "#081F5C",
    decimales = 0
  )
  layer_apiladas_chicas <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_apiladas_chicas$layers)[[1]]$data
  row_4 <- layer_apiladas_chicas[layer_apiladas_chicas$lab == "4%", , drop = FALSE]
  expect_equal(row_4$.col_label, "white")
  expect_false(row_4$.label_fuera)
  expect_gte(row_4$x_label, row_4$x_left)
  expect_lte(row_4$x_label, row_4$x_right)
  expect_equal(layer_apiladas_chicas$.col_label[layer_apiladas_chicas$lab == "57%"], "white")

  p_apiladas_chicas_vecinas <- graficar_barras_apiladas(
    data = data.frame(
      categoria = "Item",
      N = 100,
      pct_1 = 0.02,
      pct_2 = 0.09,
      pct_3 = 0.26,
      pct_4 = 0.63,
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3", "pct_4"),
    etiquetas_grupos = c(pct_1 = "Uno", pct_2 = "Dos", pct_3 = "Tres", pct_4 = "Cuatro"),
    mostrar_valores = TRUE,
    etiquetas_uniformes = TRUE,
    umbral_mostrar_etiqueta = 0.12,
    color_texto_barras = "white",
    color_texto_barras_fuera = "#081F5C",
    desplazamiento_max_etiquetas_peq = 0.09,
    etiquetas_peq_factor_ancho = 2.5,
    etiquetas_peq_padding = 0.012,
    decimales = 0
  )
  layer_apiladas_chicas_vecinas <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_apiladas_chicas_vecinas$layers)[[1]]$data
  expect_false(any(layer_apiladas_chicas_vecinas$.label_fuera))
  row_2_chica <- layer_apiladas_chicas_vecinas[layer_apiladas_chicas_vecinas$lab == "2%", , drop = FALSE]
  expect_false(row_2_chica$.label_fuera)
  expect_equal(row_2_chica$.col_label, "white")
  expect_gte(row_2_chica$x_label, 0)
  expect_lte(row_2_chica$x_label, 1)
  row_9 <- layer_apiladas_chicas_vecinas[layer_apiladas_chicas_vecinas$lab == "9%", , drop = FALSE]
  expect_equal(row_9$.col_label, "white")
  expect_false(row_9$.label_fuera)
  expect_gte(row_9$x_label, row_9$x_left)
  expect_lte(row_9$x_label, row_9$x_right)
  widths_chicas <- .estimate_label_fit_width_apiladas(
    layer_apiladas_chicas_vecinas$lab,
    layer_apiladas_chicas_vecinas$.size_label
  )
  span_left <- layer_apiladas_chicas_vecinas$x_label - layer_apiladas_chicas_vecinas$.hjust_label * widths_chicas
  span_right <- layer_apiladas_chicas_vecinas$x_label + (1 - layer_apiladas_chicas_vecinas$.hjust_label) * widths_chicas
  ord_spans <- order(span_left)
  expect_gt(min(span_left[ord_spans][-1] - span_right[ord_spans][-length(ord_spans)]), 0.01)

  df_agrupadas <- data.frame(
    categoria = c("Bajo", "Medio", "Medio 25", "Medio alto", "Casi alto", "Muy alto", "Alto"),
    N = 25,
    pct = c(0.09, 0.17, 0.25, 0.32, 0.38, 0.40, 0.42),
    n = c(16, 31, 38, 59, 70, 72, 76),
    stringsAsFactors = FALSE
  )

  p_agrupadas <- graficar_barras_agrupadas(
    data = df_agrupadas,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n = c(pct = "n"),
    mostrar_n_en_etiquetas = TRUE,
    mostrar_valores = TRUE,
    umbral_posicion = 0.40,
    umbral_etiqueta = 0,
    decimales = 0
  )

  labs_agrupadas <- unlist(lapply(
    Filter(function(layer) inherits(layer$geom, "GeomText"), p_agrupadas$layers),
    function(layer) if ("lab" %in% names(layer$data)) as.character(layer$data$lab) else character()
  ))
  expect_true(all(c("9% (16)", "17% (31)", "25% (38)", "32% (59)", "38% (70)", "40% (72)", "42% (76)") %in% labs_agrupadas))

  layer_agrupadas <- Filter(function(layer) inherits(layer$geom, "GeomText"), p_agrupadas$layers)[[1]]$data
  expect_false(layer_agrupadas$inside[layer_agrupadas$lab == "9% (16)"])
  expect_equal(layer_agrupadas$col_label[layer_agrupadas$lab == "9% (16)"], "#081F5C")
  expect_false(layer_agrupadas$inside[layer_agrupadas$lab == "17% (31)"])
  expect_false(layer_agrupadas$inside[layer_agrupadas$lab == "25% (38)"])
  expect_true(layer_agrupadas$inside[layer_agrupadas$lab == "32% (59)"])
  expect_true(layer_agrupadas$inside[layer_agrupadas$lab == "38% (70)"])
  expect_true(layer_agrupadas$inside[layer_agrupadas$lab == "40% (72)"])
  expect_true(layer_agrupadas$inside[layer_agrupadas$lab == "42% (76)"])
  inside_agrupadas <- layer_agrupadas[layer_agrupadas$inside, , drop = FALSE]
  expect_equal(inside_agrupadas$valor_label, inside_agrupadas$.valor_plot / 2, tolerance = 1e-8)
  expect_equal(inside_agrupadas$hjust_label, rep(0.5, nrow(inside_agrupadas)))

  p_agrupadas_100 <- graficar_barras_agrupadas(
    data = data.frame(
      categoria = paste("Item", 1:5),
      N = 5,
      pct = rep(0.20, 5),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    mostrar_valores = TRUE,
    usar_canvas = TRUE,
    usar_eje_libre = FALSE,
    canvas_min_filas = 8,
    grosor_barras = 0.68
  )
  layout_agrupadas <- attr(p_agrupadas_100, "pulso_barras_agrupadas_layout")
  expect_equal(layout_agrupadas$base_max, 1)
  expect_false(layout_agrupadas$usar_eje_libre)
  expect_equal(layout_agrupadas$grosor_eff, 0.68 * 5 / 8, tolerance = 1e-8)
})

test_that("barras ACNUR conservan 16 pt y asignan ancho segun sus etiquetas", {
  make_plot <- function(labels) {
    graficar_barras_agrupadas(
      data = data.frame(
        categoria = labels,
        N = rep(100, length(labels)),
        pct = seq(0.20, 0.20 + 0.05 * (length(labels) - 1L), by = 0.05),
        stringsAsFactors = FALSE
      ),
      var_categoria = "categoria",
      var_n = "N",
      cols_porcentaje = "pct",
      etiquetas_series = c(pct = "Porcentaje"),
      mostrar_valores = TRUE,
      usar_canvas = TRUE,
      preservar_tamanos_texto = TRUE,
      canvas_w_adaptativo = TRUE,
      size_ejes = 16,
      size_texto_barras = 16 / (72.27 / 25.4),
      ancho_max_eje_y = 38,
      ancho = 12
    )
  }

  short <- attr(make_plot(c("Sí", "No", "Otro")), "pulso_barras_agrupadas_layout")
  long <- attr(make_plot(c(
    "No recibió información antes de acercarse al servicio",
    "Recibió información por personal de la organización",
    "Recibió información por familiares o amistades"
  )), "pulso_barras_agrupadas_layout")

  expect_equal(short$size_ejes_eff, 16)
  expect_equal(long$size_ejes_eff, 16)
  expect_equal(short$size_texto_barras_eff * (72.27 / 25.4), 16, tolerance = 0.05)
  expect_equal(long$size_texto_barras_eff * (72.27 / 25.4), 16, tolerance = 0.05)
  expect_gt(long$canvas_w_etiquetas_eff, short$canvas_w_etiquetas_eff)
  expect_gte(short$canvas_w_bars_eff, 0.50)
  expect_gte(long$canvas_w_bars_eff, 0.50)
})

test_that("pie puede mostrar frecuencia junto al porcentaje", {
  p <- graficar_pie(
    data = data.frame(
      categoria = c("Si", "No"),
      pct = c(0.53, 0.47),
      n = c(97, 85),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria",
    var_pct = "pct",
    var_n = "n",
    tipo_pie = "pie",
    mostrar_etiquetas_pct = TRUE,
    mostrar_n_en_etiquetas = TRUE,
    usar_canvas = FALSE,
    umbral_etiqueta_pct = 0,
    decimales_pct = 0
  )

  layer <- Filter(function(layer) inherits(layer$geom, "GeomText"), p$layers)[[1]]$data
  expect_setequal(as.character(layer$pct_txt), c("53% (97)", "47% (85)"))
})

test_that("PPT usa textos pulidos para selección múltiple y Top 2 Box", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    x1 = c(1, 2, 3, 4, 4, 3),
    x2 = c(2, 3, 3, 4, 4, 4),
    m1 = c("1", "1 2", "2", "1", "2", "1 2"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = c("x1", "x2", "m1"),
      type = c("select_one", "select_one", "select_multiple"),
      list_name = c("lst_likert", "lst_likert", "lst_multi"),
      label = c("Indicador 1", "Indicador 2", "Pregunta múltiple"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_likert", 4), rep("lst_multi", 2)),
      name = c("1", "2", "3", "4", "1", "2"),
      label = c("Nada", "Bajo", "Alto", "Muy alto", "Opción A", "Opción B"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      lst_likert = c("1", "2", "3", "4"),
      lst_multi = c("1", "2")
    )
  )

  plan <- p_plan(slides = list(
    p_slide_1_grafico(
      titulo = "Top 2",
      grafico = p_barras_multiapiladas(
        modo = "var",
        vars = c("x1", "x2"),
        top2box = TRUE,
        top2box_labels = c("Alto", "Muy alto")
      )
    ),
    p_slide_1_grafico(
      titulo = "Múltiple",
      grafico = p_barras_agrupadas("m1")
    )
  ))

  out <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    path_ppt = out,
    mensajes_progreso = FALSE
  )

  slide_files <- grep("^ppt/slides/slide[0-9]+\\.xml$", unzip(out, list = TRUE)$Name, value = TRUE)
  xml <- paste(unlist(lapply(unzip(out, files = slide_files, exdir = tempdir()), readLines, warn = FALSE)), collapse = " ")

  expect_true(grepl("Top 2 Box", xml, fixed = TRUE))
  expect_false(grepl("N =", xml, fixed = TRUE))
  expect_true(grepl("Pregunta de opción múltiple", xml, fixed = TRUE))
})

test_that("el tipo de un bloque recod se resuelve tambien con codigos no numericos", {
  survey <- data.frame(
    name = c("services_recod", "obstacle_recod", "recomendation_recod", "recomendation", "edad"),
    type = c("select_multiple services_recod", "select_multiple obstacle_recod",
             "select_one lst_recomendation_recod", "text", "integer"),
    stringsAsFactors = FALSE
  )
  tm <- pulso_recod_type_map(survey)

  # Dummies con codigo NO numerico: antes caian al color generico.
  expect_equal(pulso_recod_resolve_type("services_recod.legal", tm), "sm")
  expect_equal(pulso_recod_resolve_type("obstacle_recod.ubi", tm), "sm")
  # Dummy con codigo numerico: sigue funcionando.
  expect_equal(pulso_recod_resolve_type("services_recod.96", tm), "sm")
  # Texto recodificado a variable independiente: resuelve por la propia _recod.
  expect_equal(pulso_recod_resolve_type("recomendation_recod", tm), "so")
  # Numericas siguen siendo int, y lo desconocido sigue sin tipo.
  expect_equal(pulso_recod_resolve_type("edad", tm), "int")
  expect_true(is.na(pulso_recod_resolve_type("no_existe", tm)))
})
