# Gráficos de la propuesta de diseño muestral (pedido de Gonzalo, 2026-11-11: "gráficos súper elegantes
# (puedes consultar al motor de gráficos del módulo de Procesamiento) de cara a mostrar gráficos que resumen la
# distribución de los actores").
#
# No se dibuja nada aparte: cada distribución se arma como una base de encuesta mínima (una fila por persona y
# una pregunta select_one con los segmentos como opciones) y la dibuja el motor de Procesamiento
# (`p_barras_categoricas` / `p_barras_agrupadas` dentro de `reporte_ppt_plan`), con su estética y su base.

# Más categorías que esto van en barras horizontales: las verticales del motor admiten hasta 10 y con muchas
# barras los rótulos se parten.
.CMG_MAX_VERTICALES <- 6L
.CMG_MAX_PAREJA <- 8L

#' Fuente mínima para el motor de gráficos: instrumento XLSForm + datos normalizados.
#' @keywords internal
.cmg_fuente <- function(nombre, etiquetas, N, pregunta) {
  codigos <- as.character(seq_along(etiquetas))
  xf <- tempfile("cm_propuesta_", fileext = ".xlsx")
  on.exit(unlink(xf), add = TRUE)
  openxlsx::write.xlsx(list(
    survey = data.frame(type = "select_one seg", name = "segmento", label = pregunta, stringsAsFactors = FALSE),
    choices = data.frame(list_name = "seg", name = codigos, label = etiquetas, stringsAsFactors = FALSE),
    settings = data.frame(form_title = nombre, default_language = "Spanish (es)", stringsAsFactors = FALSE)), xf)
  inst <- reporte_instrumento(path = xf)
  df <- data.frame(segmento = rep(codigos, times = as.integer(N)), stringsAsFactors = FALSE)
  list(data = reporte_data(normalize_data_for_xlsform(df, inst), instrumento = inst), inst = inst)
}

.cmg_grafico <- function(fuente, n_categorias, en_pareja = FALSE) {
  var <- paste0(fuente, "$segmento")
  # Sin la pista gris hasta el 100 % detrás de cada barra (revisión de Gonzalo, 2026-11-11: "quita la barra extra").
  # Eje libre: sin pista, una escala fija al 100 % dejaba la barra mayor (19 %) en un quinto del ancho.
  el <- if (n_categorias > .CMG_MAX_VERTICALES) p_barras_agrupadas(var, overrides = list(pista_barras = "nunca", usar_eje_libre = TRUE))
        else p_barras_categoricas(var, formato_valor = "porcentaje_n", overrides = list(pista_barras = "nunca"))
  # La nota propia del gráfico diría "Base: N respuestas", y aquí no hay respuestas: es la población. La lámina
  # declara su pie ("Población: ...") y el gráfico no lleva nota.
  el$overrides$nota_pie <- ""
  # Ni el "N respuestas" bajo el título de cada panel (lamina_mixtas.R, D3): la población va en el pie.
  el$overrides$mostrar_publico <- FALSE
  el
}

#' Láminas de gráfico de la propuesta: la población por público y la de cada público por sus segmentos de cruce,
#' de dos en dos por lámina en el orden de los públicos, que ya los agrupa por tema (estudiantes, personal,
#' egresados). Pedido de Gonzalo (2026-11-11): "que los gráficos traten de estar en menos slides, quizás de dos en
#' dos o 3 y dos, que se acomode temáticamente".
#'
#' @param tablas Salida de `calc_muestra_propuesta_tablas()`.
#' @return list(data, instrumento, laminas = list(list(clave, slide))), con claves "graf_1", "graf_2"...
#' @keywords internal
.cmg_laminas <- function(tablas) {
  d <- tablas$datos
  data <- list(); inst <- list(); graficos <- list()
  agregar <- function(fuente, etiquetas, N, pregunta, titulo, tema) {
    f <- .cmg_fuente(fuente, etiquetas, N, pregunta)
    data[[fuente]] <<- f$data; inst[[fuente]] <<- f$inst
    graficos[[length(graficos) + 1L]] <<- list(titulo = titulo, tema = tema, N = sum(N), fuente = fuente,
                                               n_cat = length(etiquetas))
  }
  if (length(d$publicos) > 1L) {
    orden <- order(-d$N)
    # El nombre de la fuente es el sustantivo que el motor escribe sobre cada barra ("22,820 personas").
    agregar("personas", d$publicos[orden], d$N[orden], "Público", "Población por público", "Población")
  }
  for (i in seq_along(d$publicos)) {
    p <- d$publicos[i]
    if (!identical(d$usos[i], "reporte")) next
    s <- d$segmentos[[p]]
    crit <- attr(tablas$segmentos[[p]], "criterio") %||% ""
    orden <- order(-s$N)
    agregar(tolower(p), s$segmento[orden], s$N[orden], if (nzchar(crit)) crit else "Segmento",
            if (nzchar(crit)) sprintf("%s por %s", p, tolower(crit)) else p, p)
  }
  # Grupos de dos. Un gráfico con más de .CMG_MAX_PAREJA categorías va solo: en
  # medio ancho el motor parte los rótulos y repite la base en cada fila (DCI pregrado, 15 facultades).
  grupos <- list(); pendientes <- list()
  cerrar <- function() {
    n <- length(pendientes); i <- 1L
    while (i <= n) {
      # Sin filas de tres: en esa lámina el motor no dibuja el título de cada gráfico.
      k <- min(2L, n - i + 1L)
      grupos[[length(grupos) + 1L]] <<- pendientes[i:(i + k - 1L)]; i <- i + k
    }
    pendientes <<- list()
  }
  for (g in graficos) {
    if (g$n_cat > .CMG_MAX_PAREJA) { cerrar(); grupos[[length(grupos) + 1L]] <- list(g) }
    else pendientes[[length(pendientes) + 1L]] <- g
  }
  cerrar()
  .y <- function(x) if (length(x) <= 1L) x else paste(paste(x[-length(x)], collapse = ", "), "y", x[length(x)])
  laminas <- lapply(seq_along(grupos), function(g) {
    gr <- grupos[[g]]
    titulo <- toupper(.y(vapply(gr, `[[`, "", "tema")))
    base <- paste0("Población: ", .y(vapply(gr, function(x) sprintf("%s %s", .cmp_fmt_n(x$N), x$fuente), "")))
    # Con dos o tres gráficos, cada uno lleva su título; con uno, va de subtítulo de la lámina.
    els <- lapply(gr, function(x) {
      e <- .cmg_grafico(x$fuente, x$n_cat, en_pareja = length(gr) > 1L)
      if (length(gr) > 1L) e$title_slide <- x$titulo
      e
    })
    slide <- switch(as.character(length(gr)),
      "1" = p_slide_1_grafico(els[[1]], titulo = toupper(gr[[1]]$titulo), base = base),
      "2" = p_slide_2_graficos(els[[1]], els[[2]], titulo = titulo, base = base),
      "3" = p_slide_3_graficos_fila(els[[1]], els[[2]], els[[3]], titulo = titulo, base = base))
    # Un gráfico de barras horizontales solo en su lámina se estira al alto disponible (como lo estiró Gonzalo en
    # la revisión del 2026-11-11): el motor lo deja centrado con filas fijas.
    list(clave = paste0("graf_", g), slide = slide, estirar = length(gr) == 1L && gr[[1]]$n_cat > .CMG_MAX_VERTICALES)
  })
  list(data = data, instrumento = inst, laminas = laminas)
}

#' Estira en vertical el grupo del gráfico de una lámina hasta `top`..`top + alto` (pulgadas), como al arrastrarlo en
#' PowerPoint: cambia el marco del grupo y conserva el de sus hijos, así que las formas se escalan.
#' @keywords internal
.cmg_estirar_grafico <- function(doc, indice, top = 1.40, alto = 5.06) {
  doc <- officer::on_slide(doc, indice)
  sl <- doc$slide$get_slide(indice)
  xml <- sl$get()
  ns <- xml2::xml_ns(xml)
  grupos <- xml2::xml_find_all(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[starts-with(@name, 'prosecnur:grafico')]]", ns)
  emu <- function(x) format(round(x * 914400), scientific = FALSE)
  for (g in grupos) {
    off <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:off", ns)
    ext <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:ext", ns)
    if (inherits(off, "xml_missing") || inherits(ext, "xml_missing")) next
    if (as.numeric(xml2::xml_attr(ext, "cy")) / 914400 >= alto) next
    xml2::xml_set_attr(off, "y", emu(top))
    xml2::xml_set_attr(ext, "cy", emu(alto))
  }
  sl$save()
  doc
}
