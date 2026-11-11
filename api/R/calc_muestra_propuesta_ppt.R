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
                   letra = 12, letra_densa = 10.5, max_filas_comodas = 11L, nota_alto = 0.55)

.cmp_fmt_n <- function(x) formatC(as.numeric(x), format = "d", big.mark = ",")
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
  # Aún sin ruta HTTP: el código E_* se registra junto con el endpoint (errors_registry.R).
  if (!length(esc)) stop("La propuesta no tiene escenarios.", call. = FALSE)
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

  # El criterio del segmento (`segmentacion`, p. ej. "Unidad académica") y cuántos; la lista entera va en su lámina.
  segs <- vapply(seq_along(base), function(i) {
    e <- base[[i]]$marco$estratos %||% list()
    crit <- as.character((esc[[1]]$componentes[[i]] %||% list())$segmentacion %||% "")[1]
    if (!length(e)) return(if (nzchar(crit)) crit else "Sin segmentos")
    n <- sprintf("%d %s", length(e), if (length(e) == 1L) "segmento" else "segmentos")
    if (nzchar(crit)) sprintf("%s (%s)", crit, n) else n
  }, "")
  poblacion <- data.frame(`Público` = c(publicos, "Total"),
                          `Segmentos que se reportan` = c(segs, ""),
                          `Personas en la base` = .cmp_fmt_n(c(N, sum(N))), check.names = FALSE)

  filas <- c(paste0("Encuestas: ", publicos), "Encuestas: total", paste0("Margen de referencia: ", publicos))
  comparacion <- data.frame(Indicador = filas, check.names = FALSE)
  for (k in seq_along(calc)) {
    m <- metas[[k]]
    comparacion[[nombres[k]]] <- c(.cmp_fmt_n(c(m, sum(m))), paste0("± ", .cmp_fmt_pct(.cmp_margen_ref(m, N))))
  }

  segmentos <- list()
  for (i in seq_along(base)) {
    est <- base[[i]]$marco$estratos %||% list()
    if (!length(est)) next
    df <- data.frame(Segmento = c(vapply(est, `[[`, "", "label"), "Total"),
                     `Personas en la base` = .cmp_fmt_n(c(vapply(est, function(e) as.integer(e$N), 1L), N[i])),
                     check.names = FALSE)
    for (k in seq_along(calc)) {
      d <- calc[[k]]$componentes[[i]]$resultado$distribucion_estratos %||% list()
      n <- vapply(d, function(x) as.integer(x$n), 1L)
      df[[paste0("Meta ", nombres[k])]] <- .cmp_fmt_n(c(n, sum(n)))
    }
    segmentos[[publicos[i]]] <- df
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

  list(publicos = publicos, escenarios = nombres, poblacion = poblacion, comparacion = comparacion,
       segmentos = segmentos, viabilidad = viabilidad, avisos = avisos %||% character())
}

#' Procedimiento por defecto de un barrido por correo o teléfono (ADR 0143).
#' @keywords internal
.cmp_procedimiento_barrido <- function(piso = 30L) {
  data.frame(
    Etapa = c("Selección", "Cuotas de control", "Seguimiento", "Excedente"),
    Procedimiento = c(
      "Se invita a toda la base de cada público con un enlace personal; no hay sorteo previo.",
      sprintf("La meta de cada público se reparte entre sus segmentos en proporción a su tamaño, con un mínimo de %d encuestas por segmento.", piso),
      "Avance semanal por público y segmento; los recordatorios se dejan de enviar al segmento que cumple su meta.",
      "Si un segmento supera su meta, el excedente se retira por selección aleatoria y se declara en la ficha técnica; así la base mantiene la proporción de la población sin ponderar."),
    check.names = FALSE)
}

.cmp_flextable <- function(df, filas_densas = FALSE, primera = 0.30, total = FALSE) {
  T <- .CMP_TABLA
  azul <- .std_color("azul"); cebra <- .std_color("cebra"); filete <- .std_color("filete")
  letra <- if (filas_densas) T$letra_densa else T$letra
  alto <- if (filas_densas) T$fila_densa else T$fila
  ft <- flextable::flextable(df)
  ft <- flextable::set_table_properties(ft, layout = "fixed")
  w1 <- T$width * primera
  ft <- flextable::width(ft, j = 1, width = w1)
  if (ncol(df) > 1L) ft <- flextable::width(ft, j = 2:ncol(df), width = (T$width - w1) / (ncol(df) - 1L))
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
  if (total) {
    ft <- flextable::bold(ft, i = nrow(df), part = "body")
    ft <- flextable::bg(ft, i = nrow(df), bg = .std_color("banda_clara"), part = "body")
  }
  ft <- flextable::align(ft, j = 1, align = "left", part = "all")
  if (ncol(df) > 1L) ft <- flextable::align(ft, j = 2:ncol(df), align = "center", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::padding(ft, padding.left = 8, padding.right = 8, padding.top = 3, padding.bottom = 3, part = "all")
  ft <- flextable::height_all(ft, height = alto, part = "all")
  ft <- flextable::hrule(ft, rule = "atleast", part = "all")
  ft <- flextable::border_remove(ft)
  ft <- flextable::hline(ft, border = officer::fp_border(color = filete, width = 0.75), part = "body")
  ft
}

# Alto de cada fila según las líneas que pide su celda más larga (Arial: ~2 caracteres por pt de ancho en pulgadas).
.cmp_altos <- function(df, primera, densa) {
  T <- .CMP_TABLA
  letra <- if (densa) T$letra_densa else T$letra
  base <- if (densa) T$fila_densa else T$fila
  w <- c(T$width * primera, rep((T$width * (1 - primera)) / max(1L, ncol(df) - 1L), ncol(df) - 1L)) - 0.22
  por_linea <- 144 / letra
  lineas <- function(txt) max(1, ceiling(nchar(as.character(txt)) / pmax(4, w * por_linea)))
  filas <- rbind(names(df), as.matrix(df))
  vapply(seq_len(nrow(filas)), function(i) {
    l <- max(vapply(seq_len(ncol(filas)), function(j) ceiling(nchar(filas[i, j]) / max(4, w[j] * por_linea)), 1))
    max(base, l * letra * 1.25 / 72 + 0.10)
  }, 0)
}

.cmp_lamina_tabla <- function(doc, titulo, df, nota = NULL, primera = 0.30, total = FALSE, texto_largo = FALSE) {
  T <- .CMP_TABLA
  densa <- nrow(df) > T$max_filas_comodas
  altos <- .cmp_altos(df, primera, densa)
  doc <- officer::add_slide(doc, layout = "Title and Content", master = "Office Theme")
  titulo_fp <- officer::fp_text(color = .std_color("coral"), font.size = 22, bold = TRUE, font.family = "Arial")
  doc <- officer::ph_with(doc, officer::fpar(officer::ftext(toupper(titulo), titulo_fp)),
                          location = officer::ph_location_type(type = "title"))
  ft <- .cmp_flextable(df, filas_densas = densa, primera = primera, total = total)
  ft <- flextable::height(ft, height = altos[1], part = "header")
  ft <- flextable::height(ft, i = seq_len(nrow(df)), height = altos[-1], part = "body")
  if (texto_largo) {
    ft <- flextable::align(ft, j = 2:ncol(df), align = "left", part = "all")
  }
  doc <- officer::ph_with(doc, ft, location = officer::ph_location(left = T$left, top = T$top, width = T$width, height = 1))
  if (!is.null(nota) && nzchar(nota)) {
    top <- min(T$top + sum(altos) + 0.30, 7.5 - T$nota_alto - 0.35)
    nota_fp <- officer::fp_text(color = .std_color("azul"), font.size = 11, font.family = "Arial")
    doc <- officer::ph_with(doc, officer::fpar(officer::ftext(nota, nota_fp), fp_p = officer::fp_par(text.align = "center")),
                            location = officer::ph_location(left = T$left, top = top, width = T$width, height = T$nota_alto,
                                                            bg = .std_color("cebra")))
  }
  doc
}

#' Genera el PPT de diseño muestral de una propuesta con sus escenarios.
#'
#' Portada y contraportada del motor de plan; en medio, cinco láminas de tabla:
#' diseño muestral, población y segmentos, escenarios, metas por segmento (una
#' por público con segmentos) y viabilidad.
#'
#' @param propuesta Ver la cabecera del archivo.
#' @param path_ppt Ruta del `.pptx`.
#' @return Invisible: list(path, laminas, tablas).
#' @export
calc_muestra_propuesta_ppt <- function(propuesta, path_ppt) {
  tablas <- calc_muestra_propuesta_tablas(propuesta)
  plantilla <- system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")
  if (!nzchar(plantilla)) plantilla <- file.path("api", "inst", "plantillas", "plantilla_16_9.pptx")
  plan <- list(
    p_slide_portada(as.character(propuesta$titulo %||% "Diseño muestral")[1],
                    subtitulo = as.character(propuesta$subtitulo %||% "Propuesta técnica: diseño muestral")[1],
                    fecha = propuesta$fecha %||% NULL),
    p_slide_cierre())
  base_tmp <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(data = data.frame(x = 1), instrumento = list(survey = data.frame(type = "text", name = "x", label = "x")),
                   plan = plan, path_ppt = base_tmp, template_pptx = plantilla, mensajes_progreso = FALSE)
  doc <- officer::read_pptx(base_tmp)

  piso <- as.integer(propuesta$minimo_segmento %||% 30L)
  proc <- propuesta$procedimiento %||% .cmp_procedimiento_barrido(piso)
  doc <- .cmp_lamina_tabla(doc, "Diseño muestral", proc, primera = 0.20, texto_largo = TRUE,
                           nota = "Diseño no probabilístico: los resultados describen a quienes respondieron; se comparan con la base por sexo y segmento.")
  doc <- .cmp_lamina_tabla(doc, "Población y segmentos", tablas$poblacion, primera = 0.24, total = TRUE,
                           nota = propuesta$nota_marco %||% NULL)
  doc <- .cmp_lamina_tabla(doc, "Escenarios de muestra", tablas$comparacion, primera = 0.40,
                           nota = "Margen de referencia: el de una muestra aleatoria simple del mismo tamaño, con 95 % de confianza y p = 0.5. Es una referencia de precisión, no un margen de error del diseño.")
  for (p in names(tablas$segmentos)) {
    doc <- .cmp_lamina_tabla(doc, paste0("Metas por segmento: ", p), tablas$segmentos[[p]], primera = 0.40, total = TRUE,
                             nota = sprintf("Reparto proporcional al tamaño de cada segmento, con un mínimo de %d encuestas; lo que agrega el mínimo se descuenta de los segmentos grandes.", piso))
  }
  nota_v <- if (length(tablas$avisos)) paste0("Segmentos que exigen más respuesta de la esperada. ", paste(tablas$avisos, collapse = ". "), ".") else NULL
  doc <- .cmp_lamina_tabla(doc, "Viabilidad de las metas", tablas$viabilidad, primera = 0.22, nota = nota_v)

  # La contraportada (segunda del plan) pasa al final.
  doc <- officer::move_slide(doc, index = 2L, to = length(doc))
  print(doc, target = path_ppt)
  invisible(list(path = path_ppt, laminas = length(doc), tablas = tablas))
}
