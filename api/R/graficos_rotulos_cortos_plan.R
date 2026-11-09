# =============================================================================
# graficos_rotulos_cortos_plan.R — nombres cortos de pregunta para todo el mazo (ADR 0141, ROT-2)
# =============================================================================
#
# Gonzalo (2026-11-09): «tener en la UI cuáles son las etiquetas de variables y de opciones de variables más largas
# como un ranking y tener la posibilidad de plasmar un equivalente más reducido a cada una». Es de Gráficos: Analítica
# conserva su propia revisión de etiquetas para sus entregables, y este mapa no la lee ni la escribe.
#
# Forma de `plan$rotulos_cortos` (compatible con los planes guardados):
#   { "<rótulo completo de una opción>": "<corto>", ...,        # U3: tal como estaba (graficos_inclusivo.R)
#     "preguntas": { "<base>$<variable>": "<corto>", ... } }   # nuevo: nombre corto de la pregunta en todo el mazo
# La clave `preguntas` queda reservada: el mapa de opciones la salta.
#
# Precedencia del rótulo de una pregunta al dibujar (`.rotulos_preguntas_vigentes`, la consulta `.title_of_var`):
#   1. el «Nombre corto de la pregunta» de ESE gráfico (`overrides$etiquetas_vars`, reporte_plan_etiquetas_cortas.R);
#   2. `plan$rotulos_cortos$preguntas`;
#   3. el nombre corto que la pregunta tiene en otro gráfico del plan (E4, graficos_nombres_cortos_plan.R);
#   4. el enunciado del instrumento.
# Los niveles 2 y 3 viajan al render en el contexto del informe (`prosecnur.sig_informe`), como E4.

.ROTULOS_CORTOS_CLAVE_PREGUNTAS <- "preguntas"

#' Nombres cortos de pregunta del plan: lista nombrada `ref -> corto`, sin vacíos
#' @param rc `plan$rotulos_cortos`.
#' @keywords internal
.rotulos_cortos_preguntas <- function(rc) {
  m <- if (is.list(rc)) rc[[.ROTULOS_CORTOS_CLAVE_PREGUNTAS]] else NULL
  if (is.null(m) || !length(m) || is.null(names(m))) return(list())
  out <- list()
  for (k in names(m)) {
    v <- as.character(unlist(m[[k]]))[1]
    k <- trimws(k)
    if (nzchar(k) && length(v) && !is.na(v) && nzchar(trimws(v))) out[[k]] <- trimws(v)
  }
  out
}

#' Parte de opciones de `plan$rotulos_cortos` (rótulo completo -> corto), sin la clave reservada `preguntas`
#' @keywords internal
.rotulos_cortos_opciones <- function(rc) {
  if (is.list(rc)) {
    rc <- rc[setdiff(names(rc) %||% character(0), .ROTULOS_CORTOS_CLAVE_PREGUNTAS)]
    rc <- rc[!vapply(rc, is.list, logical(1))]
  } else if (is.character(rc) && !is.null(names(rc))) {
    rc <- rc[names(rc) != .ROTULOS_CORTOS_CLAVE_PREGUNTAS]
  } else {
    return(character(0))
  }
  m <- unlist(rc)
  if (!length(m) || is.null(names(m))) return(character(0))
  m <- m[nzchar(names(m)) & !is.na(m) & nzchar(m)]
  stats::setNames(as.character(m), names(m))
}

#' Un mapa `ref -> corto` resuelto para una base, en la forma de `labels_override` (clave = variable sin calificar)
#'
#' La calificada (`base$var`) gana a la suelta dentro del mismo mapa. Sin base conocida (`source` vacío) la calificada
#' vale sólo si todas las calificadas del mapa son de una misma base: en un estudio de una base eso es siempre así, y
#' en multibase una ref sin base no se adivina.
#' @keywords internal
.rotulos_mapa_para_base <- function(m, source = NULL) {
  if (!length(m) || is.null(names(m))) return(list())
  claves <- names(m)
  calificada <- grepl("$", claves, fixed = TRUE)
  out <- m[!calificada]
  src <- as.character(source %||% NA_character_)[1]
  if (is.na(src) || !nzchar(src)) {
    bases <- unique(sub("\\$.*$", "", claves[calificada]))
    src <- if (length(bases) == 1L) bases else NA_character_
  }
  if (!is.na(src) && nzchar(src) && any(calificada)) {
    de_esta <- calificada & startsWith(claves, paste0(src, "$"))
    if (any(de_esta)) out <- utils::modifyList(out, stats::setNames(m[de_esta], substring(claves[de_esta], nchar(src) + 2L)))
  }
  out
}

#' Rótulos vigentes de las preguntas de una base con los cuatro niveles de precedencia (ver cabecera)
#'
#' Resolvedor único: lo consulta `.title_of_var` (reporte_plan_ppt.R) y con él todo gráfico que rotula una pregunta
#' por su variable. Devuelve `NULL` si no hay ningún nombre corto (el rótulo sale del instrumento).
#' @keywords internal
.rotulos_preguntas_vigentes <- function(source = NULL) {
  ctx <- getOption("prosecnur.sig_informe", NULL) %||% list()
  e4 <- .rotulos_mapa_para_base(ctx[["nombres_cortos"]], source)
  plan <- .rotulos_mapa_para_base(ctx[["rotulos_preguntas"]], source)
  propias <- .plan_etiquetas_cortas_vigentes(source) %||% list()
  out <- utils::modifyList(utils::modifyList(e4, plan), propias)
  if (length(out)) out else NULL
}

#' Nombre corto de una ref en `plan$rotulos_cortos$preguntas` del contexto vigente (calificada > suelta), o NULL
#' @keywords internal
.rotulo_pregunta_del_plan <- function(ref) {
  m <- (getOption("prosecnur.sig_informe", NULL) %||% list())[["rotulos_preguntas"]]
  .rotulo_corto_buscar(m, ref)
}

#' Busca una ref en un mapa `ref -> corto` probando la ref tal cual, la calificada y la variable sola
#' @keywords internal
.rotulo_corto_buscar <- function(m, ref) {
  if (!length(m)) return(NULL)
  p <- .graficos_ref_parts(ref)
  for (k in unique(c(ref, if (nzchar(p$source %||% "")) paste0(p$source, "$", p$name), p$name))) {
    v <- m[[k]]
    if (!is.null(v) && nzchar(trimws(as.character(v)[1]))) return(trimws(as.character(v)[1]))
  }
  NULL
}

# --- Guardado validado (POST /api/graficos/rotulos) ------------------------------------------------------------------

#' Valida y aplica un pedido de nombres cortos sobre `plan$rotulos_cortos`
#'
#' @param actual `plan$rotulos_cortos` guardado.
#' @param pedido `list(preguntas = {ref: corto|null}, opciones = {rótulo: corto|null})`. Una sección presente reemplaza
#'   la guardada; una ausente se conserva. `null` quita la entrada.
#' @param originales_preguntas Función `ref -> enunciado` (NA si la ref no existe en ninguna base).
#' @return `list(rotulos_cortos, avisos)`: el mapa nuevo y las colisiones (aviso, no bloqueo).
#' @keywords internal
.rotulos_cortos_guardar <- function(actual, pedido, originales_preguntas) {
  if (!is.list(pedido) || !any(c("preguntas", "opciones") %in% names(pedido))) {
    stop_api(400, "E_BAD_JSON", "El cuerpo debe traer `preguntas` u `opciones`.")
  }
  preguntas <- .rotulos_cortos_preguntas(actual)
  opciones <- as.list(.rotulos_cortos_opciones(actual))
  if ("preguntas" %in% names(pedido)) {
    preguntas <- list()
    for (ref in names(pedido$preguntas %||% list())) {
      corto <- .rotulo_corto_validar(pedido$preguntas[[ref]], ref)
      if (is.null(corto)) next
      original <- originales_preguntas(ref)
      if (is.na(original)) {
        stop_api(400, "E_ROTULO_CORTO_REF", sprintf("La pregunta «%s» no está en ninguna base del estudio.", ref),
                 list(ref = ref))
      }
      .rotulo_corto_exigir_mas_corto(corto, original, ref)
      preguntas[[trimws(ref)]] <- corto
    }
  }
  if ("opciones" %in% names(pedido)) {
    opciones <- list()
    for (rot in names(pedido$opciones %||% list())) {
      corto <- .rotulo_corto_validar(pedido$opciones[[rot]], rot)
      if (is.null(corto)) next
      .rotulo_corto_exigir_mas_corto(corto, rot, rot)
      opciones[[rot]] <- corto
    }
  }
  out <- opciones
  if (length(preguntas)) out[[.ROTULOS_CORTOS_CLAVE_PREGUNTAS]] <- preguntas
  list(rotulos_cortos = if (length(out)) out else NULL, avisos = .rotulos_cortos_colisiones(preguntas, opciones))
}

#' Un corto pedido: NULL si se quita la entrada; 400 si viene vacío
#' @keywords internal
.rotulo_corto_validar <- function(x, clave) {
  if (is.null(x) || (is.list(x) && !length(x))) return(NULL)
  v <- as.character(unlist(x))[1]
  if (!length(v) || is.na(v) || !nzchar(trimws(v))) {
    stop_api(400, "E_ROTULO_CORTO_VACIO", sprintf("El rótulo corto de «%s» está vacío.", clave), list(clave = clave))
  }
  trimws(v)
}

#' 400 si el corto no es más corto que el original
#' @keywords internal
.rotulo_corto_exigir_mas_corto <- function(corto, original, clave) {
  if (nchar(corto) >= nchar(trimws(original))) {
    stop_api(400, "E_ROTULO_CORTO_NO_ACORTA",
             sprintf("El rótulo corto de «%s» debe ser más corto que el original (%d caracteres).", clave, nchar(trimws(original))),
             list(clave = clave, largo_original = nchar(trimws(original)), largo_corto = nchar(corto)))
  }
  invisible(TRUE)
}

#' Avisos de colisión: dos preguntas de una misma base, o dos opciones, con el mismo corto
#' @keywords internal
.rotulos_cortos_colisiones <- function(preguntas, opciones) {
  avisos <- list()
  norm <- function(x) tolower(gsub("\\s+", " ", trimws(x)))
  if (length(preguntas)) {
    refs <- names(preguntas)
    base <- ifelse(grepl("$", refs, fixed = TRUE), sub("\\$.*$", "", refs), "")
    for (b in unique(base)) {
      sel <- refs[base == b]
      cortos <- vapply(preguntas[sel], norm, "")
      for (c0 in unique(cortos[duplicated(cortos)])) {
        avisos[[length(avisos) + 1L]] <- list(tipo = "preguntas", base = b, corto = unname(preguntas[[sel[cortos == c0][1]]]),
                                              refs = as.list(sel[cortos == c0]))
      }
    }
  }
  if (length(opciones)) {
    cortos <- vapply(opciones, function(x) norm(as.character(x)[1]), "")
    for (c0 in unique(cortos[duplicated(cortos)])) {
      avisos[[length(avisos) + 1L]] <- list(tipo = "opciones", base = "", corto = as.character(opciones[[which(cortos == c0)[1]]])[1],
                                            refs = as.list(names(opciones)[cortos == c0]))
    }
  }
  avisos
}
