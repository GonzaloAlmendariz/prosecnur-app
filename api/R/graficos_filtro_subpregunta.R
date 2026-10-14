# Pregunta filtro y subpregunta (recetario p192–p194; inventario de configuraciones, ítem 20).
#
# Una pregunta filtro, las respuestas que habilitan la subpregunta y la subpregunta con su propia base: sólo quienes
# dieron una de esas respuestas. La lámina nativa dibuja los dos gráficos y una llave que sale de lo que habilita y
# llega al título de la subpregunta (recetario_m4.R, «desglose conectado»):
#   - p192: filtro dicotómico arriba y la subpregunta abajo (`disposicion = "abajo"`);
#   - p193: filtro dicotómico en columna y la subpregunta al costado (`disposicion = "costado"`);
#   - p194: filtro de varias respuestas en barras, la llave abraza las que habilitan y la subpregunta va al costado.
# Los dos gráficos salen de los renders de siempre (barras agrupadas y apiladas), así que cifras, redondeo, casos y
# colores son los mismos que en cualquier lámina; aquí sólo se decide qué base lleva la subpregunta y cómo se unen.

#' Pregunta filtro y subpregunta
#'
#' @param var La pregunta filtro: la que habilita la subpregunta (respuesta única).
#' @param habilita Rótulos de las respuestas del filtro que habilitan la subpregunta.
#' @param subpregunta Pregunta que respondieron sólo quienes dieron una de esas respuestas.
#' @param grafico_sub `barras` (una barra por respuesta) o `escala` (barra al 100 % con su leyenda).
#' @param disposicion `costado` (p193–p194) o `abajo` (p192, sólo con un filtro dicotómico).
#' @param grafico_filtro `auto` (barra partida o barras, según el filtro), `torta` o `dona` (F1: con conector).
#' @param titulo,overrides,base,filtros Como en los demás gráficos.
#' @param frase Quiénes forman la base del dependiente, dicho por el analista («que trabajan»): la lámina escribe «Sólo los
#'   139 que trabajan». Sin ella, «que respondieron «Sí»».
#' @param rotulo Rótulo corto a la izquierda de la barra del dependiente cuando es una escala de una fila («Participaron», p192).
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_filtro_subpregunta <- function(var = NULL, habilita, subpregunta = NULL, grafico_sub = c("barras", "escala"),
                                 disposicion = c("costado", "abajo"), titulo = NULL, overrides = list(), base = list(),
                                 filtros = list(), grafico_filtro = c("auto", "torta", "dona"),
                                 independiente = NULL, dependiente = NULL, frase = NULL, rotulo = NULL) {
  grafico_sub <- match.arg(grafico_sub)
  disposicion <- match.arg(disposicion)
  grafico_filtro <- match.arg(grafico_filtro)
  # Dependencia entre los dos gráficos de una lámina (graficos_dependencia.R): llegan los dos gráficos tal cual.
  if (!is.null(independiente) || !is.null(dependiente)) {
    independiente <- .dependencia_elemento(independiente); dependiente <- .dependencia_elemento(dependiente)
    var <- as.character(independiente$var %||% "")[1]
    if (is.na(var) || !nzchar(var)) .plan_spec_abort("El gráfico del que depende el otro necesita una sola pregunta.")
    subpregunta <- as.character(dependiente$var %||% unlist(dependiente$vars)[1] %||% "")[1]
  }
  for (nm in c("var", "subpregunta")) {
    v <- get(nm)
    if (!is.character(v) || length(v) != 1L || !nzchar(trimws(v))) .plan_spec_abort("`", nm, "` debe ser character(1) no vacio.")
  }
  habilita <- trimws(as.character(unlist(habilita %||% character(0))))
  habilita <- unique(habilita[!is.na(habilita) & nzchar(habilita)])
  if (!length(habilita)) .plan_spec_abort("`habilita` debe nombrar al menos una respuesta del filtro.")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(
    .element_type = "filtro_subpregunta",
    var = trimws(var), filtro = trimws(var), habilita = habilita, subpregunta = trimws(subpregunta),
    grafico_sub = grafico_sub, disposicion = disposicion, grafico_filtro = grafico_filtro,
    title_slide = .ppt_norm_text1(titulo, blank = NULL),
    overrides = overrides, base = base, filtros = .ppt_norm_filters(filtros),
    independiente = independiente, dependiente = dependiente, frase = .ppt_norm_text1(frase, blank = NULL),
    rotulo = .ppt_norm_text1(rotulo, blank = NULL)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Los códigos de las respuestas del filtro que habilitan, desde sus rótulos (el filtro de datos compara códigos)
#' @keywords internal
.fsub_codigos <- function(niveles, habilita) {
  norm <- function(x) tolower(trimws(as.character(x)))
  cod <- niveles$code[norm(niveles$label) %in% norm(habilita) | norm(niveles$code) %in% norm(habilita)]
  unique(cod[!is.na(cod) & nzchar(cod)])
}

#' F4: cuántos respondieron la subpregunta sin haber dado una respuesta que la habilita (el salto del formulario no cuadra)
#' @param data La base donde viven el filtro y la subpregunta.
#' @param var_filtro La columna del filtro. @param codigos Los códigos que habilitan. @param vars_sub Las columnas del dependiente.
#' @return El número de personas (0 si alguna columna no está en la base).
#' @keywords internal
.fsub_fuera_del_salto <- function(data, var_filtro, codigos, vars_sub) {
  if (!is.data.frame(data) || !(var_filtro %in% names(data)) || !length(vars_sub) || !all(vars_sub %in% names(data))) return(0L)
  lleno <- function(x) if (is.numeric(x)) !is.na(x) else { x <- trimws(as.character(x)); !is.na(x) & nzchar(x) }
  respondio <- Reduce(`|`, lapply(vars_sub, function(v) lleno(data[[v]])))
  f <- trimws(as.character(data[[var_filtro]]))
  habilita <- vapply(strsplit(ifelse(is.na(f), "", f), "\\s+"), function(t) any(t %in% codigos), TRUE)
  sum(respondio & !habilita)
}

#' Las columnas de las preguntas de un gráfico del plan (su `var` o su batería `vars`)
#' @keywords internal
.fsub_columnas <- function(g, resolver) {
  refs <- as.character(unlist(c(g$var, g$vars)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  unique(unlist(lapply(refs, function(r) tryCatch(resolver(r, arg_name = "var")$var, error = function(e) NULL))))
}

#' El enunciado de una pregunta en su instrumento (columna en español si la hay)
#' @keywords internal
.fsub_enunciado <- function(ctx) {
  surv <- ctx$survey
  col <- .detect_label_es_col(surv)
  if (is.na(col)) col <- grep("^label", names(surv), value = TRUE)[1]
  i <- which(!is.na(surv$name) & surv$name == ctx$var)[1]
  out <- if (!is.na(col) && !is.na(i)) as.character(surv[[col]][i]) else NA_character_
  if (is.na(out) || !nzchar(trimws(out))) ctx$var else trimws(out)
}

#' Render: el filtro con sus datos, la subpregunta con los que habilitan, y la espec que une las dos
#' @keywords internal
.render_filtro_subpregunta <- function(el, preset_args = list()) {
  rend <- dynGet(".render_element", ifnotfound = NULL)
  resolver <- dynGet(".resolve_ref", ifnotfound = NULL)
  lista_de <- dynGet(".list_name_from_ctx", ifnotfound = NULL)
  if (!is.function(rend) || !is.function(resolver) || !is.function(lista_de)) {
    stop("El render no expone el motor de láminas.", call. = FALSE)
  }
  ctx_f <- resolver(el$filtro, arg_name = "filtro")
  ctx_s <- resolver(el$subpregunta, arg_name = "subpregunta")
  niveles <- .reporte_plan_choice_levels_for_list(lista_de(ctx_f), ctx_f$choices)
  codigos <- .fsub_codigos(niveles, el$habilita)
  if (!length(codigos)) {
    stop(sprintf("Filtro y subpregunta: «%s» no tiene las respuestas %s.", el$filtro,
                 paste0("«", el$habilita, "»", collapse = ", ")), call. = FALSE)
  }
  ov <- el$overrides %||% list()
  # F1 (checklist-poblacion-y-filtro): el filtro también como torta o dona; la lámina lo une a la subpregunta con un conector.
  gf <- el$grafico_filtro %||% "auto"
  p_f <- rend(if (!is.null(el$independiente)) el$independiente
              else if (identical(gf, "torta")) p_pie(var = el$filtro, filtros = el$filtros, overrides = ov)
              else if (identical(gf, "dona")) p_donut(var = el$filtro, filtros = el$filtros, overrides = ov)
              else p_barras_agrupadas(var = el$filtro, filtros = el$filtros, overrides = ov))
  filtros_sub <- el$filtros %||% list()
  filtros_sub[[ctx_f$var]] <- codigos
  # La escala hereda del preset la columna Top Two Box; esta lámina no tiene dónde declarar sus respuestas, así que sin
  # ellas va apagada (si no, el motor la omite y avisa «elígelas en la pestaña Gráfico», un aviso sin salida).
  ov_s <- ov
  if (identical(el$grafico_sub, "escala") && !length(ov$top2box_labels)) ov_s$mostrar_barra_extra <- FALSE
  el_s <- if (!is.null(el$dependiente)) {
    # La dependencia entre dos gráficos: el dependiente es el gráfico que puso el analista, con la base de quienes lo habilitan.
    d <- el$dependiente; d$filtros <- utils::modifyList(d$filtros %||% list(), filtros_sub); d
  } else if (identical(el$grafico_sub, "escala")) p_barras_apiladas(var = el$subpregunta, filtros = filtros_sub, overrides = ov_s)
  else p_barras_agrupadas(var = el$subpregunta, filtros = filtros_sub, overrides = ov)
  p_s <- rend(el_s)
  # F4: si hay quien respondió el dependiente sin haberlo habilitado, el salto del formulario no cuadra con los datos; esas
  # respuestas quedan fuera de la lámina y se dice cuántas.
  vars_s <- if (!is.null(el$dependiente)) .fsub_columnas(el$dependiente, resolver) else ctx_s$var
  fuera <- .fsub_fuera_del_salto(ctx_f$data, ctx_f$var, codigos, vars_s)
  if (fuera > 0L) {
    .pulso_aviso(.aviso_en_lamina(sprintf(
      "%d %s el gráfico dependiente sin haber elegido %s en «%s»: el salto del formulario no cuadra con los datos y %s fuera de la lámina.",
      fuera, if (fuera == 1L) "persona respondió" else "personas respondieron",
      paste0("«", niveles$label[niveles$code %in% codigos], "»", collapse = ", "), .fsub_enunciado(ctx_f),
      if (fuera == 1L) "esa respuesta queda" else "esas respuestas quedan")))
  }
  espec_f <- attr(p_f, "pulso_espec"); espec_s <- attr(p_s, "pulso_espec")
  # F1: la torta o dona del filtro va sólo con dos respuestas (Gonzalo, 2026-10-14); con más, barras con su llave y se avisa.
  if (is.null(el$independiente) && gf %in% c("torta", "dona") && !is.null(espec_f) && length(espec_f$rotulos) != 2L) {
    .pulso_aviso(.aviso_en_lamina(sprintf("«%s» tiene %d respuestas: la torta o dona del filtro va sólo con dos; se dibuja en barras con su llave.",
                                          .fsub_enunciado(ctx_f), length(espec_f$rotulos))))
    p_f <- rend(p_barras_agrupadas(var = el$filtro, filtros = el$filtros, overrides = ov)); espec_f <- attr(p_f, "pulso_espec")
  }
  # Ruta anterior (si la lámina nativa no cabe o falta una espec): los dos gráficos lado a lado o uno sobre otro.
  p <- cowplot::plot_grid(p_f, p_s, nrow = if (identical(el$disposicion, "abajo")) 2L else 1L)
  # Los títulos de cada lado: el del gráfico si el analista lo escribió; si no, el enunciado de su pregunta.
  titulo_de <- function(e, ctx) {
    t <- as.character((e$overrides %||% list())$titulo %||% e$title_slide %||% "")[1]
    if (!is.na(t) && nzchar(trimws(t))) return(trimws(t))
    # F2: una batería de varias preguntas no se titula con la primera; sin título propio va sólo su base.
    if (length(unlist(e$vars %||% list())) > 1L) return("")
    .fsub_enunciado(ctx)
  }
  # Con un lado sin pieza nativa (una nube, un radar…), la lámina igual se compone: ese lado lleva su gráfico (respaldo).
  if (is.null(espec_f) || is.null(espec_s)) {
    habilitadas <- niveles$label[niveles$code %in% codigos]
    attr(p, "pulso_espec") <- list(version = "filtro_sub/1", tipo = "filtro_sub", filtro = espec_f, sub = espec_s,
                                   habilita = habilitadas, disposicion = el$disposicion, frase = el$frase, rotulo = el$rotulo,
                                   pregunta_filtro = titulo_de(el$independiente %||% list(), ctx_f), pregunta_sub = titulo_de(el$dependiente %||% list(), ctx_s),
                                   n_filtro = NA_real_, n_sub = NA_real_, plot_filtro = p_f, plot_sub = p_s)
    return(p)
  }
  if (!is.null(espec_f) && !is.null(espec_s)) {
    habilitadas <- niveles$label[niveles$code %in% codigos]
    attr(p, "pulso_espec") <- list(
      version = "filtro_sub/1", tipo = "filtro_sub", filtro = espec_f, sub = espec_s,
      habilita = intersect(espec_f$rotulos %||% character(0), habilitadas),
      disposicion = el$disposicion, frase = el$frase, rotulo = el$rotulo,
      pregunta_filtro = titulo_de(el$independiente %||% list(), ctx_f), pregunta_sub = titulo_de(el$dependiente %||% list(), ctx_s),
      plot_filtro = p_f, plot_sub = p_s,
      n_filtro = if (identical(espec_f$tipo, "pie")) espec_f$total_n_casos %||% espec_f$total_n else .espec_n_base(espec_f),
      # F2: en una batería la base es la de quienes la respondieron (la fila con más casos; cada pregunta trae los suyos).
      n_sub = if (identical(espec_s$tipo, "escala") && NROW(espec_s$filas) > 1L) suppressWarnings(max(.espec_casos(espec_s$filas), na.rm = TRUE))
              else .espec_n_base(espec_s)
    )
  }
  p
}
