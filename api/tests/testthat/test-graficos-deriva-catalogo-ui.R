source("setup-load-all.R")

# Deriva entre la firma de un graficador y su superficie en la UI.
#
# Los dos catalogos que alimentan la UI —`.GRAFICADORES_META` (inspector de
# lamina) y `.PRESETS_META` (panel Estilo)— se escriben A MANO; no se derivan
# de `formals()`. El router filtra por `formals()` (router_graficos.R:203), asi
# que el motor aceptaria cualquier argumento que le llegara, pero no llega
# ninguno que no este en el catalogo: ninguna superficie tiene campo libre
# clave/valor, y «Estilos guardados» reusa el mismo catalogo de presets.
#
# El contrato que ya existia corre en la direccion segura: nada del catalogo
# esta muerto (test-graficos-metadata.R:210). La direccion inversa —un formal
# del motor sin superficie— solo estaba pinneada para 2 args de 2 laminas.
# Por eso 195 argumentos quedaron sin puerta sin que nadie lo decidiera.
#
# Este test NO exige exponerlo todo. Fija la linea base para que la brecha no
# CREZCA en silencio: si manana alguien agrega un parametro al motor y no
# decide su superficie, el nombre nuevo no estara en la lista y el test cae.
# Exponer un argumento solo lo saca de la lista — nunca rompe nada.

# Nunca van a la UI por diseno: los rellena el plan o son mecanica del export.
.deriva_args_internos <- c(
  "data", "instrumento", "contexto", "overrides", "cols_n", "cols_porcentaje",
  "etiquetas_series", "etiquetas_grupos", "etiquetas_leyenda", "reparto",
  "path_salida", "exportar", "dpi", "ancho", "alto",
  "ppt_append", "ppt_layout", "ppt_master",
  "usar_canvas", "centro_cowplot", "preservar_tamanos_texto"
)

# Linea base medida el 2026-08-11. Baja cuando algo gana superficie.
.deriva_sin_superficie <- list(
p_barras_agrupadas = c("alinear_etiquetas", "canvas_h_reserva_pie_in",
    "canvas_w_adaptativo", "color_fondo", "espacio_izquierda_rel",
    "extra_derecha_rel", "face_subtitulo", "invertir_series", "minimo_cero_visual",
    "nota_pie_derecha", "pos_nota_pie", "sufijo_etiqueta", "sufijos_etiqueta",
    "umbral_barra", "usar_eje_libre", "var_categoria", "var_n"),
p_barras_categoricas = c("color_fondo", "eje_y_porcentaje", "modo_valor",
    "paleta_colores", "promedio", "var_categoria", "var_n", "var_pct",
    "var_valor"),
p_barras_apiladas = c("barra_extra_comparativo", "barra_extra_semaforo",
    "barra_extra_semaforo_colores", "bottom2box_labels", "canvas_h_panel_in_min",
    "canvas_h_reserva_pie_in", "color_fondo", "color_titulos_grupo",
    "espacio_izquierda_rel", "etiquetas_peq_confinadas",
    "etiquetas_peq_factor_ancho", "etiquetas_peq_margen_interno",
    "etiquetas_peq_max_iter", "etiquetas_peq_padding",
    "etiquetas_peq_sesgo_derecha", "etiquetas_uniformes", "extra_derecha_rel",
    "face_subtitulo", "invertir_segmentos", "legend_key_aspect_yx",
    "nota_pie_derecha", "pos_nota_pie", "size_texto_barras_peq",
    "sufijos_etiqueta", "titulos_grupo_alto_rel", "top3box_labels",
    "umbral_etiqueta_peq", "umbral_ocultar_etiqueta", "var_categoria",
    "var_etiqueta_categoria", "var_grupo_id", "var_grupo_titulo", "var_n"),
p_nube_palabras = c("seed", "var_n", "var_texto"),
p_pie = c("color_fondo", "decimales_pct", "donut_label_nudge_out",
    "donut_radio_etiqueta_out", "nudge_radial_etiqueta", "pie_radio_etiqueta",
    "pos_nota_pie", "pos_subtitulo", "var_categoria", "var_n", "var_pct",
    "y_subtitulo", "y_titulo"),
p_histograma = c("alternar_etiquetas_cima", "cerrar_intervalos", "color_fondo",
    "desfase_etiquetas_cima", "desfase_horizontal_etiquetas_cima",
    "etiqueta_sin_grupo", "expand_x", "incluir_na_grupo",
    "lineheight_etiqueta_cima", "mostrar_eje_x", "pos_nota_pie",
    "repeler_etiquetas_cima_x", "separador_etiquetas_cima",
    "umbral_altura_repel_etiquetas_cima"),
p_boxplot = c("alpha_puntos", "ancho_caja", "ancho_max_eje_cat", "chip_colores",
    "chip_sufijo", "chip_texto_color", "color_fondo", "color_media", "color_n",
    "cortes_y", "jitter_height", "jitter_width", "limites_y",
    "mostrar_n_por_categoria", "pos_nota_pie", "prefijo_n", "size_media", "size_n",
    "size_puntos", "tamano_linea_caja", "var_categoria", "var_valor"),
p_media_rango = c("alpha_rango", "altura_bloque_ref_rel", "ancho_max_eje_cat",
    "ancho_rango", "chip_colores", "chip_sufijo", "chip_texto_color",
    "color_fondo", "color_media", "color_n", "cortes_y", "destacar_significativos",
    "escala_burbuja", "limites_y", "linewidth_rango", "marker_style",
    "mostrar_chip", "mostrar_delta_no_significativo", "mostrar_n_por_categoria",
    "mostrar_ref_line", "offset_delta", "pos_delta", "pos_nota_pie", "prefijo_n",
    "probs_rango", "ref_label", "ref_score", "semaforo_gradiente_colores",
    "semaforo_gradiente_limites", "semaforo_gradiente_segmentos",
    "semaforo_gradiente_valores", "shape_punto_media", "size_chip_ref_max_pt",
    "size_media", "size_n", "size_punto_media", "stroke_punto_media",
    "umbral_brecha", "var_categoria", "var_valor"),
p_barras_divergentes = c("limite_x", "var_categoria", "var_n"),
p_puntos_comparativos = c("var_grupo", "var_n", "var_valor"),
p_dumbbell = c("limite_x", "var_eje", "var_grupo", "var_valor"),
p_lollipop = c("limite_x", "var_categoria", "var_n", "var_valor"),
p_serie_temporal = c("orden_series", "separacion_etiquetas", "var_eje",
    "var_grupo", "var_valor"),
p_radar = c("alpha_relleno", "alto_por_eje", "axis_iconos", "color_fondo",
    "color_grilla", "color_radios", "debug_ppt", "debug_ppt_log",
    "icono_color_leyenda_radar", "icono_color_radar", "icono_modo",
    "icono_size_radar", "margen_etiquetas", "mostrar_leyenda_iconos",
    "mostrar_tela", "pos_nota_pie", "tabla_allow_upscale", "tabla_clip",
    "tabla_fit_pad", "tabla_font_family", "tabla_wrap_header",
    "valores_hacia_dentro", "var_eje", "var_grupo", "var_valor"),
  NULL
)

.deriva_args_en_ui <- function() {
  nombres <- function(lista) unique(unlist(lapply(lista, function(x)
    vapply(x$args %||% list(), function(a) as.character(a$name %||% ""), character(1)))))
  unique(c(nombres(.graficos_registry_payload()$graficadores),
           nombres(.presets_metadata_payload()$presets)))
}

test_that("ningun argumento nuevo del motor nace sin superficie ni decision", {
  en_ui <- .deriva_args_en_ui()
  for (g in .graficos_registry_payload()$graficadores) {
    fn <- tryCatch(get(sub("^p_", "graficar_", g$name)), error = function(e) NULL)
    if (!is.function(fn)) next
    ocultos <- setdiff(setdiff(names(formals(fn)), "..."),
                       c(en_ui, .deriva_args_internos))
    nuevos <- setdiff(ocultos, .deriva_sin_superficie[[g$name]] %||% character(0))
    expect_identical(
      nuevos, character(0),
      info = sprintf(
        "%s acepta %s sin puerta en la UI. Decide: exponerlo en el catalogo, marcarlo interno, o sumarlo a la linea base a proposito.",
        g$name, paste(nuevos, collapse = ", "))
    )
  }
})

test_that("la linea base no conserva nombres que ya no existen", {
  # Un nombre fosil en la lista tapa una deriva real: si el motor lo renombra,
  # el nombre nuevo entra oculto y el viejo sigue justificandolo.
  for (nm in names(.deriva_sin_superficie)) {
    fn <- tryCatch(get(sub("^p_", "graficar_", nm)), error = function(e) NULL)
    if (!is.function(fn)) next
    fosiles <- setdiff(.deriva_sin_superficie[[nm]], names(formals(fn)))
    expect_identical(fosiles, character(0),
                     info = sprintf("%s: %s ya no es formal", nm, paste(fosiles, collapse = ", ")))
  }
})
