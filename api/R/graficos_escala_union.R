# Cada público con su escala (Gonzalo, 2026-10-14; checklist-catalogo-recetario-2026-10-14.md, H3).
#
# En acreditación la misma premisa se pregunta a veces con escalas distintas según el público: docentes en cinco puntos
# («Ni de acuerdo ni en desacuerdo» al medio) y estudiantes en cuatro. Antes la multiapilada abortaba con «no comparten
# una escala compatible» y la lámina salía «Sin datos». Decisión: en el mismo tema, cada fila con su escala, una leyenda
# por escala y el Top Two Box comparado.
#
# Cómo: cuando las escalas no son equivalentes pero UNA contiene las respuestas de todas las demás (por etiqueta, sin
# las especiales como SIN INF), se dibuja sobre esa escala mayor y cada fila deja en cero lo que su escala no tiene.
# La unión es POR ETIQUETA y nunca por código: en cuatro puntos el 3 es «De acuerdo» y en cinco es el punto medio, así
# que juntar por código pintaría el acuerdo de los estudiantes como neutral.
#
# Las funciones de normalización viven en el cierre de `reporte_ppt_plan()`; se reciben en `h`:
# `list_name(ctx)`, `label_col(choices)`, `norm(labels)` y `especial(codes, labels)`.

#' Respuestas de la escala de un contexto: código, etiqueta, normalizada y si es especial
#' @keywords internal
.escala_union_respuestas <- function(ctx, h) {
  ln <- h$list_name(ctx); ch <- ctx$choices
  if (is.na(ln) || !nzchar(ln) || !is.data.frame(ch) || !all(c("list_name", "name") %in% names(ch))) return(NULL)
  sub <- ch[ch$list_name == ln, , drop = FALSE]
  if (!nrow(sub)) return(NULL)
  lc <- h$label_col(ch)
  labels <- as.character(if (!is.na(lc) && lc %in% names(sub)) sub[[lc]] else sub$name)
  codes <- trimws(as.character(sub$name))
  data.frame(code = codes, label = labels, norm = h$norm(labels), especial = h$especial(codes, labels), stringsAsFactors = FALSE)
}

#' Escala común por etiqueta cuando una contiene a las demás
#'
#' @param ctxs Contextos de las referencias de la lámina.
#' @param h Funciones de normalización (ver cabecera).
#' @return `NULL` si ninguna escala contiene a las demás; si no, la especificación de escala de `.shared_scale_spec()`
#'   (`list_name`, `choices`, `equivalent = TRUE`) más `por_etiqueta = TRUE` y `escalas`: una entrada por escala distinta
#'   con sus `labels` canónicas (las de la escala mayor) y las `fuentes` que la usan, en el orden en que aparecen.
#' @keywords internal
.escala_union_spec <- function(ctxs, h) {
  resp <- lapply(ctxs, .escala_union_respuestas, h = h)
  if (!length(resp) || any(vapply(resp, is.null, logical(1)))) return(NULL)
  firmas <- vapply(resp, function(r) paste(r$norm[!r$especial], collapse = "|"), character(1))
  sustantivas <- lapply(resp, function(r) r$norm[!r$especial])
  # La escala mayor: la que contiene las respuestas sustantivas de todas.
  mayor <- which(vapply(sustantivas, function(s) all(vapply(sustantivas, function(o) all(o %in% s), logical(1))), logical(1)))
  if (!length(mayor)) return(NULL)
  m <- mayor[which.max(lengths(sustantivas[mayor]))]
  ref <- resp[[m]]
  # Las especiales (SIN INF) de cualquier escala deben existir en la mayor por etiqueta; si no, no hay dónde ponerlas.
  esp <- unique(unlist(lapply(resp, function(r) r$norm[r$especial])))
  if (!all(esp %in% ref$norm)) return(NULL)
  canon <- function(r) ref$label[match(r$norm, ref$norm)]
  claves <- unique(firmas)
  escalas <- lapply(claves, function(k) {
    i <- which(firmas == k)
    list(labels = canon(resp[[i[1]]]), fuentes = unique(vapply(ctxs[i], function(c) as.character(c$source %||% ""), character(1))))
  })
  list(list_name = h$list_name(ctxs[[m]]), choices = ctxs[[m]]$choices, equivalent = TRUE, por_etiqueta = TRUE,
       escalas = if (length(escalas) > 1L) escalas else NULL)
}

#' Lleva las opciones de una tabla de frecuencias a la escala mayor, por etiqueta
#'
#' La tabla trae sus opciones como CÓDIGOS de su propia escala o como etiquetas, según de dónde vengan los datos; se
#' devuelven en la misma forma, pero de la escala mayor. Medido: con códigos, el «3» de cuatro puntos pasaba intacto y en
#' cinco puntos el 3 es «Ni de acuerdo ni en desacuerdo» (test-escala-union-publicos.R).
#' @keywords internal
.escala_union_canonizar <- function(tab, ctx, spec, h) {
  r <- .escala_union_respuestas(ctx, h)
  ch <- spec$choices
  if (is.null(r) || !is.data.frame(ch)) return(tab)
  sub <- ch[ch$list_name == spec$list_name, , drop = FALSE]
  lc <- h$label_col(ch)
  labs <- as.character(if (!is.na(lc) && lc %in% names(sub)) sub[[lc]] else sub$name)
  codes <- trimws(as.character(sub$name))
  ops <- as.character(tab$Opciones)
  es_codigo <- trimws(ops) %in% r$code
  # A etiqueta normalizada: la del código de su escala, o la etiqueta misma.
  norm_op <- ifelse(es_codigo, r$norm[match(trimws(ops), r$code)], h$norm(ops))
  k <- match(norm_op, h$norm(labs))
  ok <- !is.na(k)
  ops[ok & es_codigo] <- codes[k[ok & es_codigo]]
  ops[ok & !es_codigo] <- labs[k[ok & !es_codigo]]
  tab$Opciones <- ops
  tab
}

#' La leyenda dice qué escala tiene cada público
#'
#' Con varias escalas, una respuesta que no está en todas lleva entre paréntesis los públicos que la tienen: «Ni de
#' acuerdo ni en desacuerdo (sólo Docentes)». Una sola leyenda y no una por escala: dos filas de leyenda chocaban con
#' la base y las barras en las disposiciones de la escala nativa.
#' @param leyenda Rótulos de la leyenda, alineados con `labels`.
#' @param labels Etiquetas canónicas de cada opción (las de la escala mayor).
#' @param spec Especificación de `.escala_union_spec()`.
#' @param nombre_fuente Función que da el nombre visible de una base («docentes» → «Docentes»).
#' @keywords internal
.escala_union_leyenda <- function(leyenda, labels, spec, nombre_fuente = identity) {
  escalas <- spec$escalas
  if (!isTRUE(spec$por_etiqueta) || length(escalas) < 2L) return(leyenda)
  for (k in seq_along(labels)) {
    con <- Filter(function(e) labels[k] %in% e$labels, escalas)
    if (!length(con) || length(con) == length(escalas)) next
    publicos <- unique(unlist(lapply(con, function(e) vapply(e$fuentes, nombre_fuente, character(1)))))
    leyenda[k] <- sprintf("%s (sólo %s)", leyenda[k], paste(publicos, collapse = " y "))
  }
  leyenda
}
