# =============================================================================
# reporte_word_publico_barra.R — valor del informe `un_grafico_mismo_publico` (F2, Renzo/Arte 2026-10-22)
# =============================================================================
#
# `w_presets$chart_options$multiapiladas_word = "un_grafico_mismo_publico"` (sólo el informe; la lámina no lo admite):
#   - un bloque `modo = var` cuyas variables salen de UNA sola fuente/público: una sola figura, como `un_grafico`;
#   - un bloque `var` de varias fuentes: una figura por barra, como «automatico», pero con el título de la variable
#     (sin antepuesto de la lámina) y con el público rotulado al costado de la barra;
#   - `var_cruce`, `cruce` y todo lo demás: como «automatico».
# El slot por lámina (`word_multiapiladas`) sigue mandando: con un valor de lámina no se llega aquí.
# `reporte_plan_ppt.R` está congelado a crecimiento: sólo llama a `.word_publico_barra_rotulo()`.

#' Valor del informe que activa este comportamiento
#' @keywords internal
.WORD_MULTI_MODO_MISMO_PUBLICO <- "un_grafico_mismo_publico"

#' Fuente (público) de una referencia `fuente$variable`; "" si no está calificada
#' @keywords internal
.word_publico_fuente <- function(ref) {
  m <- regmatches(ref, regexec("^([^$]+)\\$(.+)$", ref, perl = TRUE))[[1]]
  if (length(m) == 3L) trimws(m[2]) else ""
}

#' ¿Todas las variables del bloque `var` salen de una sola fuente?
#' @param vars Vector o lista de referencias.
#' @keywords internal
.word_publico_mono_fuente <- function(vars) {
  refs <- as.character(unlist(vars, use.names = FALSE))
  length(refs) > 0L && length(unique(vapply(refs, .word_publico_fuente, ""))) == 1L
}

#' Piezas Word de un bloque `var` bajo `un_grafico_mismo_publico`
#' @inheritParams .word_multi_piezas
#' @return Lista de `list(sub, titulo)`.
#' @keywords internal
.word_publico_piezas_var <- function(block_data, titulo_var = identity) {
  vars_vec <- block_data$vars %||% character(0)
  if (is.list(vars_vec)) vars_vec <- unlist(vars_vec, use.names = FALSE)
  if (.word_publico_mono_fuente(vars_vec)) return(list(.word_multi_pieza_unica(block_data)))   # D-b: título declarado o ninguno
  lapply(vars_vec, function(v) {
    sub <- block_data
    sub$vars <- v
    sub$titulos_grupo <- NULL
    sub$.word_rotular_publico <- nzchar(.word_publico_fuente(v))
    list(sub = sub, titulo = .word_multi_rotulo_var(v, titulo_var))
  })
}

#' Rótulo del público para la fila de una figura `var` de una variable; NULL si no aplica
#' @param el Bloque ya preparado para el Word.
#' @param source Fuente resuelta de la variable.
#' @keywords internal
.word_publico_barra_rotulo <- function(el, source) {
  if (!isTRUE(el$.word_rotular_publico)) return(NULL)
  s <- gsub("_+", " ", trimws(as.character(source %||% "")[1]))
  if (is.na(s) || !nzchar(s)) return(NULL)
  tools::toTitleCase(s)
}

# =============================================================================
# Criterio B por defecto del Word (usuario, 2026-10-22; reemplaza al «mismo actor y misma escala» de N8/N8b)
# =============================================================================
#
# «Variante A pero si hay un solo actor, uno solo que se repite varias veces con la misma escala, el eje y puede ser la
# premisa y formar un solo gráfico». Rige cuando ni el slot ni el informe dicen nada (`.WORD_MULTI_MODO_DEFAULT`);
# `un_grafico_mismo_actor` es su alias. Sólo el Word; el PPT no cambia. Una FIGURA es:
#   C1 la misma escala (una figura nunca lleva dos leyendas; si el Word separa por escala, avisa);
#   C2 una premisa (un mismo enunciado) con sus actores: una fila por actor, aunque venga en temas o bloques distintos;
#   C3 premisas distintas con varios actores: una figura por premisa;
#   C4 un solo actor repetido en varias premisas con la misma escala: una batería, con los enunciados en el eje Y, sin
#      rótulo de actor y con una sola leyenda (estilo Gráfico 37), en tramos de hasta 6 barras (reparto equilibrado);
#   C5 título: la figura de una premisa lleva su enunciado (sin antepuesto de lámina); la batería, el `word_titulo_figura`
#      declarado o ninguno (D-b).
# R0: la partición del PPT (`.word_particion_ppt`, reporte_word_particion_ppt.R) es el tope: una figura nunca cruza el corte
# de una lámina del PPT; puede ser más fina. No se reordena ni se omite nada: temas, barras, conteos y bases son los de siempre.

#' Valor del informe que activa el criterio «mismo actor» (N8; alias del default de N8b)
#' @keywords internal
.WORD_MULTI_MODO_MISMO_ACTOR <- "un_grafico_mismo_actor"

#' Firma de la escala de una referencia para el Word: sus categorías normalizadas, o NA si no se resuelve
#'
#' `reporte_ppt_plan` pasa su `.choice_signature_from_ctx_norm` (la misma equivalencia con que la lámina decide que dos
#' fuentes comparten escala); aquí sólo se protege la resolución para que una referencia irresoluble no tumbe el corte.
#' @param ref Referencia `fuente$variable` o `variable`.
#' @param resolver Función ref -> contexto de la fuente (`.resolve_ref`).
#' @param firma Función contexto -> firma (`.choice_signature_from_ctx_norm`).
#' @keywords internal
.word_multi_escala_firma <- function(ref, resolver, firma) {
  tryCatch(as.character(firma(resolver(ref), sin_especiales = TRUE))[1], error = function(e) NA_character_)
}

#' Una multilista pasa el título de figura declarado en la lámina a cada bloque que no declara el suyo
#' @keywords internal
.word_multi_bloque_hereda <- function(block, el) {
  if (is.list(block) && is.null(block$word_titulo_figura) && !is.null(el$word_titulo_figura)) block$word_titulo_figura <- el$word_titulo_figura
  block
}

#' Clave del conjunto de actores de un tema (fuentes de sus referencias, sin orden ni repetidos)
#' @keywords internal
.word_actor_clave <- function(refs) {
  refs <- as.character(unlist(refs, use.names = FALSE))
  paste(sort(unique(vapply(refs, .word_publico_fuente, ""))), collapse = "\u001f")
}

#' Clave de la escala de un tema: las firmas distintas de sus referencias («» sin `escala_de`; NA no distingue)
#' @keywords internal
.word_escala_clave <- function(refs, escala_de = NULL) {
  if (is.null(escala_de)) return("")
  refs <- as.character(unlist(refs, use.names = FALSE))
  f <- vapply(refs, function(r) as.character(escala_de(r))[1], "", USE.NAMES = FALSE)
  paste(sort(unique(f[!is.na(f)])), collapse = "\u001e")
}


#' Elementos del bloque para el criterio B: un tema (`var_cruce`) o una barra (`var`), con su enunciado, actores y escala
#' @return Lista de `list(id, texto, refs, actores, escala)` en el orden del plan.
#' @keywords internal
.word_criterio_items <- function(block_data, titulo_var = identity, escala_de = NULL) {
  mk <- function(id, texto, refs) list(id = id, texto = texto, refs = refs,
                                       actores = unique(vapply(refs, .word_publico_fuente, "")),
                                       escala = .word_escala_clave(refs, escala_de))
  if (identical(block_data$modo, "var_cruce")) {
    vars_list <- block_data$vars %||% list()
    tg <- block_data$titulos_grupo
    return(lapply(names(vars_list), function(nm) {
      texto <- (if (!is.null(names(tg)) && nm %in% names(tg)) as.character(tg[[nm]])[1] else NULL) %||% nm
      mk(nm, texto, as.character(unlist(vars_list[[nm]], use.names = FALSE)))
    }))
  }
  refs <- block_data$vars %||% character(0)
  if (is.list(refs)) refs <- unlist(refs, use.names = FALSE)
  lapply(as.character(refs), function(r) mk("", .word_multi_rotulo_var(r, titulo_var), r))
}

#' Premisas consecutivas: elementos con el mismo enunciado y actores que no se repiten (C2)
#' @return Lista de vectores de índices de `items`.
#' @keywords internal
.word_criterio_premisas <- function(items) {
  grupos <- list(); actual <- integer(0); actores <- character(0)
  for (i in seq_along(items)) {
    it <- items[[i]]
    junta <- length(actual) > 0L &&
      identical(.word_enunciado_norm(items[[actual[1]]]$texto), .word_enunciado_norm(it$texto)) &&
      !length(intersect(actores, it$actores))
    if (junta) { actual <- c(actual, i); actores <- c(actores, it$actores) }
    else { if (length(actual)) grupos[[length(grupos) + 1L]] <- actual; actual <- i; actores <- it$actores }
  }
  if (length(actual)) grupos[[length(grupos) + 1L]] <- actual
  grupos
}

#' Tramos de una batería: hasta `.MULTIAPILADAS_MAX_BARRAS` barras, reparto equilibrado (7 = 3 + 4)
#' @keywords internal
.word_criterio_tramos <- function(n, tope = .MULTIAPILADAS_MAX_BARRAS) {
  k <- ceiling(n / tope); base <- n %/% k; extra <- n %% k
  tam <- c(rep(base, k - extra), rep(base + 1L, extra))
  unname(split(seq_len(n), rep(seq_len(k), tam)))
}

.word_criterio_recortar <- function(x, n = 70L) if (nchar(x) > n) paste0(substr(x, 1L, n - 1L), "…") else x

#' Piezas Word de un bloque `var_cruce` o `var` bajo el criterio B (el default)
#'
#' @inheritParams .word_multi_piezas
#' @param partes Partición del PPT (`.word_particion_ppt()`, ya filtrada a este bloque) o NULL.
#' @return Lista de `list(sub, titulo)`. Avisa (`.pulso_aviso`) cuando separa por escala o una batería pasa de 6 barras.
#' @keywords internal
.word_criterio_piezas <- function(block_data, titulo_var = identity, escala_de = NULL, partes = NULL) {
  items <- .word_criterio_items(block_data, titulo_var, escala_de)
  n <- length(items)
  if (!n) return(list())
  es_cruce <- identical(block_data$modo, "var_cruce")
  lam <- block_data$title_slide
  parte <- .word_parte_de(vapply(items, `[[`, "", "id"), vapply(items, `[[`, "", "texto"), partes) %||% rep(1L, n)
  esc <- vapply(items, `[[`, "", "escala")
  corte_escala <- which(esc[-1L] != esc[-n] & parte[-1L] == parte[-n])
  if (length(corte_escala)) {
    i <- corte_escala[1L]
    .pulso_aviso(.aviso_en_lamina(sprintf(
      "el Word separó «%s» de «%s» en figuras distintas: no comparten escala de respuesta y una figura lleva una sola leyenda%s.",
      .word_criterio_recortar(items[[i]]$texto), .word_criterio_recortar(items[[i + 1L]]$texto),
      if (length(corte_escala) > 1L) sprintf(" (y %d corte(s) más por escala)", length(corte_escala) - 1L) else "")))
  }
  corrida <- cumsum(c(TRUE, esc[-1L] != esc[-n] | parte[-1L] != parte[-n]))
  fuentes_bloque <- unique(unlist(lapply(items, `[[`, "actores"), use.names = FALSE))
  titulo_declarado <- .word_titulo_figura_normalizar(block_data$word_titulo_figura) %||% .WORD_TITULO_VACIO   # D-b
  tema_titulo <- function(it) it$texto
  una_premisa <- function(its) {   # C2/C3/C5: una premisa con sus actores, titulada con su enunciado
    sub <- block_data
    refs <- unlist(lapply(its, `[[`, "refs"), use.names = FALSE)
    if (es_cruce) {
      sub$vars <- stats::setNames(list(refs), its[[1]]$id)
    } else {
      sub$vars <- refs
      sub$.word_rotular_publico <- length(fuentes_bloque) > 1L && any(nzchar(vapply(refs, .word_publico_fuente, "")))
    }
    sub$titulos_grupo <- NULL
    list(sub = sub, titulo = .word_titulo_figura_normalizar(its[[1]]$texto) %||% .word_titulo_bloque_multi(lam, its[[1]]$id))
  }
  bateria <- function(its) {   # C4: un actor, varias premisas, eje Y = enunciados, una leyenda
    sub <- block_data
    claves <- unlist(lapply(its, `[[`, "refs"), use.names = FALSE)
    sub$modo <- "var"
    sub$vars <- claves
    sub$titulos_grupo <- NULL
    if (es_cruce) {
      sub$overrides <- sub$overrides %||% list()
      sub$overrides$etiquetas_vars <- stats::setNames(vapply(its, tema_titulo, ""), claves)
    }
    list(sub = sub, titulo = titulo_declarado)
  }
  piezas <- list()
  for (ix in unname(split(seq_len(n), factor(corrida, levels = unique(corrida))))) {
    grupos <- .word_criterio_premisas(items[ix])
    refs_run <- unlist(lapply(items[ix], `[[`, "refs"), use.names = FALSE)
    es_bateria <- length(grupos) > 1L && all(lengths(grupos) == 1L) &&
      all(vapply(items[ix], function(it) length(it$refs) == 1L, TRUE)) &&
      length(unique(unlist(lapply(items[ix], `[[`, "actores"), use.names = FALSE))) == 1L && !anyDuplicated(refs_run)
    if (!es_bateria) {
      for (g in grupos) piezas[[length(piezas) + 1L]] <- una_premisa(items[ix][g])
      next
    }
    tramos <- .word_criterio_tramos(length(grupos))
    if (length(grupos) > .MULTIAPILADAS_MAX_BARRAS) {
      .pulso_aviso(.aviso_en_lamina(sprintf(
        "la batería de %d preguntas pasa del máximo de %d barras por figura: el Word la partió en %d figuras de %s barras.",
        length(grupos), .MULTIAPILADAS_MAX_BARRAS, length(tramos), paste(lengths(tramos), collapse = " + "))))
    }
    for (tr in tramos) {
      its <- items[ix][unlist(grupos[tr])]
      piezas[[length(piezas) + 1L]] <- if (length(its) > 1L) bateria(its) else una_premisa(its)
    }
  }
  piezas
}

#' Pie de una figura de un solo público con la base propia de cada fila que no cuadra con la común
#'
#' En una batería (varias premisas de un actor) cada fila es una pregunta y puede tener menos respuestas que las demás
#' (salto de cuestionario). El PPT la anota («N = 80», `.n_barra_procede`); el Word sólo decía la base del conjunto. Aquí se
#' agrega al pie, sin tocar cifras: «Base: 120 respuestas; premisa 3: 80». La base común es la mayor N de las filas; la
#' tolerancia es la del PPT (`.N_BARRA_TOLERANCIA`). Sólo con un único público (en varios, el pie ya dice cada base).
#' @param base Pie ya compuesto (texto) o NULL.
#' @param plot Plot Word del bloque (con `pulso_espec`).
#' @param block Bloque ya preparado para el Word.
#' @return El pie, con o sin la nota.
#' @keywords internal
.word_base_filas <- function(base, plot, block) {
  tryCatch({
    if (is.null(base) || !length(base) || is.na(base[1]) || !nzchar(base[1])) return(base)
    if (!identical(block$modo %||% "var", "var") || !.word_publico_mono_fuente(block$vars)) return(base)
    espec <- attr(plot, "pulso_espec", exact = TRUE)
    if (is.null(espec) || !identical(espec$tipo, "escala") || NROW(espec$filas) < 2L) return(base)
    n <- suppressWarnings(as.numeric(.espec_casos(espec$filas)))
    if (!is.null(espec$filas$es_total)) n[which(espec$filas$es_total)] <- NA_real_
    if (!any(is.finite(n))) return(base)
    dif <- which(.n_barra_procede(n, max(n, na.rm = TRUE)))
    if (!length(dif)) return(base)
    paste0(sub("[.;\\s]+$", "", base[1]), "; ", paste(sprintf("premisa %d: %s", dif, format(round(n[dif]), trim = TRUE, scientific = FALSE)), collapse = "; "))
  }, error = function(e) base)
}

#' Título de la figura Word de un elemento de UNA pregunta: su enunciado, no el título de la lámina
#'
#' Criterio B del Word: la figura de una premisa lleva su enunciado como título. `.word_title_for_element` prefiere el
#' título de la lámina, que en una Sí/No suelta (`p_dicotomica`, una barra de una variable) es el de la sección y deja
#' la figura sin su pregunta (Arte, Gráficos 74, 76 y 84; el PPT sí la muestra). Sólo cambia un elemento de una única
#' variable con título de lámina; con varias variables, sin título de lámina o sin enunciado resoluble queda `titulo`.
#' @param el Elemento del plan (`ppt_element`).
#' @param titulo Título que ya resolvió `.word_title_for_element(el)`.
#' @param pregunta Función `(ref, fuente)` -> enunciado de la variable, ya con sus etiquetas cortas y sin «(Recodificada)».
#' @return Texto del título.
#' @keywords internal
.word_titulo_una_pregunta <- function(el, titulo, pregunta) {
  if (is.null(el) || !inherits(el, "ppt_element")) return(titulo)
  texto <- function(x) { x <- trimws(as.character(x %||% "")[1]); if (is.na(x) || !nzchar(x)) NULL else x }
  if (is.null(texto(el$title_slide))) return(titulo)
  if (length(unlist(el$vars, use.names = FALSE))) return(titulo)
  ref <- as.character(unlist(el$var, use.names = FALSE))
  ref <- ref[!is.na(ref) & nzchar(trimws(ref))]
  if (length(ref) != 1L) return(titulo)
  q <- tryCatch(texto(pregunta(ref, if (grepl("$", ref, fixed = TRUE)) NULL else el$source %||% NULL)), error = function(e) NULL)
  if (is.null(q) || identical(q, ref)) titulo else q
}
