# Disposiciones de composición: repartos de dos y tres gráficos sin icono.
#
# Todas comparten renderer porque todas son lo mismo visto de distinta forma: N
# huecos de gráfico colocados por el layout, más título y base. Lo que cambia
# entre ellas —dónde cae cada hueco y cuánto mide— vive en la plantilla, no aquí:
# es la definición de una disposición.
#
# Por eso no hay un archivo por disposición ni una rama por tipo en el motor. Si
# la próxima necesita código propio, es que no es una disposición nueva sino un
# graficador nuevo.
#
# Vive fuera de `reporte_plan_ppt.R`, que está congelado a crecimiento: allí solo
# queda el despacho.

# Cada entrada declara sus slots EN EL ORDEN de los huecos del layout. El orden
# importa: `.ph_with_strict` resuelve el hueco por `type_idx`, así que el primer
# slot va al primer `pic` del layout.
.SLIDES_COMPOSICION <- list(
  graficos_3_2mas1 = c("superior_izquierda", "inferior_izquierda", "derecha"),
  graficos_3_1mas2 = c("izquierda", "superior_derecha", "inferior_derecha"),
  graficos_3_fila = c("izquierda", "centro", "derecha"),
  graficos_3_1arriba = c("superior", "inferior_izquierda", "inferior_derecha"),
  graficos_2_vertical = c("superior", "inferior"),
  graficos_2_asimetrico = c("principal", "apoyo"),
  poblacion_3_tira = c("superior", "medio", "inferior"),
  poblacion_3_corona = c("superior_izquierda", "superior_derecha", "inferior"),
  poblacion_3_cifras = c("superior_izquierda", "derecha", "cifra_superior", "inferior_izquierda", "cifra_inferior"),
  cifras_y_graficos = c("cifra_izquierda", "cifra_centro", "cifra_derecha", "grafico_izquierda", "grafico_derecha"),
  # P4 (checklist-poblacion-y-filtro): pasan por aquí, antes de su rama de plantilla en reporte_plan_ppt.R, para salir con
  # el marco del recetario. Sus ranuras internas son `pic1…`, barajadas por el orden de los huecos de la plantilla
  # (reporte_plan_slides.R: pic1 = superior 2); aquí van en el orden en que se leen, que es el de las ranuras del estándar.
  # En la plantilla de respaldo cada una va a su propio hueco, así que el orden no la afecta. La base se llama `footer`.
  poblacion_5 = c("pic2", "pic1", "pic3", "pic5", "pic4"),
  poblacion_6 = c("pic2", "pic1", "pic3", "pic5", "pic6", "pic4"),
  # Dos gráficos con texto (reporte_slides_texto_2graficos.R): los gráficos lado a lado y el texto en su columna.
  text_l2 = c("plot1", "plot2"),
  text_r2 = c("plot1", "plot2")
)

#' Renderiza una lámina de composición
#'
#' @param doc Documento `rpptx` en curso.
#' @param slide La lámina del plan.
#' @param contract Entrada de `.PPT_CONTRACT` para esta disposición.
#' @param helpers Closures del motor (ver `.poblacion_3_render`).
#' @param presets Presets efectivos.
#' @param solo_lista Si `TRUE`, no dibuja.
#'
#' @return Lista con `doc` y `rendered`.
#' @keywords internal
.composicion_render <- function(doc, slide, contract, helpers, presets,
                                solo_lista = FALSE) {
  slide <- .texto2_con_titulo(slide, helpers$title_of_var)   # dos gráficos con texto: el título del primero si no trae
  slots <- slide$slots %||% list()
  stype <- as.character(slide$.slide_type %||% "")[1]
  op_disp <- .lam_disposicion_fijar(slide); on.exit(options(op_disp), add = TRUE)   # cinco gráficos: «3+2» o «2+3»
  nombres <- .SLIDES_COMPOSICION[[stype]]
  if (is.null(nombres)) {
    nombres <- setdiff(names(contract$slots), c("title", "base", "icon"))
  }

  els <- list(); els0 <- list()   # els0: sin la base por gráfico (la plantilla de dos gráficos con texto la lleva al pie)
  for (nm in nombres) {
    el <- slots[[nm]] %||% NULL
    if (!inherits(el, "ppt_element")) {
      el <- helpers$elemento_degradado(
        sprintf("%s: `%s` debe ser `ppt_element`.", stype, nm)
      )
    }
    el <- helpers$inject_var_titulo(el)
    els0[[nm]] <- el
    el <- helpers$base_por_grafico(el, presets, helpers$base_auto_from_element)
    els[[nm]] <- el
  }

  # A7 (ola 4): sin base en el pie, los huecos de la vertical llegan hasta donde empezaría la base
  # (reporte_slides_composicion_alto_libre.R).
  contract <- .composicion_vertical_alto_libre(doc, contract, slide, stype)

  # El ancho de slot se toma del layout, que es quien sabe cuánto mide cada
  # hueco: pasarlo fijo aquí volvería a acoplar la disposición al código.
  anchos <- vapply(nombres, function(nm) .composicion_ancho_slot(doc, contract, nm), numeric(1))   # reporte_slides_composicion_ancho.R
  med_t2 <- .texto2_medidas(stype)   # dos gráficos con texto: el ancho de su ranura nativa, no el del marcador de la plantilla
  if (!is.null(med_t2)) anchos <- med_t2$anchos
  # El alto sólo llega a los lienzos de escala (apiladas y multiapiladas): anclan leyenda y base al alto que creen tener y,
  # dibujados para 6 in y pegados en 2.57, la base caía sobre la leyenda. Las agrupadas con alto real encogen y ocultan
  # cifras (render 2026-11-08), así que siguen con el de su firma.
  altos <- lapply(nombres, function(nm) {
    if (.composicion_recibe_alto(els[[nm]])) .composicion_alto_slot(doc, contract, nm)
  })
  if (!is.null(med_t2)) altos <- lapply(seq_along(nombres), function(i) if (.composicion_recibe_alto(els[[i]])) med_t2$altos[[i]])

  rendered <- list()
  for (i in seq_along(nombres)) {
    nm <- nombres[[i]]
    p <- helpers$render_element(helpers$inject_title_override(els[[nm]]),
                                ancho_slot = anchos[[i]], alto_slot = altos[[i]])
    if (is.null(p)) {
      p <- helpers$canvas_render_nulo(
        stype, ": no se pudo renderizar ", nm,
        " (", els[[nm]]$.element_type %||% "<NA>", ")."
      )
    }
    rendered[[nm]] <- p
  }

  # A4 (ola 4): la divergente mide la barra de la apilada vecina (reporte_slides_composicion_grosor.R).
  rendered <- .composicion_grosor_comun(rendered, els, anchos, altos, function(el, ancho_slot, alto_slot)
    helpers$render_element(helpers$inject_title_override(el), ancho_slot = ancho_slot, alto_slot = alto_slot))

  if (isTRUE(solo_lista)) {
    return(list(doc = doc, rendered = unname(rendered), elementos = els))
  }

  # ADR 0093: las disposiciones que el recetario ya compone con piezas nativas no pasan por la plantilla.
  if (!is.null(.lam_mixta_geo(stype)) && (.lam_compositor_aplica_mixta(unname(rendered), slide, stype, unname(els), helpers$title_of_var) ||
                                          .lam_disposicion_forzada(slide, stype))) {
    # P4: el panel que no cabe en piezas nativas va con su gráfico; sin su nota al pie, que la lámina ya escribe en la base.
    especs_c <- lapply(unname(rendered), .lam_espec_de)
    tit_c <- slots$title %||% slide$title; if (inherits(tit_c, "ppt_element_text")) tit_c <- tit_c$text
    tit_c <- if (is.character(tit_c) && length(tit_c) && !is.na(tit_c[1])) tit_c[1] else NULL
    caben <- .lam_mixta_caben(especs_c, .lam_mixta_geo(stype), unname(els), helpers$title_of_var, titulo = tit_c)
    para_lamina <- rendered
    enc_c <- if (any(!caben)) .lam_mixta_encabezados(especs_c, unname(els), helpers$title_of_var)
    for (i in which(!caben)) {
      # G6/A12: sin título ni subtítulo (el panel tiene su encabezado) y con el alto real de su cajón (lamina_titulo_lienzo.R).
      alto_i <- .composicion_alto_respaldo(stype, i, enc_c$preguntas[[i]] %||% NULL, (enc_c$publicos %||% list())[i][[1]] %||% NULL)
      # El alto sólo se pasa si con el de la firma los rótulos se montarían en la fila real: lo que hoy cabe no cambia.
      el_s <- .lam_respaldo_el_sin_encabezado(els[[i]])
      p_s <- tryCatch(helpers$render_element(helpers$inject_title_override(el_s), ancho_slot = anchos[[i]]), error = function(e) NULL)
      if (.lam_respaldo_rotulos_solapan(p_s, alto_i)) {
        p_a <- tryCatch(helpers$render_element(helpers$inject_title_override(.lam_respaldo_el_sin_encabezado(els[[i]], alto = alto_i)),
                                               ancho_slot = anchos[[i]], alto_slot = alto_i), error = function(e) NULL)
        if (!is.null(p_a)) p_s <- p_a
      }
      if (!is.null(p_s)) para_lamina[[i]] <- p_s
    }
    # El `icon` que traiga un plan guardado se ignora: la población ya no lleva ícono (Gonzalo, 2026-10-14).
    # La base: la declarada manda; si no, una sola si los paneles la comparten y ninguna en el pie si difieren (lamina_grilla_nativa.R).
    decl <- slots$base %||% slots$footer; if (inherits(decl, "ppt_element_text")) decl <- decl$text
    b <- .lam_grilla_base(if (is.character(decl) && length(decl) && nzchar(trimws(decl[1]))) decl[1], unname(els), unname(rendered), FALSE, function(e) NULL)
    redib <- .lam_mixta_redibujador(unname(els), function(el, ancho_slot, alto_slot) helpers$render_element(el, ancho_slot = ancho_slot, alto_slot = alto_slot),
                                    helpers$inject_title_override)
    nativo <- .lam_composicion_mixta(doc, stype, unname(para_lamina), unname(els), slide, titulo_de_var = helpers$title_of_var, base = b$base,
                                     solo_base_declarada = b$solo, redibujar = redib)
    if (!is.null(nativo)) return(list(doc = .texto2_dibujar_texto(nativo, slide), rendered = unname(rendered), elementos = els))
  }
  tipo_std <- if (identical(stype, "graficos_2_vertical")) "p_slide_2_graficos_vertical" else stype
  if (.lam_compositor_aplica_paneles(unname(rendered), slide, tipo = tipo_std)) {
    nativo <- .lam_composicion_nativa(doc, stype, unname(rendered), unname(els), slide, titulo_de_var = helpers$title_of_var)
    if (!is.null(nativo)) return(list(doc = nativo, rendered = unname(rendered), elementos = els))
  }

  doc <- helpers$add_slide_strict(doc, contract$layout)
  # Dos gráficos con texto: una sola base por lámina, al pie, como en la nativa (reporte_slides_texto_2graficos.R).
  if (stype %in% .TEXTO2_TIPOS) rendered <- .texto2_respaldo_graficos(els0, rendered, anchos, altos, helpers)

  title_slide <- slots$title %||% slide$title %||% NULL
  if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
    doc <- helpers$ph_with_strict(doc, title_slide, contract$slots$title)
  }

  for (nm in nombres) {
    doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(rendered[[nm]]),
                                  contract$slots[[nm]])
  }

  # Sin ícono también en la plantilla de respaldo: el `icon` de un plan guardado se ignora (Gonzalo, 2026-10-14).
  if (stype %in% .TEXTO2_TIPOS) {
    return(list(doc = .texto2_respaldo_textos(doc, slide, contract, helpers, unname(rendered), unname(els), presets),
                rendered = unname(rendered), elementos = els))
  }

  base <- slots$base %||% slots$footer %||% NULL
  ph_base <- contract$slots$base %||% contract$slots$footer
  if (!is.null(base) && !is.null(ph_base)) {
    valor <- if (inherits(base, "ppt_element")) {
      helpers$dml_o_tabla(helpers$render_element(base, ancho_slot = 6.4))
    } else {
      base
    }
    if (!is.null(valor)) {
      doc <- helpers$ph_with_strict(doc, valor, ph_base)
    }
  }

  list(doc = doc, rendered = unname(rendered), elementos = els)
}
