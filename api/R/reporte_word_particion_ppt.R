# =============================================================================
# reporte_word_particion_ppt.R — R0: la partición del PPT como tope de las figuras del Word
# =============================================================================
#
# R0 (usuario, 2026-10-22): el Word «debe estar estrechamente conectado a cómo el ppt se configura ahora, en cuántas láminas».
# El PPT parte una multiapilada con `.lam_escala_partir` (escala simple) y `.lam_multilista_planear` (multilista); aquí se
# repite ESA decisión sobre la espec que el PPT ya colgó de su plot (`pulso_espec` / `pulso_multilista`), sin dibujar nada,
# y se entrega como una fila por premisa: `bloque` (1 salvo en multilista), `id` (grupo_id del tema; "" sin actores),
# `texto` (enunciado) y `parte` (número de lámina). El Word la usa como TOPE (una figura nunca cruza un corte del PPT; puede
# ser más fina) y mapea premisas a temas por `id` o `texto`, nunca por posición. Sin espec utilizable (no nativo, nulo, en
# filas, «Sin datos») devuelve NULL y rigen las reglas del criterio. Sin «(cont.)»: eso es del PPT.
# Límite: el desplazo por un título de lámina de más de tres líneas (`.lam_con_titulo`) no se conoce aquí.
# `reporte_plan_ppt.R` está congelado a crecimiento: sólo llama a `.word_particion_ppt()` y `.word_bloques_con_partes()`.

#' Partición en láminas del PPT de una multiapilada, como filas de premisas
#' @param plot Plot que el PPT renderizó para el elemento (con `pulso_espec` o `pulso_multilista`).
#' @return `data.frame(bloque, id, texto, parte)` o NULL.
#' @keywords internal
.word_particion_ppt <- function(plot) {
  tryCatch(.word_particion_ppt_leer(plot), error = function(e) NULL)
}

.word_particion_filas <- function(premisas, espec, parte, bloque = 1L) {
  if (!length(premisas)) return(NULL)
  gid <- as.character(espec$filas$grupo_id %||% rep(NA_character_, NROW(espec$filas)))
  do.call(rbind, lapply(premisas, function(p) {
    id <- gid[p$filas[[1]]$i]
    data.frame(bloque = as.integer(bloque), id = if (is.na(id)) "" else id, texto = as.character(p$texto)[1],
               parte = as.integer(parte), stringsAsFactors = FALSE)
  }))
}

.word_particion_ppt_leer <- function(plot) {
  if (!inherits(plot, "ggplot") && !inherits(plot, "gg")) return(NULL)
  ml <- attr(plot, "pulso_multilista")
  if (!is.null(ml)) {
    items <- .lam_multilista_items(ml)
    if (is.null(items)) return(NULL)
    for (k in seq_along(items)) items[[k]]$.bloque <- k
    .op <- .grosor_piso_slot(items[[1]]$espec$grosor_piso_cm); on.exit(options(.op), add = TRUE)
    compartida <- .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec"))
    partes <- .lam_multilista_planear(items, compartida)
    out <- lapply(seq_along(partes), function(j) do.call(rbind, lapply(partes[[j]], function(t) {
      .word_particion_filas(t$premisas, t$espec, j, t$.bloque)
    })))
    return(.word_particion_ordenar(do.call(rbind, out)))
  }
  espec <- attr(plot, "pulso_espec")
  if (is.null(espec) || !identical(espec$tipo, "escala") || !NROW(espec$filas) || .lam_escala_modo_filas(espec)) return(NULL)
  .op <- .grosor_piso_slot(espec$grosor_piso_cm); on.exit(options(.op), add = TRUE)
  premisas <- .lam_escala_premisas(espec)
  partes <- .lam_escala_partir(premisas, aire_min_fn = function(p) .lam_escala_aire_minimo(p, chica = .lam_escala_chica_por_premisa(espec, p))$alto)
  out <- lapply(seq_along(partes), function(j) .word_particion_filas(partes[[j]], espec, j))
  .word_particion_ordenar(do.call(rbind, out))
}

# Una premisa partida entre láminas (multilista, «(cont.)») aparece una vez por trozo; el orden es el del plan.
.word_particion_ordenar <- function(df) {
  if (is.null(df) || !NROW(df)) return(NULL)
  df <- df[order(df$bloque, df$parte), , drop = FALSE]
  rownames(df) <- NULL
  df
}

#' Parte del PPT de cada tema/barra del Word, por `id` y luego por `texto` (nunca por posición)
#' @param ids,textos Identificador (tema) y enunciado de cada elemento del Word, en su orden.
#' @param partes Salida de `.word_particion_ppt()` (de un solo bloque) o NULL.
#' @return Vector entero (largo de `ids`), o NULL si no hay partición o algún elemento no se encuentra.
#' @keywords internal
.word_parte_de <- function(ids, textos, partes) {
  if (is.null(partes) || !NROW(partes)) return(NULL)
  usada <- rep(FALSE, NROW(partes)); out <- integer(length(ids))
  for (i in seq_along(ids)) {
    cand <- which(!usada & nzchar(partes$id) & partes$id == ids[i] & nzchar(ids[i]))
    if (!length(cand)) cand <- which(!usada & partes$texto == textos[i])
    if (!length(cand)) return(NULL)
    usada[cand[1]] <- TRUE; out[i] <- partes$parte[cand[1]]
  }
  out
}

#' Bloques de una multilista listos para el Word, cada uno con su trozo de la partición del PPT
#'
#' Dos bloques CONSECUTIVOS `var_cruce` con tema nombrado que el PPT pone en una misma lámina y que comparten el enunciado
#' en el empalme (caso 7 del banco: el mismo enunciado, un bloque por actor) se unen en un bloque: el Word los dibuja como
#' una figura con una fila por actor. Sin partición no se une nada (la regla de siempre: un bloque, sus figuras).
#' @param bloques Bloques saneados de la multilista.
#' @param el Elemento padre (le hereda el título de figura a cada bloque).
#' @param partes Salida de `.word_particion_ppt()` o NULL.
#' @return Lista de `list(block, partes)`.
#' @keywords internal
.word_bloques_con_partes <- function(bloques, el, partes) {
  bloques <- lapply(bloques %||% list(), function(b) .word_multi_bloque_hereda(b, el))
  salida <- list()
  for (k in seq_along(bloques)) {
    b <- bloques[[k]]
    pb <- if (is.null(partes)) NULL else partes[partes$bloque == k, c("bloque", "id", "texto", "parte"), drop = FALSE]
    if (!is.null(pb) && !NROW(pb)) pb <- NULL
    if (!is.null(pb)) pb$bloque <- 1L
    n <- length(salida)
    if (n && .word_bloques_unibles(salida[[n]], b, pb)) {
      salida[[n]] <- .word_bloques_unir(salida[[n]], b, pb)
    } else {
      salida[[n + 1L]] <- list(block = b, partes = pb)
    }
  }
  salida
}

.word_tema_titulo <- function(b, nm) {
  tg <- b$titulos_grupo
  if (!is.null(names(tg)) && nm %in% names(tg)) as.character(tg[[nm]])[1] else nm
}

.word_bloques_unibles <- function(previo, b, pb) {
  a <- previo$block
  nombrado <- function(x) identical(x$modo, "var_cruce") && is.list(x$vars) && length(x$vars) > 0L && !is.null(names(x$vars)) && !is.null(names(x$titulos_grupo))
  if (is.null(previo$partes) || is.null(pb) || !nombrado(a) || !nombrado(b)) return(FALSE)
  ult <- names(a$vars)[length(a$vars)]; pri <- names(b$vars)[1L]
  if (!identical(.word_enunciado_norm(.word_tema_titulo(a, ult)), .word_enunciado_norm(.word_tema_titulo(b, pri)))) return(FALSE)
  pa <- .word_parte_de(ult, .word_tema_titulo(a, ult), previo$partes)
  pbb <- .word_parte_de(pri, .word_tema_titulo(b, pri), pb)
  !is.null(pa) && !is.null(pbb) && identical(pa, pbb)
}

.word_bloques_unir <- function(previo, b, pb) {
  a <- previo$block
  nuevo <- names(b$vars)
  choque <- nuevo %in% names(a$vars)
  renom <- ifelse(choque, paste0(nuevo, "_", seq_along(nuevo) + length(a$vars)), nuevo)
  m <- match(pb$id, nuevo)
  pb$id[!is.na(m)] <- renom[m[!is.na(m)]]
  vb <- b$vars; names(vb) <- renom
  tb <- b$titulos_grupo; names(tb) <- renom[match(names(tb), nuevo)]
  a$vars <- c(a$vars, vb)
  a$titulos_grupo <- c(a$titulos_grupo, tb)
  list(block = a, partes = rbind(previo$partes, pb))
}

.word_enunciado_norm <- function(x) tolower(trimws(gsub("\\s+", " ", as.character(x)[1])))
