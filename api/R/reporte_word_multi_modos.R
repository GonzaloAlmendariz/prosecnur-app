# =============================================================================
# reporte_word_multi_modos.R — cuántas figuras Word sale de una multiapilada (W6, decisión D6)
# =============================================================================
#
# D6 (Gonzalo, checklist-revamp-informe-graficos-2026-10-14): la multiapilada del Word se elige por lámina, con un valor
# del informe debajo. El slot declara `word_multiapiladas` (argumento de `p_barras_multiapiladas()`) y el informe
# `w_presets$chart_options$multiapiladas_word`; el slot manda.
#
# N8b + criterio B (usuario, 2026-10-22): si NINGUNO dice nada rige el criterio B (`.WORD_MULTI_MODO_DEFAULT`,
# reporte_word_publico_barra.R): una figura por premisa; la misma premisa con varios actores, una fila por actor; un solo
# actor repetido en varias premisas con la misma escala, una batería con los enunciados en el eje Y (tramos de hasta 6
# barras). La partición del PPT (`partes`, reporte_word_particion_ppt.R) es el tope de agrupación (R0). «automatico»
# EXPLÍCITO en el informe es el corte de antes: `var_cruce` una figura por tema y `var` una por barra.
# `un_grafico_mismo_actor` (N8) es alias del default. La lámina del PPT no cambia.
#
#   un_grafico — la multiapilada entera en UNA figura, como la lámina. En `var_cruce` los temas van dentro de la figura
#                con su rótulo (la escala Word los dibuja: `.word_escala_grupos()`).
#   por_tema   — una figura por tema. En `var` hay un solo tema: una figura con todas las barras.
#   por_barra  — una figura por barra. En `var_cruce` con temas nombrados, una por variable de cada tema, con el título
#                del tema y el de la barra.
#
# En «Combinar bloques» (multilista) el valor del slot vale para cada bloque, y `un_grafico` deja cada bloque entero en
# su figura: la escala Word dibuja una sola escala por figura y los bloques pueden traer escalas distintas.
# `reporte_plan_ppt.R` está congelado a crecimiento: el closure `.split_multi_block` sólo recorre estas piezas.

#' Modos válidos de la multiapilada en el Word
#' @keywords internal
.WORD_MULTI_MODOS <- c("un_grafico", "por_tema", "por_barra")

#' Nombre interno del criterio por defecto: mismo conjunto de actores y misma escala (N8b)
#' @keywords internal
.WORD_MULTI_MODO_DEFAULT <- "mismo_actor_escala"

#' ¿Este modo resuelto es el criterio «mismo actor y misma escala»? (el default y su alias `un_grafico_mismo_actor`)
#' @keywords internal
.word_multi_es_actor_escala <- function(modo) {
  length(modo) == 1L && !is.na(modo) && modo %in% c(.WORD_MULTI_MODO_DEFAULT, "un_grafico_mismo_actor")
}

#' Normaliza un modo Word de multiapilada: vacío es «sin decidir» (NULL), uno inválido es 400
#'
#' @param x Valor del slot o del informe.
#' @param origen Texto para el mensaje («la lámina», «el informe»).
#' @param admite_automatico En el informe, «automatico» es válido y significa el corte de antes (N8b); vacío es «sin
#'   decidir» y rige el criterio por defecto.
#' @return Uno de `.WORD_MULTI_MODOS`, «automatico» (sólo informe) o NULL.
#' @keywords internal
.word_multi_modo_normalizar <- function(x, origen = "la lámina", admite_automatico = FALSE) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  if (length(x) != 1L) .plan_spec_abort("El modo Word de las multiapiladas de ", origen, " debe ser un solo valor.")
  if (is.na(x)) return(NULL)
  v <- trimws(as.character(x))
  if (!nzchar(v)) return(NULL)
  if (isTRUE(admite_automatico) && identical(v, "automatico")) return("automatico")   # explícito: el corte de antes (N8b)
  validos <- c(.WORD_MULTI_MODOS, if (isTRUE(admite_automatico)) c("un_grafico_mismo_publico", "un_grafico_mismo_actor", .WORD_MULTI_MODO_DEFAULT))   # estos, sólo el informe (reporte_word_publico_barra.R)
  if (!v %in% validos) {
    .plan_spec_abort("El modo Word de las multiapiladas de ", origen, " es «", v, "»; los válidos son ",
                     paste(validos, collapse = ", "), ".")
  }
  v
}

#' Modo Word de un elemento multiapilado: el del slot, si no el del informe, si no el criterio por defecto (N8b)
#' @param el Elemento `barras_multiapiladas` (el de la lámina; en multilista, el padre).
#' @param presets Presets PPT del render; el informe lo sella `.apply_word_chart_presets()` en `base$args`.
#' @keywords internal
.word_multi_modo_resolver <- function(el, presets = NULL) {
  slot <- .word_multi_modo_normalizar((el %||% list())[["word_multiapiladas", exact = TRUE]], "la lámina")
  args_base <- ((presets %||% list())$base %||% list())$args %||% list()
  informe <- .word_multi_modo_normalizar(args_base[["word_multiapiladas", exact = TRUE]], "el informe", admite_automatico = TRUE)
  slot %||% informe %||% .WORD_MULTI_MODO_DEFAULT
}

#' Marca de «sin título» de una figura única: `.push_multi_block` (congelado) trata un título vacío como «usa el de la
#' lámina», así que la figura sin título viaja con un espacio duro, que se ve en blanco y no se infiere de nada.
#' @keywords internal
.WORD_TITULO_VACIO <- "\u00A0"

#' Título declarado de la figura única (`word_titulo_figura` del slot): texto limpio o NULL
#' @keywords internal
.word_titulo_figura_normalizar <- function(x) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  if (length(x) != 1L) .plan_spec_abort("El título de la figura Word debe ser un solo texto.")
  if (is.na(x)) return(NULL)
  v <- trimws(as.character(x))
  if (nzchar(v)) v else NULL
}

#' Pieza de la figura única de un `var`: el título que el analista declaró o, si no, ninguno (nunca el de la lámina)
#' @keywords internal
.word_multi_pieza_unica <- function(sub) {
  list(sub = sub, titulo = .word_titulo_figura_normalizar(sub$word_titulo_figura) %||% .WORD_TITULO_VACIO)
}

#' Rótulo de una variable para el título Word: el título de la pregunta o, si falta, la referencia
#' @keywords internal
.word_multi_rotulo_var <- function(v, titulo_var) {
  t <- tryCatch(titulo_var(v), error = function(e) v)
  if (is.null(t) || !length(t) || is.na(as.character(t)[1]) || !nzchar(trimws(as.character(t)[1]))) t <- v
  t
}

#' Rótulo de una barra de un tema nombrado: el público si la referencia es `fuente$variable` (como la fila del gráfico,
#' `.pretty_source_label`), si no el título de la variable
#' @keywords internal
.word_multi_rotulo_barra <- function(ref, titulo_var) {
  m <- regmatches(ref, regexec("^([^$]+)\\$(.+)$", ref, perl = TRUE))[[1]]
  if (length(m) == 3L) {
    src <- gsub("_+", " ", trimws(m[2]))
    if (nzchar(src)) return(tools::toTitleCase(src))
  }
  .word_multi_rotulo_var(ref, titulo_var)
}

#' Piezas Word de un bloque multiapilado: cada una es una figura con su sub-bloque y su título
#'
#' @param block_data Bloque (`var`, `var_cruce`, `cruce`) ya saneado.
#' @param modo_word `.WORD_MULTI_MODO_DEFAULT`, «automatico» o uno de `.WORD_MULTI_MODOS`.
#' @param escala_de Función ref -> firma de la escala (lista de categorías) o NULL (sin firma: todas iguales).
#' @param titulo_var Función ref -> título de la variable (`.title_of_var` del plan).
#' @return Lista de `list(sub, titulo)`; `titulo` NULL deja que el plan use el título de la lámina
#'   (`.word_title_for_element`).
#' @keywords internal
.word_multi_piezas <- function(block_data, modo_word = "automatico", titulo_var = identity, escala_de = NULL, partes = NULL) {
  force(partes)
  modo_b <- block_data$modo %||% "var"
  lam <- block_data$title_slide
  pieza <- function(sub, titulo = NULL) list(sub = sub, titulo = titulo)
  entero <- function(con_grupos = FALSE) {
    sub <- block_data
    if (isTRUE(con_grupos)) sub$.word_con_grupos <- TRUE   # `.word_preparar_block_multi` deja la columna de temas
    list(pieza(sub))
  }
  sin_grupo <- function(vars) { sub <- block_data; sub$vars <- vars; sub$titulos_grupo <- NULL; sub }

  if (identical(modo_b, "var_cruce")) {
    vars_list <- block_data$vars %||% list()
    titulos_grupo <- block_data$titulos_grupo %||% list()
    if (identical(modo_word, "un_grafico")) return(entero(con_grupos = length(vars_list) > 1L))
    if (.word_multi_es_actor_escala(modo_word) && is.list(vars_list)) return(.word_criterio_piezas(block_data, titulo_var, escala_de, partes))   # criterio B (default)
    if (identical(modo_word, "automatico")) {   # el corte de siempre, tal cual (W-7/B54)
      return(lapply(names(vars_list), function(nm) {
        pieza(sin_grupo(vars_list[nm]), .word_titulo_bloque_multi(lam, titulos_grupo[[nm]] %||% nm))
      }))
    }
    if (is.character(vars_list)) {   # incluye el default sobre un cruce: sus variables abiertas no se agrupan
      # Temas = variables abiertas por el mismo cruce: sus barras son los grupos del cruce y no se separan.
      tit <- function(v) {
        tg <- if (!is.null(names(titulos_grupo)) && v %in% names(titulos_grupo)) titulos_grupo[[v]] else NULL
        tg %||% .word_multi_rotulo_var(v, titulo_var)
      }
      return(lapply(vars_list, function(v) pieza(sin_grupo(v), .word_titulo_bloque_multi(lam, tit(v)))))
    }
    titulo_tema <- function(nm) if (!is.null(names(titulos_grupo)) && nm %in% names(titulos_grupo)) titulos_grupo[[nm]] else nm
    if (identical(modo_word, "por_tema")) {
      return(lapply(names(vars_list), function(nm) pieza(sin_grupo(vars_list[nm]), .word_titulo_bloque_multi(lam, titulo_tema(nm)))))
    }
    out <- list()
    for (nm in names(vars_list)) {
      for (ref in as.character(unlist(vars_list[[nm]], use.names = FALSE))) {
        tema_barra <- .word_titulo_bloque_multi(titulo_tema(nm), .word_multi_rotulo_barra(ref, titulo_var))
        out[[length(out) + 1L]] <- pieza(sin_grupo(stats::setNames(list(ref), nm)), .word_titulo_bloque_multi(lam, tema_barra))
      }
    }
    return(out)
  }

  if (identical(modo_b, "var")) {
    if (.word_multi_es_actor_escala(modo_word)) return(.word_criterio_piezas(block_data, titulo_var, escala_de, partes))   # criterio B (default)
    if (identical(modo_word, .WORD_MULTI_MODO_MISMO_PUBLICO)) return(.word_publico_piezas_var(block_data, titulo_var))
    if (identical(modo_word, "un_grafico")) return(list(.word_multi_pieza_unica(block_data)))   # D-b: título declarado o ninguno
    if (identical(modo_word, "por_tema")) return(entero())
    vars_vec <- block_data$vars %||% character(0)
    if (is.list(vars_vec)) vars_vec <- unlist(vars_vec, use.names = FALSE)
    return(lapply(vars_vec, function(v) pieza(sin_grupo(v), .word_titulo_bloque_multi(lam, .word_multi_rotulo_var(v, titulo_var)))))
  }

  entero()   # `cruce` y modos sin corte: un solo tema con sus barras, como siempre
}

#' 400 antes de encolar el Word: modo de multiapiladas inválido en el informe o en alguna lámina
#'
#' El worker repite la validación (constructor y `.apply_word_chart_presets`), pero ahí el error llega como fallo del
#' job; aquí es la respuesta HTTP del POST.
#' @param plan Plan normalizado (`slides[[i]]$payload[[slot]]$args`).
#' @param w_presets `w_presets` efectivos (lo guardado con el body encima).
#' @keywords internal
.word_multi_validar_export <- function(plan, w_presets) {
  opciones <- (w_presets %||% list())$chart_options %||% list()
  .word_multi_modo_normalizar(opciones[["multiapiladas_word", exact = TRUE]], "el informe", admite_automatico = TRUE)
  for (s in (plan %||% list())$slides %||% list()) {
    payload <- (as.list(s))$payload
    if (!is.list(payload)) next
    for (slot in payload) {
      if (!is.list(slot) || !is.list(slot$args)) next
      .word_multi_modo_normalizar(slot$args[["word_multiapiladas", exact = TRUE]], "la lámina")
    }
  }
  invisible(TRUE)
}

#' Rótulos de tema de la escala Word cuando la figura lleva varios temas («Un gráfico» de un `var_cruce`)
#'
#' Cada tema abre con su enunciado en una línea propia, alineado al borde izquierdo de la figura, y sus barras debajo:
#' es la columna de temas de la lámina puesta en vertical, porque el ancho del Word no alcanza para ella. Con menos de
#' dos temas devuelve NULL y la escala sale como siempre.
#' @param F Filas de la espec ya ordenadas (`grupo_id`, `grupo_titulo`).
#' @param esp Alto de cada fila en unidades del eje y.
#' @param envolver Caracteres por línea del rótulo de tema.
#' @return NULL o `list(ys, tot, cabeceras = data.frame(y, texto))`.
#' @keywords internal
.word_escala_grupos <- function(F, esp, envolver = 80) {
  gid <- as.character(F$grupo_id %||% rep(NA_character_, NROW(F)))
  if (!NROW(F) || all(is.na(gid)) || length(unique(gid[!is.na(gid)])) < 2L) return(NULL)
  inicio <- c(TRUE, vapply(seq_along(gid)[-1], function(i) !identical(gid[i], gid[i - 1L]), logical(1)))
  tit <- as.character(F$grupo_titulo %||% gid)
  tit <- ifelse(is.na(tit) | !nzchar(trimws(tit)), gid, tit)
  tit[is.na(tit)] <- ""
  txt <- vapply(tit, function(r) paste(strwrap(r, width = envolver), collapse = "\n"), "", USE.NAMES = FALSE)
  con <- inicio & nzchar(txt)
  nl <- vapply(strsplit(txt, "\n"), function(x) max(1L, length(x)), 1L)
  alto <- ifelse(con, 0.35 + 0.34 * nl, 0)
  h <- as.vector(rbind(alto, esp))   # cabecera del tema (alto 0 si no abre tema) y su fila, de arriba abajo
  tot <- sum(h)
  centro <- tot - (cumsum(h) - h / 2) + 0.5
  y_cab <- centro[c(TRUE, FALSE)]
  list(ys = centro[c(FALSE, TRUE)], tot = tot,
       cabeceras = data.frame(y = y_cab[con], texto = txt[con], stringsAsFactors = FALSE))
}
