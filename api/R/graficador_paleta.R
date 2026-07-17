# Helper compartido de paletas para los graficadores.
#
# Por qué existe: el override de colores del usuario llega por el round-trip de
# la UI y puede venir corto, sin nombres, o como el DEPARSE de un vector
# (p.ej. el string `c("#0072BC", "#00A98F", "#8FA8C8")`). Si ese override crudo
# se pasa a `ggplot2::scale_*_manual`, ggplot aborta con
# "Insufficient values in manual scale" o "Unknown colour name".
#
# `.graficos_mk_palette` normaliza el override al nº de niveles de la categoría:
# rellena/recicla, respeta vectores nombrados o cortos, extrae los hex embebidos
# del deparse y descarta lo que `grDevices::col2rgb` no reconoce como color.
# Es la ÚNICA fuente de verdad para este saneo; los graficadores la llaman en
# lugar de mantener copias anidadas.

.graficos_mk_palette <- function(levels_cat, pal_user = NULL) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  levels_cat <- as.character(levels_cat)
  levels_cat <- levels_cat[!is.na(levels_cat) & nzchar(trimws(levels_cat))]
  if (!length(levels_cat)) return(character(0))

  # Saneo defensivo del override: por el round-trip de la UI puede llegar como
  # el deparse de un vector ('c("#0072BC", "#00A98F", "#8FA8C8")'), traer hex
  # embebidos o entradas que R no reconoce como color. Extraemos los hex de
  # cada entrada y descartamos lo no-color, para que nunca llegue basura a
  # scale_*_manual (evita "Unknown colour name").
  if (!is.null(pal_user) && length(pal_user)) {
    raw <- as.character(pal_user)
    nm <- names(pal_user)
    hex_re <- "#[0-9A-Fa-f]{8}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}"
    pieces <- lapply(seq_along(raw), function(i) {
      hits <- regmatches(raw[[i]], gregexpr(hex_re, raw[[i]]))[[1]]
      vals <- if (length(hits)) hits else raw[[i]]
      keep_name <- !is.null(nm) && length(vals) == 1L && nzchar(nm[[i]] %||% "")
      if (keep_name) stats::setNames(vals, nm[[i]]) else vals
    })
    pal_user <- unlist(pieces)
    ok <- vapply(unname(pal_user), function(col) {
      tryCatch({ grDevices::col2rgb(col); TRUE }, error = function(e) FALSE)
    }, logical(1))
    pal_user <- pal_user[ok]
    if (!length(pal_user)) pal_user <- NULL
  }

  base_pal <- c(
    "#0B4F8C", "#2A9D8F", "#E9C46A", "#F4A261",
    "#E76F51", "#7A9E9F", "#6D597A", "#5B8DEF"
  )

  if (is.null(pal_user) || !length(pal_user)) {
    if (length(levels_cat) <= length(base_pal)) {
      vals <- base_pal[seq_along(levels_cat)]
    } else {
      vals <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(length(levels_cat))
    }
    return(stats::setNames(vals, levels_cat))
  }

  # OJO: `as.character()` sobre un vector nombrado BORRA los nombres. Hay que
  # preservarlos aquí; si no, el override nombrado (p.ej. colores_series con
  # `Intervención`/`Comparación`) caería al branch posicional y asignaría el
  # color por posición en vez de por etiqueta, invirtiendo colores cuando el
  # factor está en orden distinto al del override.
  nm_user <- names(pal_user)
  pal_user <- as.character(pal_user)
  if (!is.null(nm_user)) names(pal_user) <- nm_user

  if (!is.null(names(pal_user)) && any(nzchar(names(pal_user)))) {
    names(pal_user) <- trimws(as.character(names(pal_user)))
    vals <- pal_user[levels_cat]
    miss <- is.na(vals) | !nzchar(vals)
    if (any(miss)) {
      fallback <- setdiff(base_pal, vals[!miss])
      if (!length(fallback)) {
        fallback <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(sum(miss))
      } else if (length(fallback) < sum(miss)) {
        fallback <- c(
          fallback,
          scales::hue_pal(h = c(200, 360), c = 70, l = 55)(sum(miss) - length(fallback))
        )
      }
      vals[miss] <- fallback[seq_len(sum(miss))]
    }
    return(stats::setNames(vals, levels_cat))
  }

  if (length(pal_user) < length(levels_cat)) {
    extra <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(length(levels_cat) - length(pal_user))
    pal_user <- c(pal_user, extra)
  }
  stats::setNames(pal_user[seq_along(levels_cat)], levels_cat)
}
