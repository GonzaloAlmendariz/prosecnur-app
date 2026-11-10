# =============================================================================
# graficos_dumbbell_grupos.R — la brecha entre dos grupos de una misma base
# =============================================================================
#
# G17 (Gonzalo, 2026-10-13: «el lollipop de brechas también era un gráfico bastante interesante»; elegido: «dos grupos
# de una base», como la lámina 250 del diseño, trabajadores frente a directivos). `p_dumbbell` comparaba sólo dos
# bases; con `cruce` y `grupos` compara dos grupos de una pregunta de la misma base, tema por tema. Los datos salen con
# la misma forma que los del radar entre públicos (`eje`, `grupo`, `valor`, `n`), así que el dibujo y la lámina nativa
# (88) son los mismos.

#' Datos de la brecha entre dos grupos
#'
#' @param temas Lista nombrada `etiqueta del tema -> ref` (una por tema, todas de la base del cruce).
#' @param corte Códigos de la escala que suman el indicador («3,4»).
#' @param cruce Ref `base$variable` de la pregunta que define los grupos.
#' @param grupos Los dos códigos del cruce, en orden: la brecha es el primero menos el segundo.
#' @param sources `list(data_sources, inst_sources)`.
#' @return `data.frame(eje, grupo, valor, n)`, una fila por (tema, grupo); `valor` en 0–100.
#' @keywords internal
.dumbbell_grupos_datos <- function(temas, corte, cruce, grupos, sources, filtros = list()) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos)) stop_api(400, "E_RADAR_SIN_CORTE", "La brecha necesita un indicador: al menos un código de la escala.")
  grupos <- as.character(unlist(grupos))
  # Dos grupos en el recetario; el contraste del resumen (ADR 0134) admite hasta cuatro (aperturas por ciclo).
  if (length(grupos) < 2L || length(grupos) > 4L || anyDuplicated(grupos)) {
    stop("dumbbell: `grupos` debe traer entre dos y cuatro códigos distintos del cruce.", call. = FALSE)
  }
  cx <- .graficos_consolidado_ref_context(cruce, sources)
  if (!isTRUE(cx$exists)) stop("dumbbell: la pregunta de cruce `", cruce, "` no existe en la base.", call. = FALSE)
  opciones <- .equiv_escala_opciones(cx$inst, cx$resolved_variable)
  cod_cruce <- vapply(opciones, function(o) as.character(o$codigo %||% "")[1], character(1))
  etq_cruce <- vapply(opciones, function(o) as.character(o$etiqueta %||% "")[1], character(1))
  faltan <- setdiff(grupos, cod_cruce)
  if (length(faltan)) stop(.dumbbell_grupos_explicar(cruce, grupos, cod_cruce, etq_cruce), call. = FALSE)
  etiquetas <- etq_cruce[match(grupos, cod_cruce)]
  etiquetas[!nzchar(etiquetas)] <- grupos[!nzchar(etiquetas)]

  datos <- (sources$data_sources %||% list())[[cx$source]]
  datos <- .apply_named_filters_safe(datos, filters = filtros, arg_name = "filtros de la brecha", mode = "strict")
  g <- trimws(as.character(datos[[cx$resolved_variable]]))
  pesos <- .radar_mb_pesos(datos)

  filas <- list()
  for (tema in names(temas)) {
    ref <- as.character(unlist(temas[[tema]]))[1]
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) stop("dumbbell: el tema `", tema, "` declara `", ref, "`, que no existe en la base.", call. = FALSE)
    if (!identical(ctx$source, cx$source)) {
      stop("dumbbell: el tema `", tema, "` está en la base `", ctx$source, "` y el cruce en `", cx$source,
           "`: los dos grupos se comparan dentro de una misma base.", call. = FALSE)
    }
    for (k in seq_along(grupos)) {
      dentro <- !is.na(g) & g == grupos[k]
      v <- datos[[ctx$resolved_variable]][dentro]
      m <- .radar_mb_pct(v, codigos, pesos = pesos[dentro])
      # L10-2: `n` es la suma de pesos (denominador del %); la leyenda escribe los casos que respondieron, sin ponderar.
      filas[[length(filas) + 1L]] <- data.frame(eje = tema, grupo = etiquetas[k], valor = m$valor, n = m$n,
                                                n_casos = .dumbbell_casos(v, pesos[dentro]), stringsAsFactors = FALSE)
    }
  }
  out <- do.call(rbind, filas)
  out$eje <- factor(out$eje, levels = names(temas))
  out$grupo <- factor(out$grupo, levels = etiquetas)
  rownames(out) <- NULL
  if (length(grupos) == 2L) attr(out, "dumbbell_colores") <- unname(.std_paleta("dicotomica"))[1:2]   # L10-3: pareja de marca para dos grupos de una base
  # El público que se abrió, para que la base diga «24 docentes de TC y 91 de TPA»; «default» no se nombra.
  if (nzchar(.base_nombre_visible(cx$source))) attr(out, "dumbbell_publico") <- .base_sufijo_de_fuente(cx$source)
  out
}

#' Casos sin ponderar que entran al porcentaje de un grupo: respuestas no vacías con peso positivo (el mismo filtro
#' que `.radar_mb_pct`, contando filas en vez de sumar pesos)
#' @keywords internal
.dumbbell_casos <- function(valores, pesos = NULL) {
  v <- as.character(valores)
  ok <- !is.na(v) & nzchar(trimws(v))
  if (!is.null(pesos)) { w <- suppressWarnings(as.numeric(pesos)); ok <- ok & is.finite(w) & w > 0 }
  sum(ok)
}

#' Temas de la brecha entre grupos: refs sueltas o lista nombrada de una ref por tema; sin nombre, la etiqueta de la
#' pregunta en el instrumento
#' @keywords internal
.dumbbell_grupos_temas <- function(vars, sources = NULL) {
  refs <- if (is.list(vars)) lapply(vars, function(x) as.character(unlist(x))[1]) else as.list(as.character(vars))
  nm <- names(refs) %||% rep("", length(refs))
  for (i in seq_along(refs)) {
    if (nzchar(trimws(nm[i]))) next
    lab <- if (!is.null(sources)) {
      ctx <- .graficos_consolidado_ref_context(refs[[i]], sources)
      sv <- ctx$survey
      if (isTRUE(ctx$exists) && is.data.frame(sv) && "label" %in% names(sv)) as.character(sv$label[[ctx$row_idx]]) else ""
    } else ""
    nm[i] <- if (!is.na(lab) && nzchar(trimws(lab))) trimws(lab) else sub("^.*\\$", "", refs[[i]])
  }
  stats::setNames(refs, make.unique(nm, sep = " "))
}

#' `p_dumbbell()` con `cruce`: una ref por tema, todas de una base, y los dos códigos de grupo
#' @keywords internal
.p_dumbbell_grupos <- function(vars, corte, corte_etiqueta, orden, mostrar_brecha, umbral_brecha_pct, titulo,
                               overrides, base, filtros, etiqueta_brecha, cruce, grupos, estilo = NULL, universos = NULL,
                               separar_tras = NULL, base_en = NULL, leyenda_con_n = NULL) {
  if (!nzchar(trimws(as.character(cruce)[1] %||% ""))) .plan_spec_abort("p_dumbbell(): elige la pregunta que define los grupos.")
  refs <- if (is.list(vars)) vapply(vars, function(x) as.character(unlist(x))[1], character(1)) else as.character(vars)
  if (!length(refs) || any(is.na(refs) | !nzchar(trimws(refs)))) {
    .plan_spec_abort("p_dumbbell(): con `cruce`, `vars` debe traer al menos una pregunta.")
  }
  if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_dumbbell(): `corte` debe traer al menos un codigo de la escala.")
  grupos <- trimws(as.character(unlist(grupos)))
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  ov <- .dumbbell_slot_overrides(overrides, orden, mostrar_brecha, umbral_brecha_pct, etiqueta_brecha)   # O7c
  ov <- .dumbbell_resumen_overrides(ov, estilo, universos, separar_tras, base_en, leyenda_con_n)
  # Hasta cuatro grupos en los dos estilos: con tres o cuatro el recetario se dibuja como el contraste del resumen
  # (graficos_dumbbell_tres_grupos.R).
  tope <- .DUMBBELL_GRUPOS_MAX
  if (length(grupos) < 2L || length(grupos) > tope || anyDuplicated(grupos) || any(!nzchar(grupos))) {
    .plan_spec_abort("p_dumbbell(): `grupos` debe traer entre dos y cuatro grupos del cruce.")
  }
  el <- list(
    .element_type = "dumbbell",
    var = NULL,
    vars = if (is.list(vars) && !is.null(names(vars))) vars else as.list(refs),
    cruce = trimws(as.character(cruce)[1]),
    grupos = grupos,
    corte = paste(as.character(unlist(corte)), collapse = ","),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Los args del contraste del resumen (ADR 0134) en los overrides de la lámina: sólo lo que el slot declara (O7c)
#' @keywords internal
.dumbbell_resumen_overrides <- function(ov, estilo = NULL, universos = NULL, separar_tras = NULL, base_en = NULL, leyenda_con_n = NULL) {
  ov <- .ppt_slot_override(ov, "estilo", estilo, "opcion", opciones = c("recetario", "resumen"))
  ov <- .ppt_slot_override(ov, "leyenda_con_n", leyenda_con_n, "bool")   # "N en la leyenda" (graficos_dumbbell_tres_grupos.R)
  ov <- .ppt_slot_override(ov, "base_en", base_en, "opcion", opciones = c("auto", "tabla", "leyenda", "nota"))
  if (!is.null(universos) && length(universos)) ov$universos <- universos
  sep <- suppressWarnings(as.integer(unlist(separar_tras)))
  sep <- sort(unique(sep[is.finite(sep) & sep >= 1L]))   # 0 = sin separador
  if (length(sep)) ov$separar_tras <- sep
  ov
}

#' Por qué los `grupos` de las aperturas no sirven, en el idioma del argumento: `grupos` lleva códigos ("1", "2"), así que
#' el mensaje dice el código y su etiqueta (catálogo, ronda 3: decía "no tiene los grupos Mujer, Hombre" a quien había
#' escrito etiquetas, sin decirle qué código era cada una)
#' @param cod,etq Códigos y etiquetas de las opciones del cruce.
#' @keywords internal
.dumbbell_grupos_explicar <- function(cruce, grupos, cod, etq) {
  grupos <- as.character(unlist(grupos)); grupos <- grupos[!is.na(grupos)]
  q <- function(x) paste0('"', x, '"')
  disponibles <- paste(sprintf("%s = %s", q(cod), etq), collapse = ", ")
  partes <- character(0)
  if (length(grupos) < 2L || length(grupos) > 4L || anyDuplicated(grupos)) {
    partes <- c(partes, sprintf("las aperturas comparan entre dos y cuatro grupos distintos y llegaron %d", length(unique(grupos))))
  }
  for (g in setdiff(grupos, cod)) {
    k <- match(.lam_clave(g), .lam_clave(etq))
    partes <- c(partes, if (!is.na(k)) sprintf("%s es la etiqueta del código %s", q(g), q(cod[k])) else sprintf("%s no es un código del cruce", q(g)))
  }
  # Sin nombres internos (`grupos`, la referencia base$variable): el aviso los descarta como jerga y el analista no vería el motivo.
  sprintf("Aperturas por grupo: %s. Los grupos se eligen por su código: %s.", paste(partes, collapse = "; "), disponibles)
}

#' El constructor de `p_dumbbell` desde el plan: un `grupos` que no sirve degrada sólo su lámina (catálogo, ronda 3)
#'
#' Antes el error de `.p_dumbbell_grupos` ("`grupos` debe traer entre dos y cuatro grupos del cruce") cortaba el informe
#' entero al armar el plan. Aquí la lámina queda con un elemento que falla al dibujarse, con el motivo en código y
#' etiqueta: la lámina sale con "Sin datos" y su aviso, como cualquier gráfico que no se puede dibujar, y el resto sale.
#' Quien llama a `p_dumbbell()` directamente sigue recibiendo el error del constructor.
#' @keywords internal
.dumbbell_construir_desde_plan <- function(fn, args, graficador_name) {
  cruce <- trimws(as.character(unlist(args$cruce %||% ""))[1])
  if (!identical(graficador_name, "p_dumbbell") || is.na(cruce) || !nzchar(cruce)) return(do.call(fn, args))
  tryCatch(do.call(fn, args), pulso_plan_spec_error = function(e) {
    if (!grepl("grupos", conditionMessage(e), fixed = TRUE)) stop(e)
    el <- list(.element_type = "dumbbell_grupos_invalidos", var = NULL, cruce = cruce, grupos = as.character(unlist(args$grupos %||% character(0))),
               mensaje = conditionMessage(e), overrides = list(), base = list(), filtros = list())
    class(el) <- c("ppt_element", "list")
    el
  })
}

#' Renderer del elemento de `grupos` que no sirven: falla con el motivo en código y etiqueta (la lámina se degrada sola)
#' @keywords internal
.render_dumbbell_grupos_invalidos <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  cx <- tryCatch(.graficos_consolidado_ref_context(el$cruce, list(data_sources = data_sources, inst_sources = inst_sources)), error = function(e) NULL)
  if (is.null(cx) || !isTRUE(cx$exists)) stop("Aperturas por grupo: la pregunta de cruce \"", el$cruce, "\" no existe en la base.", call. = FALSE)
  op <- .equiv_escala_opciones(cx$inst, cx$resolved_variable)
  .dumbbell_grupos_fallar(.dumbbell_grupos_explicar(el$cruce, el$grupos, vapply(op, function(o) as.character(o$codigo %||% "")[1], ""),
                                                   vapply(op, function(o) as.character(o$etiqueta %||% "")[1], "")))
}

#' Antes de la regla de preguntas, las aperturas comprueban que sus `grupos` sean códigos del cruce (si no, la regla fallaba
#' antes con "la lámina no tiene grupos" y el analista no sabía qué corregir)
#' @keywords internal
.dumbbell_grupos_validar_render <- function(el, sources) {
  if (is.null(el$cruce) || !nzchar(trimws(as.character(el$cruce)[1]))) return(invisible(TRUE))
  cx <- .graficos_consolidado_ref_context(el$cruce, sources)
  if (!isTRUE(cx$exists)) return(invisible(TRUE))   # lo dice `.dumbbell_grupos_datos`
  op <- .equiv_escala_opciones(cx$inst, cx$resolved_variable)
  cod <- vapply(op, function(o) as.character(o$codigo %||% "")[1], ""); etq <- vapply(op, function(o) as.character(o$etiqueta %||% "")[1], "")
  g <- as.character(unlist(el$grupos))
  if (length(g) < 2L || length(g) > 4L || anyDuplicated(g) || length(setdiff(g, cod))) .dumbbell_grupos_fallar(.dumbbell_grupos_explicar(el$cruce, g, cod, etq))
  invisible(TRUE)
}

#' La lámina de aperturas no se dibuja: el motivo va al aviso de la lámina (el aviso genérico de un render que falla
#' descarta el motivo por traer nombres internos) y el error degrada sólo esa lámina
#' @keywords internal
.dumbbell_grupos_fallar <- function(msg) {
  .pulso_aviso(.aviso_en_lamina(msg))
  stop(msg, call. = FALSE)
}

