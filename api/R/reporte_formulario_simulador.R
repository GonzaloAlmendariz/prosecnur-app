# Motor del formulario en papel — simulador de recorrido (verificacion).
#
# `docs/qa/reglas-papel-numeracion-saltos-2026-10-15.md`, «Como se verifica»:
# para cada opcion de cada origen, el conjunto de preguntas que alcanza un
# entrevistador que sigue el papel (numeros, saltos por opcion, saltos de salida
# y condiciones impresas) debe ser el que declaran los `relevant` evaluados.
#
# Lee lo IMPRESO: los saltos salen del texto de las opciones y de `skip` de los
# bloques del modelo, no de las tablas internas. Las condiciones impresas se
# evaluan con el mismo arbol que se redacto (`.logica$arboles`).
#
# No simula combinaciones de dos origenes a la vez (los AND entre origenes): una
# condicion que depende de otra respuesta queda DESCONOCIDA y no se juzga.

.form_sim_destino <- function(texto, et) {
  t <- .form_pdf_chr(texto)
  if (!nzchar(t)) return(list(hay = FALSE))
  if (grepl("Fin de la encuesta", t, fixed = TRUE)) return(list(hay = TRUE, fila = NA_integer_))
  m <- regmatches(t, regexec("[Pp]ase a la pregunta ([^ ,;.·]+(?:\\.[0-9]+)*)", t, perl = TRUE))[[1]]
  if (!length(m)) return(list(hay = FALSE))
  f <- match(m[2], et)
  if (is.na(f)) return(list(hay = FALSE, roto = m[2]))
  list(hay = TRUE, fila = f)
}

# Devuelve data.frame de discrepancias (origen, opcion, pregunta, esperado,
# alcanzado) y atributos con lo que se simulo.
.form_pdf_simular <- function(model) {
  lg <- model$.logica
  vacio <- data.frame(origen = character(0), opcion = character(0), pregunta = character(0),
                      esperado = logical(0), alcanzado = logical(0), stringsAsFactors = FALSE)
  if (is.null(lg) || is.null(lg$ctx)) return(vacio)
  ctx <- lg$ctx
  origenes <- lg$origenes
  if (!length(origenes)) origenes <- .form_logica_origenes(ctx)
  n <- ctx$n
  bloques <- list(); items <- list()
  for (b in model$blocks) {
    if (nzchar(b$name %||% "") && !identical(b$kind, "section")) bloques[[b$name]] <- b
    for (it in b$items %||% list()) if (nzchar(it$name %||% "")) items[[it$name]] <- it
  }
  salida <- function(r) {
    b <- bloques[[ctx$nombres[r]]]
    if (is.null(b)) return(list(hay = FALSE))
    .form_sim_destino(b$skip, ctx$et)
  }
  salto_opcion <- function(s, v) {
    it <- items[[ctx$nombres[s]]]
    if (!is.null(it)) {
      # «Si respondio «X», pase a ...»: el salto de la fila es de la opcion X.
      b <- bloques[[ctx$nombres[.form_logica_inicio_unidad(ctx, s)]]]
      lbl <- ""
      for (o in b$options %||% list()) if (identical(.form_pdf_chr(o$code), v)) lbl <- .form_pdf_clean_text_safe(o$label %||% o$code)
      partes <- strsplit(.form_pdf_chr(it$skip), "  \u00b7  ", fixed = TRUE)[[1]]
      p <- partes[startsWith(partes, sprintf("Si respondi\u00f3 \u00ab%s\u00bb", lbl))]
      return(if (length(p)) .form_sim_destino(p[1], ctx$et) else list(hay = FALSE))
    }
    b <- bloques[[ctx$nombres[s]]]
    if (is.null(b)) return(list(hay = FALSE))
    for (o in b$options %||% list()) if (identical(.form_pdf_chr(o$code), v)) return(.form_sim_destino(o$paper_skip, ctx$et))
    list(hay = FALSE)
  }
  out <- list(); n_rec <- 0L; rotos <- character(0)
  for (nm in names(origenes)) {
    o <- origenes[[nm]]; s <- o$fila
    for (v in o$opciones) {
      st <- o$st[[v]]
      var_est <- list(); var_est[[nm]] <- list(e = "conocida", v = v)
      for (i in seq_len(n)) if (i > s && nzchar(ctx$nombres[i]) && isFALSE(st[i])) var_est[[ctx$nombres[i]]] <- list(e = "excluida", v = "")
      estado <- function(var) {
        if (!is.null(var_est[[var]])) return(var_est[[var]])
        if (.form_logica_es_tecnica(ctx, var)) return(list(e = "verdadera", v = NA))
        list(e = "desconocida", v = NA)
      }
      alcanzadas <- integer(0)
      sk <- salto_opcion(s, v)
      if (!is.null(sk$roto)) rotos <- c(rotos, sk$roto)
      j <- if (isTRUE(sk$hay)) .form_sim_aterrizaje(ctx, sk$fila) else .form_logica_fin_unidad(ctx, s) + 1L
      if (isTRUE(sk$hay) && is.na(sk$fila)) j <- n + 1L
      if (nzchar(ctx$matrix_keys[s]) && !isTRUE(sk$hay)) j <- s + 1L
      pasos <- 0L
      while (!is.na(j) && j <= n && pasos < 10L * n) {
        pasos <- pasos + 1L
        al <- lg$alcance[[j]]
        if (!is.null(al) && !is.null(lg$arboles[[j]])) {
          ok <- .form_logica_eval(lg$arboles[[j]], estado)
          if (isFALSE(ok)) {
            j <- if (ctx$tipo[j] %in% c("begin_group", "begin_repeat")) ctx$fin[j] + 1L else al[2] + 1L
            if (!(ctx$tipo[al[1]] %in% c("begin_group", "begin_repeat")) && nzchar(ctx$matrix_keys[al[2]])) {
              j <- .form_logica_fin_unidad(ctx, al[2]) + 1L
            }
            next
          }
        }
        if (ctx$numerada[j]) {
          alcanzadas <- c(alcanzadas, j)
          fu <- .form_logica_fin_unidad(ctx, j)
          es_ultima_de_unidad <- identical(fu, j)
          if (es_ultima_de_unidad || !nzchar(ctx$matrix_keys[j])) {
            sa <- salida(if (nzchar(ctx$matrix_keys[j])) .form_logica_inicio_unidad(ctx, j) else j)
            if (!is.null(sa$roto)) rotos <- c(rotos, sa$roto)
            if (isTRUE(sa$hay)) { j <- if (is.na(sa$fila)) n + 1L else .form_sim_aterrizaje(ctx, sa$fila); next }
          }
        }
        j <- j + 1L
      }
      n_rec <- n_rec + 1L
      desde <- .form_logica_fin_unidad(ctx, s) + 1L
      if (nzchar(ctx$matrix_keys[s])) desde <- s + 1L
      if (desde > n) next
      for (q in seq.int(desde, n)) {
        if (!ctx$numerada[q] || is.na(st[q])) next
        llega <- q %in% alcanzadas
        if (!identical(isTRUE(st[q]), llega)) {
          out[[length(out) + 1L]] <- data.frame(origen = nm, opcion = v, pregunta = ctx$et[q],
                                                esperado = isTRUE(st[q]), alcanzado = llega,
                                                stringsAsFactors = FALSE)
        }
      }
    }
  }
  res <- if (length(out)) do.call(rbind, out) else vacio
  attr(res, "recorridos") <- n_rec
  attr(res, "destinos_rotos") <- unique(rotos)
  res
}

.form_logica_inicio_unidad <- function(ctx, j) {
  k <- ctx$matrix_keys[j]
  if (!nzchar(k)) return(j)
  while (j > 1L && identical(ctx$matrix_keys[j - 1L], k)) j <- j - 1L
  j
}

# Un salto a la primera pregunta de un modulo aterriza en su banda: el
# entrevistador lee el «Aplique este modulo solo si...» que esta justo encima.
# Se retrocede a la banda (o bandas anidadas) que no tienen otra pregunta entre
# ellas y el destino.
.form_sim_aterrizaje <- function(ctx, j) {
  if (is.na(j)) return(j)
  k <- j
  while (k > 1L) {
    a <- k - 1L
    if (ctx$numerada[a]) break
    if (ctx$tipo[a] %in% c("end_group", "end_repeat")) break
    k <- a
  }
  # Solo se retrocede hasta una banda; si lo que hay antes son notas sueltas, no.
  bandas <- which(ctx$tipo[seq.int(k, j)] %in% c("begin_group", "begin_repeat"))
  if (!length(bandas)) return(j)
  k + bandas[1] - 1L
}
