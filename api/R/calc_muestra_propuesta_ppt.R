# Láminas de diseño muestral para presentar una propuesta (pedido de Gonzalo,
# 2026-11-11): "poder que el cálculo muestral cree Excel, pero también pueda
# crear PPTs de cara a presentaciones de propuestas", con tablas comparativas
# de escenarios (propuesta A y B).
#
# La forma sigue la propuesta técnica aprobada del conjoint (noviembre 2026):
# título en mayúsculas, tabla con cabecera azul y filas alternas, nota en un
# recuadro bajo la tabla. Los colores salen del estándar (`.std_color`, ADR
# 0092); la portada y la contraportada, del motor de plan (`reporte_ppt_plan`).
#
# Entrada: `propuesta = list(titulo, subtitulo, fecha, referencia_rotulo,
# procedimiento, escenarios = list(list(nombre, componentes)))`. Cada
# componente es el de Cálculo de muestra (actor, actor_categoria, canal_recojo,
# meta, parametros, marco con estratos); se normaliza y se calcula aquí.

.CMP_TABLA <- list(left = 0.62, top = 1.30, width = 12.10, fila = 0.42, fila_densa = 0.30,
                   letra = 12, letra_densa = 10.5, max_filas_comodas = 13L, nota_alto = 0.55)

.cmp_fmt_n <- function(x) formatC(as.numeric(x), format = "d", big.mark = ",")
# El mismo formato que escribe el motor de gráficos sobre la barra ("19%", "18.7%"): la tabla de metas y el
# gráfico del público se leen juntos.
# Redondeo del gráfico: las barras verticales (hasta .CMG_MAX_VERTICALES categorías) escriben enteros ("66%");
# las horizontales, un decimal sin ".0" ("18.7%", "19%"). Mitad hacia arriba, como el motor.
.cmp_fmt_pct_grafico <- function(x, n_categorias = Inf) {
  dec <- if (n_categorias > .CMG_MAX_VERTICALES) 1L else 0L
  v <- floor(100 * x * 10^dec + 0.5) / 10^dec
  txt <- sub("\\.0$", "", formatC(v, format = "f", digits = dec))
  ifelse(is.finite(x), paste0(txt, "%"), "")
}
.cmp_fmt_pct <- function(x, dec = 1) ifelse(is.finite(x), paste0(formatC(100 * x, format = "f", digits = dec), " %"), "")
.cmp_margen_ref <- function(n, N) {
  ok <- n > 0 & N > 1 & n <= N
  out <- rep(NA_real_, length(n))
  out[ok] <- 1.96 * sqrt(0.25 / n[ok] * (N[ok] - n[ok]) / (N[ok] - 1))
  out
}

#' Calcula los escenarios de una propuesta y arma las tablas de sus láminas.
#'
#' @param propuesta Ver la cabecera del archivo.
#' @return list(publicos, escenarios, poblacion, comparacion, segmentos, viabilidad, avisos)
#' @keywords internal
calc_muestra_propuesta_tablas <- function(propuesta) {
  esc <- propuesta$escenarios %||% list()
  if (!length(esc)) stop_api(400, "E_CALC_MUESTRA_PROPUESTA_ESCENARIOS", "La propuesta lleva entre uno y cuatro escenarios.")
  calc <- lapply(esc, function(e) {
    comps <- lapply(e$componentes %||% list(), function(c) {
      c <- calc_muestra_normalize_componente(c)
      c$resultado <- calc_muestra_calcular_componente(c)
      c
    })
    list(nombre = as.character(e$nombre %||% "Escenario")[1], componentes = comps)
  })
  nombres <- vapply(calc, `[[`, "", "nombre")
  base <- calc[[1]]$componentes
  publicos <- vapply(base, function(c) c$actor, "")
  N <- vapply(base, function(c) as.integer(c$marco$marco_validado), 1L)
  meta <- function(k) vapply(calc[[k]]$componentes, function(c) as.integer(c$resultado$n_objetivo), 1L)
  metas <- lapply(seq_along(calc), meta)

  # Para cada actor queda dicho cómo se reparte su meta (pedido de Gonzalo, 2026-11-11: "claridad absoluta
  # de que para cada actor cuáles van a ser finalmente las metas por cuota o por segmento"):
  #   - segmentos que se reportan (`uso_segmentos` = "reporte", por defecto con estratos);
  #   - cuotas de control que no se reportan (`uso_segmentos` = "control");
  #   - meta única, sin cuotas (sin estratos).
  crit_de <- function(i) as.character((esc[[1]]$componentes[[i]] %||% list())$segmentacion %||% "")[1]
  uso_de <- function(i) {
    if (!length(base[[i]]$marco$estratos %||% list())) return("unica")
    u <- as.character((esc[[1]]$componentes[[i]] %||% list())$uso_segmentos %||% "reporte")[1]
    if (identical(u, "control")) "control" else "reporte"
  }
  usos <- vapply(seq_along(base), uso_de, "")
  # Revisión de Gonzalo (2026-11-11, PPT _REV): la columna nombra los segmentos de cruce ("Por qué no
  # simplemente se mencionan?"); un actor sin segmentos de cruce no lleva nada ("si no hay segmento de cruce
  # simplemente no se reporta nada"). `segmentacion_detalle` reemplaza la lista cuando hace falta aclarar algo.
  # Si algún nombre lleva coma ("Gastronomía, Hotelería y Turismo"), los elementos se separan con punto y coma
  # para que se sepa dónde termina cada uno (verificador, 2026-11-11).
  .y_lista <- function(x) {
    if (length(x) <= 1L) return(x)
    sep <- if (any(grepl(",", x, fixed = TRUE))) "; " else ", "
    paste0(paste(x[-length(x)], collapse = sep), if (identical(sep, "; ")) "; y " else " y ", x[length(x)])
  }
  segs <- vapply(seq_along(base), function(i) {
    if (usos[i] != "reporte") return("")
    det <- as.character((esc[[1]]$componentes[[i]] %||% list())$segmentacion_detalle %||% "")[1]
    if (nzchar(det)) return(det)
    etiquetas <- vapply(base[[i]]$marco$estratos, `[[`, "", "label")
    crit <- crit_de(i)
    lista <- .y_lista(etiquetas)
    if (nzchar(crit)) sprintf("%s: %s", crit, lista) else lista
  }, "")
  poblacion <- data.frame(`Público` = c(publicos, "Total"),
                          `Segmento de cruce` = c(segs, ""),
                          `Población` = .cmp_fmt_n(c(N, sum(N))), check.names = FALSE)
  # D9: las personas que figuran en dos públicos se cuentan en ambos; la columna lo dice sin descontarlas.
  comp_ids <- vapply(base, function(c) as.character(c$id %||% "")[1], "")
  compartidos <- vapply(comp_ids, function(id) {
    v <- (propuesta$compartidos %||% list())[[id]]
    if (is.null(v) || !nzchar(id)) NA_integer_ else as.integer(v)
  }, 1L, USE.NAMES = FALSE)
  if (any(compartidos > 0L, na.rm = TRUE)) {
    poblacion[["También en otro público"]] <- c(ifelse(is.na(compartidos), "", ifelse(compartidos == 0L, "0",
      sprintf("%s (%s)", .cmp_fmt_n(compartidos), .cmp_fmt_pct(compartidos / N)))), "")
  }

  # Dos bloques con su fila de sección: encuestas (con total) y margen de referencia.
  # "Margen de error" (revisión 2026-11-11); la nota al pie dice que es referencial.
  filas <- c("Encuestas", publicos, "Total", "Margen de error", publicos)
  comparacion <- data.frame(Indicador = filas, check.names = FALSE)
  for (k in seq_along(calc)) {
    m <- metas[[k]]
    comparacion[[nombres[k]]] <- c("", .cmp_fmt_n(c(m, sum(m))), "", paste0("± ", .cmp_fmt_pct(.cmp_margen_ref(m, N))))
  }
  attr(comparacion, "secciones") <- c(1L, length(publicos) + 3L)
  attr(comparacion, "totales") <- length(publicos) + 2L

  # Lo que agrega el mínimo por segmento a cada meta (decisión 2026-11-11: el mínimo se suma encima).
  agregados <- unlist(lapply(seq_along(base), function(i) {
    por_esc <- vapply(seq_along(calc), function(k) as.integer(calc[[k]]$componentes[[i]]$resultado$n_agregado_minimo %||% 0L), 1L)
    if (!any(por_esc > 0L)) return(NULL)
    # Sin "+0": sólo los escenarios donde el mínimo agrega algo.
    txt <- if (length(unique(por_esc)) == 1L) sprintf("+%d", por_esc[1]) else
      paste(sprintf("+%d en %s", por_esc[por_esc > 0L], nombres[por_esc > 0L]), collapse = ", ")
    sprintf("%s %s", publicos[i], txt)
  }))

  segmentos <- list(); segmentos_num <- list()
  for (i in seq_along(base)) {
    est <- base[[i]]$marco$estratos %||% list()
    if (!length(est)) next
    N_seg <- vapply(est, function(e) as.integer(e$N), 1L)
    # El porcentaje es el mismo que dibuja el gráfico del público y explica la meta de cada segmento
    # (revisión 2026-11-11): las metas son proporcionales a él.
    df <- data.frame(Segmento = c(vapply(est, `[[`, "", "label"), "Total"),
                     `Población` = .cmp_fmt_n(c(N_seg, N[i])),
                     `% de la población` = c(.cmp_fmt_pct_grafico(N_seg / sum(N_seg), length(N_seg)), "100%"),
                     check.names = FALSE)
    num <- data.frame(segmento = vapply(est, `[[`, "", "label"), N = vapply(est, function(e) as.integer(e$N), 1L))
    for (k in seq_along(calc)) {
      d <- calc[[k]]$componentes[[i]]$resultado$distribucion_estratos %||% list()
      n <- vapply(d, function(x) as.integer(x$n), 1L)
      df[[paste0("Meta ", nombres[k])]] <- .cmp_fmt_n(c(n, sum(n)))
      num[[nombres[k]]] <- n
    }
    # De mayor a menor población, como el gráfico del público (pedido de Gonzalo, 2026-11-11); el total al final.
    ord <- order(-N_seg)
    df <- df[c(ord, nrow(df)), , drop = FALSE]; rownames(df) <- NULL
    num <- num[ord, , drop = FALSE]; rownames(num) <- NULL
    segmentos[[publicos[i]]] <- df
    segmentos_num[[publicos[i]]] <- num
    # Qué segmentos subieron al mínimo, para decirlo en la lámina del actor.
    al_minimo <- unique(unlist(lapply(seq_along(calc), function(k) {
      d <- calc[[k]]$componentes[[i]]$resultado$distribucion_estratos %||% list()
      vapply(Filter(function(x) isTRUE(x$n > x$n_proporcional), d), `[[`, "", "estrato")
    })))
    attr(segmentos[[publicos[i]]], "al_minimo") <- al_minimo
    attr(segmentos[[publicos[i]]], "uso") <- usos[i]
    attr(segmentos[[publicos[i]]], "criterio") <- crit_de(i)
  }

  ref <- vapply(base, function(c) as.numeric(c$parametros$tasa_respuesta %||% NA_real_), 0)
  viabilidad <- data.frame(`Público` = publicos, check.names = FALSE)
  viabilidad[[paste0("Respuesta de referencia", if (nzchar(propuesta$referencia_rotulo %||% "")) paste0(" (", propuesta$referencia_rotulo, ")") else "")]] <- .cmp_fmt_pct(ref)
  lectura <- rep("", length(publicos))
  for (k in seq_along(calc)) {
    nec <- metas[[k]] / N
    viabilidad[[paste0("Respuesta necesaria ", nombres[k])]] <- .cmp_fmt_pct(nec)
    exige <- is.finite(ref) & nec > ref + 1e-9
    lectura <- ifelse(exige, ifelse(nzchar(lectura), paste0(lectura, " y ", nombres[k]), nombres[k]), lectura)
  }
  viabilidad$Lectura <- ifelse(nzchar(lectura), paste0("Exige más respuesta en ", lectura), "Alcanzable")

  # Segmentos que piden más que su público y más de lo esperado, agrupados por escenario.
  falta <- list()
  for (k in seq_along(calc)) for (c in calc[[k]]$componentes) {
    cob <- as.numeric(c$resultado$n_objetivo) / max(1, as.numeric(c$marco$marco_validado))
    for (x in c$resultado$distribucion_estratos %||% list()) {
      if (!isFALSE(x$alcanza) || x$respuesta_necesaria <= cob + 0.005) next
      clave <- paste(c$actor, x$estrato, x$n, x$N, sep = "\r")
      falta[[clave]] <- c(falta[[clave]], nombres[k])
    }
  }
  avisos <- vapply(names(falta), function(clave) {
    p <- strsplit(clave, "\r", fixed = TRUE)[[1]]
    esc_txt <- if (length(falta[[clave]]) == length(calc) && length(calc) > 1L) "en todos los escenarios" else paste("en", paste(falta[[clave]], collapse = " y "))
    sprintf("%s, %s: %s encuestas de %s personas, %s de respuesta, %s", p[1], p[2], .cmp_fmt_n(p[3]), .cmp_fmt_n(p[4]),
            .cmp_fmt_pct(as.numeric(p[3]) / as.numeric(p[4]), 0), esc_txt)
  }, "", USE.NAMES = FALSE)

  # Las mismas cifras sin formato, para el Excel (una sola fuente para PPT y XLSX).
  datos <- list(publicos = publicos, segmentacion = segs, N = N, metas = stats::setNames(metas, nombres), referencia = ref,
                referencia_rotulo = as.character(propuesta$referencia_rotulo %||% "")[1], segmentos = segmentos_num,
                compartidos = compartidos)
  datos$usos <- usos
  list(datos = datos, publicos = publicos, escenarios = nombres, poblacion = poblacion, comparacion = comparacion,
       segmentos = segmentos, viabilidad = viabilidad, avisos = avisos %||% character(), agregados = agregados %||% character())
}

#' Procedimiento por defecto de un barrido por correo o teléfono (ADR 0143).
#' @keywords internal
.cmp_procedimiento_barrido <- function(piso = 30L) {
  data.frame(
    Etapa = c("Selección", "Cuotas de control", "Seguimiento", "Excedente"),
    Procedimiento = c(
      "Se invita a toda la base de cada público con un enlace personal; no hay sorteo previo.",
      if (piso > 0L) sprintf("La meta de cada público se reparte entre sus segmentos en proporción a su tamaño. Un segmento que queda por debajo de %d encuestas sube a %d (o a todas sus personas si son menos), y esas encuestas se suman a la meta del público.", piso, piso)
      else "La meta de cada público se reparte entre sus segmentos en proporción a su tamaño.",
      "Avance semanal por público y segmento; los recordatorios se dejan de enviar al segmento que cumple su meta.",
      "Si un segmento supera su meta, el excedente se retira por selección aleatoria y se declara en la ficha técnica; así la base mantiene la proporción de la población sin ponderar."),
    check.names = FALSE)
}

.cmp_flextable <- function(df, filas_densas = FALSE, primera = 0.30, total = FALSE,
                           secciones = attr(df, "secciones"), totales = attr(df, "totales"), anchos = NULL) {
  T <- .CMP_TABLA
  azul <- .std_color("azul"); cebra <- .std_color("cebra"); filete <- .std_color("filete")
  letra <- if (filas_densas) T$letra_densa else T$letra
  alto <- if (filas_densas) T$fila_densa else T$fila
  ft <- flextable::flextable(df)
  ft <- flextable::set_table_properties(ft, layout = "fixed")
  if (!is.null(anchos) && length(anchos) == ncol(df)) {
    ft <- flextable::width(ft, j = seq_len(ncol(df)), width = T$width * anchos / sum(anchos))
  } else {
    w1 <- T$width * primera
    ft <- flextable::width(ft, j = 1, width = w1)
    if (ncol(df) > 1L) ft <- flextable::width(ft, j = 2:ncol(df), width = (T$width - w1) / (ncol(df) - 1L))
  }
  ft <- flextable::font(ft, fontname = "Arial", part = "all")
  ft <- flextable::fontsize(ft, size = letra, part = "all")
  ft <- flextable::color(ft, color = azul, part = "body")
  ft <- flextable::color(ft, color = "#FFFFFF", part = "header")
  ft <- flextable::bg(ft, bg = azul, part = "header")
  ft <- flextable::bold(ft, part = "header")
  ft <- flextable::bold(ft, j = 1, part = "body")
  ft <- flextable::bg(ft, bg = "#FFFFFF", part = "body")
  pares <- seq_len(nrow(df))[seq_len(nrow(df)) %% 2L == 0L]
  if (length(pares)) ft <- flextable::bg(ft, i = pares, bg = cebra, part = "body")
  if (total) totales <- c(totales, nrow(df))
  if (length(totales)) {
    ft <- flextable::bold(ft, i = totales, part = "body")
    ft <- flextable::bg(ft, i = totales, bg = .std_color("banda_clara"), part = "body")
  }
  # Filas de sección: rótulo del bloque, sin cifras, con su propia banda.
  if (length(secciones)) {
    ft <- flextable::bg(ft, i = secciones, bg = .std_color("numero_fondo"), part = "body")
    ft <- flextable::color(ft, i = secciones, color = .std_color("coral"), part = "body")
    ft <- flextable::merge_h_range(ft, i = secciones, j1 = 1, j2 = ncol(df), part = "body")
  }
  ft <- flextable::align(ft, j = 1, align = "left", part = "all")
  if (ncol(df) > 1L) ft <- flextable::align(ft, j = 2:ncol(df), align = "center", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::padding(ft, padding.left = 8, padding.right = 8, padding.top = 3, padding.bottom = 3, part = "all")
  # Bajo una fila de sección, el rótulo de la fila se sangra.
  if (length(secciones)) ft <- flextable::padding(ft, i = setdiff(seq_len(nrow(df)), secciones), j = 1, padding.left = 22, part = "body")
  ft <- flextable::height_all(ft, height = alto, part = "all")
  ft <- flextable::hrule(ft, rule = "atleast", part = "all")
  ft <- flextable::border_remove(ft)
  ft <- flextable::hline(ft, border = officer::fp_border(color = filete, width = 0.75), part = "body")
  ft
}

# Alto de cada fila según las líneas que pide su celda más larga (Arial: ~2 caracteres por pt de ancho en pulgadas).
.cmp_altos <- function(df, primera, densa, anchos = NULL) {
  T <- .CMP_TABLA
  letra <- if (densa) T$letra_densa else T$letra
  base <- if (densa) T$fila_densa else T$fila
  w <- (if (!is.null(anchos)) T$width * anchos else
    c(T$width * primera, rep((T$width * (1 - primera)) / max(1L, ncol(df) - 1L), ncol(df) - 1L))) - 0.22
  por_linea <- 144 / letra
  lineas <- function(txt) max(1, ceiling(nchar(as.character(txt)) / pmax(4, w * por_linea)))
  filas <- rbind(names(df), as.matrix(df))
  vapply(seq_len(nrow(filas)), function(i) {
    l <- max(vapply(seq_len(ncol(filas)), function(j) ceiling(nchar(filas[i, j]) / max(4, w[j] * por_linea)), 1))
    max(base, l * letra * 1.25 / 72 + 0.10)
  }, 0)
}

.cmp_lamina_tabla <- function(doc, titulo, df, nota = NULL, primera = 0.30, total = FALSE, texto_largo = FALSE,
                              llenar = FALSE, anchos = NULL, izquierda = integer()) {
  T <- .CMP_TABLA
  densa <- nrow(df) > T$max_filas_comodas
  altos <- .cmp_altos(df, primera, densa, anchos)
  # El alto cabe hasta el pie (la nota ya no ocupa recuadro); si no, filas densas y, si aún no, se aprietan.
  disponible <- 7.5 - T$top - 0.75
  if (sum(altos) > disponible && !densa) { densa <- TRUE; altos <- .cmp_altos(df, primera, densa, anchos) }
  if (sum(altos) > disponible) altos <- pmax(0.24, altos * disponible / sum(altos))
  # `llenar`: la tabla ocupa el alto disponible de la lámina ("el alto no se aprovecha", revisión 2026-11-11).
  if (llenar && sum(altos) < disponible) altos <- altos * min(disponible / sum(altos), 1.9)
  # La misma cabecera y el mismo pie que las láminas de gráfico del motor (barra junto al título, base y folio):
  # la propuesta se lee como un solo mazo. El folio se corrige al final, con el orden definitivo.
  doc <- officer::add_slide(doc, layout = "Graficos2", master = "Office Theme")
  doc <- .lam_titulo(doc, toupper(titulo))
  ft <- .cmp_flextable(df, filas_densas = densa, primera = primera, total = total, anchos = anchos)
  if (length(izquierda)) ft <- flextable::align(ft, j = izquierda, align = "left", part = "all")
  ft <- flextable::height(ft, height = altos[1], part = "header")
  ft <- flextable::height(ft, i = seq_len(nrow(df)), height = altos[-1], part = "body")
  if (texto_largo) {
    ft <- flextable::align(ft, j = 2:ncol(df), align = "left", part = "all")
  }
  # La tabla va centrada en el alto que queda entre el título y el pie ("tablas centradas al medio", 2026-11-11).
  top_tabla <- T$top + max(0, (disponible - sum(altos)) / 2)
  doc <- officer::ph_with(doc, ft, location = officer::ph_location(left = T$left, top = top_tabla, width = T$width, height = 1))
  # La nota es una indicación al pie, abajo a la izquierda, como la base de los gráficos (revisión 2026-11-11:
  # "debería ser solo una indicación estilo base en la esquina inferior izquierda"); antes era un recuadro que
  # en PowerPoint se montaba sobre la tabla.
  doc <- .lam_pie(doc, if (!is.null(nota) && nzchar(nota)) nota else NULL, folio = 0L)
  doc
}

#' Genera el PPT de diseño muestral de una propuesta con sus escenarios.
#'
#' Portada y contraportada del motor de plan; en medio, láminas de tabla:
#' diseño muestral, población (cómo se reparte la meta de cada actor),
#' escenarios, una lámina de metas por actor con segmentos o cuotas de control
#' y viabilidad. Un actor sin cuotas figura con "Meta única, sin cuotas".
#'
#' @param propuesta Ver la cabecera del archivo.
#' @param path_ppt Ruta del `.pptx`.
#' @return Invisible: list(path, laminas, tablas).
#' @export
calc_muestra_propuesta_ppt <- function(propuesta, path_ppt) {
  tablas <- calc_muestra_propuesta_tablas(propuesta)
  plantilla <- system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")
  if (!nzchar(plantilla)) plantilla <- file.path("api", "inst", "plantillas", "plantilla_16_9.pptx")
  # Portada, gráficos (motor de Procesamiento) y contraportada salen del motor de plan; las tablas se
  # agregan después con officer y al final se ordena todo con `orden` (una clave por lámina).
  graf <- if (isFALSE(propuesta$incluir_graficos)) list(data = list(), instrumento = list(), laminas = list()) else .cmg_laminas(tablas)
  # Portada y diseño muestral son opcionales: cuando las láminas se insertan en una propuesta completa, sobran
  # (Gonzalo las quitó en su revisión del 2026-11-11).
  con_portada <- !isFALSE(propuesta$incluir_portada)
  titulo_portada <- as.character(propuesta$titulo %||% "")[1]
  if (is.na(titulo_portada) || !nzchar(trimws(titulo_portada))) titulo_portada <- "Diseño muestral"
  plan <- c(if (con_portada) list(p_slide_portada(titulo_portada,
                                 subtitulo = as.character(propuesta$subtitulo %||% "Propuesta técnica: diseño muestral")[1],
                                 fecha = propuesta$fecha %||% NULL, subtexto = propuesta$solicitante %||% NULL)),
            lapply(graf$laminas, `[[`, "slide"), list(p_slide_cierre()))
  orden <- c(if (con_portada) "portada", vapply(graf$laminas, `[[`, "", "clave"), "cierre")
  datos_plan <- if (length(graf$data)) graf$data else data.frame(x = 1)
  inst_plan <- if (length(graf$instrumento)) graf$instrumento else list(survey = data.frame(type = "text", name = "x", label = "x"))
  base_tmp <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(data = datos_plan, instrumento = inst_plan,
                   plan = plan, path_ppt = base_tmp, template_pptx = plantilla, mensajes_progreso = FALSE)
  doc <- officer::read_pptx(base_tmp)
  # Antes de agregar y mover láminas: el índice del plan es el del archivo (get_slide no sigue a move_slide).
  for (l in Filter(function(l) isTRUE(l$estirar), graf$laminas)) doc <- .cmg_estirar_grafico(doc, match(l$clave, orden))

  piso <- as.integer(propuesta$minimo_segmento %||% 30L)
  proc <- propuesta$procedimiento %||% .cmp_procedimiento_barrido(piso)
  if (!isFALSE(propuesta$incluir_diseno)) {
    doc <- .cmp_lamina_tabla(doc, "Diseño muestral", proc, primera = 0.20, texto_largo = TRUE); orden <- c(orden, "diseno")
  }
  con_cruce <- "También en otro público" %in% names(tablas$poblacion)
  nota_pob <- paste(c(propuesta$nota_marco %||% NULL,
    if (con_cruce) "Quien figura en dos públicos se cuenta en ambos. A cuál se le envía la encuesta se acuerda en el listado de envío."),
    collapse = " ")
  doc <- .cmp_lamina_tabla(doc, "Población y segmentos de cruce", tablas$poblacion, primera = 0.22, total = TRUE,
                           nota = if (nzchar(nota_pob)) nota_pob else NULL, llenar = TRUE,
                           anchos = if (con_cruce) c(0.20, 0.47, 0.14, 0.19) else c(0.22, 0.60, 0.18), izquierda = 2L)
  orden <- c(orden, "poblacion")
  nota_esc <- "El margen de error es referencial, por tratarse de una muestra no probabilística."
  if (length(tablas$agregados)) nota_esc <- paste0(
    sprintf("Las metas incluyen lo que agrega el mínimo de %d por segmento: %s. ", piso, paste(tablas$agregados, collapse = "; ")), nota_esc)
  doc <- .cmp_lamina_tabla(doc, "Escenarios de muestra", tablas$comparacion, primera = 0.40, nota = nota_esc)
  orden <- c(orden, "escenarios")
  for (p in names(tablas$segmentos)) {
    tab <- tablas$segmentos[[p]]
    control <- identical(attr(tab, "uso"), "control")
    crit <- attr(tab, "criterio") %||% ""
    titulo <- paste0(if (control) "Metas por cuota de control: " else "Metas por segmento: ", p)
    # Sin nota de relleno: sólo se dice lo que la tabla no muestra.
    nota <- paste(c(
      if (control) "Cuotas para controlar la composición de la muestra; no se reportan resultados por cuota.",
      if (length(attr(tab, "al_minimo"))) sprintf("Suben al mínimo de %d (o a todas sus personas): %s.", piso, paste(attr(tab, "al_minimo"), collapse = ", "))),
      collapse = " ")
    if (!nzchar(nota)) nota <- NULL
    if (nzchar(crit)) names(tab)[1] <- crit
    doc <- .cmp_lamina_tabla(doc, titulo, tab, primera = 0.40, total = TRUE, nota = nota)
    orden <- c(orden, paste0("metas_", p))
  }
  nota_v <- if (length(tablas$avisos)) paste0("Segmentos que exigen más respuesta de la esperada. ", paste(tablas$avisos, collapse = ". "), ".") else NULL
  # Lámina interna: una propuesta para el cliente no la lleva salvo que se pida ("Y esto para qué? Es una
  # propuesta para cliente", revisión 2026-11-11).
  if (isTRUE(propuesta$incluir_viabilidad)) {
    doc <- .cmp_lamina_tabla(doc, "Viabilidad de las metas", tablas$viabilidad, primera = 0.22, nota = nota_v)
    orden <- c(orden, "viabilidad")
  }

  # Orden final: portada, diseño, población (tabla y gráficos), escenarios, metas por público, viabilidad y
  # contraportada.
  deseado <- c("portada", "diseno", "poblacion", grep("^graf_", orden, value = TRUE), "escenarios",
               paste0("metas_", tablas$publicos), "viabilidad", "cierre")
  deseado <- deseado[deseado %in% orden]
  for (pos in seq_along(deseado)) {
    actual <- match(deseado[pos], orden)
    if (actual != pos) {
      doc <- officer::move_slide(doc, index = actual, to = pos)
      orden <- append(orden[-actual], deseado[pos], after = pos - 1L)
    }
  }
  print(doc, target = path_ppt)
  .cmp_folios(path_ppt, con_portada)
  invisible(list(path = path_ppt, laminas = length(officer::read_pptx(path_ppt)), tablas = tablas))
}

#' Numera las láminas con el orden definitivo: el motor numera las de gráfico por su lugar en el plan y las de tabla
#' salen con 0; se reescribe cada folio con su posición (sin contar la portada). Se relee el archivo para que el
#' índice de `get_slide` sea el de la presentación.
#' @keywords internal
.cmp_folios <- function(path, con_portada) {
  doc <- officer::read_pptx(path)
  for (i in seq_len(length(doc))) {
    # on_slide sigue el orden de la presentación; get_slide(i) sigue el de los archivos internos.
    doc <- officer::on_slide(doc, i)
    sl <- doc$slide$get_slide(doc$cursor)
    xml <- sl$get()
    ns <- xml2::xml_ns(xml)
    t <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Folio lamina']]//a:t", ns)
    if (!length(t)) next
    xml2::xml_set_text(t[[1]], as.character(i - if (con_portada) 1L else 0L))
    sl$save()
  }
  print(doc, target = path)
  invisible(path)
}
