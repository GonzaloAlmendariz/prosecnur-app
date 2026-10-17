# Códigos especiales del estudio, para SUGERIRLOS en el libro de códigos.
#
# El panel «Códigos especiales» del libro mostraba siempre 95–99 con etiquetas
# fijas («No contesta», «No aplica», «No sabe», «Otro», «Otros»). En HSyVbG los
# especiales son 88 «Otro», 97 «No especifica», 98 «Ninguno» y 99 «No sé /
# Prefiero no decir»: la lista fija no correspondía al estudio (Gonzalo,
# 2026-10-16: «puede ser sugerencias pero no imponerse»).
#
# Aquí se leen los instrumentos de las bases y se proponen los códigos que
# parecen especiales: numéricos de 77 a 99, o negativos (-1, -99…), con la
# etiqueta que el instrumento les da. Es una sugerencia: nada se marca solo.

.analitica_codigo_especial <- function(codigo) {
  v <- suppressWarnings(as.numeric(codigo))
  !is.na(v) & v == round(v) & ((v >= 77 & v <= 99) | v < 0)
}

#' Códigos que parecen especiales en las listas de respuestas de los instrumentos.
#'
#' @param insts lista de instrumentos (`reporte_instrumento`), uno por base.
#' @return lista ordenada por código de `list(codigo, etiqueta, etiquetas,
#'   n_listas)`: la etiqueta más frecuente, las distintas (hasta tres) y en
#'   cuántas listas de respuestas aparece.
#' @keywords internal
analitica_codigos_especiales <- function(insts) {
  filas <- list()
  for (inst in insts %||% list()) {
    ch <- (inst %||% list())$choices
    if (!is.data.frame(ch) || !all(c("list_name", "name") %in% names(ch))) next
    cod <- trimws(as.character(ch$name))
    lab <- if ("label" %in% names(ch)) trimws(as.character(ch$label)) else rep("", nrow(ch))
    lab[is.na(lab)] <- ""
    ok <- !is.na(cod) & .analitica_codigo_especial(cod)
    if (!any(ok)) next
    filas[[length(filas) + 1L]] <- data.frame(
      codigo = cod[ok], etiqueta = lab[ok], lista = as.character(ch$list_name[ok]),
      stringsAsFactors = FALSE)
  }
  if (!length(filas)) return(list())
  df <- do.call(rbind, filas)
  df <- df[!duplicated(df[c("codigo", "etiqueta", "lista")]), , drop = FALSE]
  codigos <- unique(df$codigo)
  codigos <- codigos[order(as.numeric(codigos))]
  lapply(codigos, function(k) {
    sub <- df[df$codigo == k, , drop = FALSE]
    etq <- sub$etiqueta[nzchar(sub$etiqueta)]
    frec <- sort(table(etq), decreasing = TRUE)
    list(
      codigo = k,
      etiqueta = if (length(frec)) names(frec)[[1]] else "",
      etiquetas = as.list(utils::head(names(frec), 3L)),
      n_listas = length(unique(sub$lista))
    )
  })
}

# Instrumentos de las bases del estudio; con una sola base, el de Analítica.
.analitica_insts_del_estudio <- function(sid) {
  s <- session_get(sid, required = FALSE) %||% list()
  bases <- names((s$estudio %||% list())$bases %||% list())
  insts <- lapply(bases, function(b) (s$rp_inst_sources %||% list())[[b]])
  insts <- Filter(Negate(is.null), insts)
  if (!length(insts) && !is.null(s$analitica_rp_inst)) insts <- list(s$analitica_rp_inst)
  insts
}

#' Los códigos especiales configurados, sin el default heredado.
#'
#' Hasta 2026-10 todo proyecto nacía con 96–99 marcados aunque no
#' correspondieran al estudio. Esa lista exacta se trata como «sin elegir»; una
#' elección distinta se respeta.
#' @keywords internal
analitica_codigos_especiales_efectivos <- function(codes) {
  codes <- as.integer(codes %||% integer(0))
  if (length(codes) == 4L && setequal(codes, c(96L, 97L, 98L, 99L))) integer(0) else codes
}

#' Por código especial y por base: en cuántas preguntas se ofrece y en cuántas
#' alguien lo eligió. Es lo que la pantalla necesita para decir qué pasa al
#' marcarlo («se mostrará en 5 preguntas y se omitirá en 9»).
#'
#' @param insts,datas listas nombradas por base (instrumento y data de reporte).
#' @param codigos los códigos a contar.
#' @return lista nombrada por código de `list(base = list(n_preguntas, n_con_casos))`.
#' @keywords internal
analitica_codigos_especiales_uso <- function(insts, datas, codigos) {
  out <- stats::setNames(lapply(codigos, function(k) list()), codigos)
  for (b in names(insts)) {
    ord <- (insts[[b]] %||% list())$orders_list %||% list()
    df <- (datas %||% list())[[b]]
    for (k in codigos) {
      vars <- names(ord)[vapply(ord, function(o) k %in% as.character(o$names %||% character(0)), logical(1))]
      con_casos <- if (is.data.frame(df)) {
        sum(vapply(vars, function(v) v %in% names(df) &&
                     any(trimws(as.character(unclass(df[[v]]))) == k, na.rm = TRUE), logical(1)))
      } else NA_integer_
      out[[k]][[b]] <- list(n_preguntas = length(vars), n_con_casos = as.integer(con_casos))
    }
  }
  out
}
