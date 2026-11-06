# =============================================================================
# Explorador de variables — lectura por tipo (compartida por ficha, distribución y cruces)
# =============================================================================
# Una variable se lee UNA vez en una forma por fila que los tres motores comparten:
#   - so:    `codigo` (chr, NA si no responde) + `niveles` (catálogo primero, luego los observados fuera de la lista).
#   - sm:    `mat` (lógica filas × opciones) + `niveles`; responde quien marca al menos una opción.
#   - num:   `valor` numérico (responde si es finito).
#   - fecha: `valor` Date (responde si se pudo leer como fecha ISO).
#   - texto: `valor` chr recortado (responde si no está vacío).
# `niveles` es data.frame(codigo, etiqueta, en_lista). Las etiquetas salen de `.explorar_map_choices` (el mismo mapa
# que usa el resto del explorador) y, sin lista, de las etiquetas haven de la columna.

#' Tipo del explorador acotado a los cinco que leen los motores (lo «mixto» se lee como única)
#' @keywords internal
.explorador_tipo <- function(var, instrumento, df) {
  t <- .explorar_tipo_var(var, survey = instrumento$survey %||% NULL, df = df)
  if (t %in% c("so", "sm", "num", "fecha", "texto")) t else "so"
}

#' Catálogo código → etiqueta de la variable como data.frame(codigo, etiqueta); NULL sin lista
#' @keywords internal
.explorador_catalogo <- function(var, instrumento, raw = NULL) {
  map <- .explorar_map_choices(var, instrumento)
  if (is.null(map) && !is.null(raw) && inherits(raw, "haven_labelled")) {
    labs <- attr(raw, "labels", exact = TRUE)
    if (!is.null(labs) && length(labs)) map <- stats::setNames(as.character(names(labs)), as.character(unname(labs)))
  }
  if (is.null(map) || !length(map)) return(NULL)
  cod <- as.character(names(map))
  eti <- as.character(unname(map))
  eti[is.na(eti) | !nzchar(eti)] <- cod[is.na(eti) | !nzchar(eti)]
  keep <- !is.na(cod) & nzchar(cod) & !duplicated(cod)
  data.frame(codigo = cod[keep], etiqueta = eti[keep], stringsAsFactors = FALSE)
}

#' Niveles = catálogo + códigos observados fuera de él (éstos por frecuencia); sin catálogo, por frecuencia
#' @keywords internal
.explorador_niveles <- function(catalogo, observados) {
  observados <- as.character(observados[!is.na(observados)])
  frec <- sort(table(observados), decreasing = TRUE)
  obs_orden <- as.character(names(frec))
  base <- if (is.null(catalogo)) data.frame(codigo = character(0), etiqueta = character(0), stringsAsFactors = FALSE) else catalogo
  extra <- as.character(setdiff(obs_orden, base$codigo))
  out <- rbind(
    data.frame(codigo = base$codigo, etiqueta = base$etiqueta, en_lista = rep(TRUE, nrow(base)), stringsAsFactors = FALSE),
    data.frame(codigo = extra, etiqueta = extra, en_lista = rep(FALSE, length(extra)), stringsAsFactors = FALSE)
  )
  rownames(out) <- NULL
  out
}

#' Una celda de select_multiple o dummy cuenta como marcada si vale 1 / TRUE
#' @keywords internal
.explorador_es_marca <- function(v) as.character(v) %in% c("1", "TRUE", "true", "1.0")

#' Columnas dummy `var.opcion` / `var/opcion` de un select_multiple, con su código
#' @keywords internal
.explorador_dummies <- function(df, var) {
  nms <- names(df)
  hit <- startsWith(nms, paste0(var, ".")) | startsWith(nms, paste0(var, "/"))
  cols <- nms[hit]
  codes <- substring(cols, nchar(var) + 2L)
  keep <- nzchar(codes) & !duplicated(codes)
  list(cols = cols[keep], codes = codes[keep])
}

#' Matriz filas × opciones de un select_multiple (dummies o tokens de la madre), alineada a sus niveles
#' @keywords internal
.explorador_matriz_sm <- function(df, var, instrumento) {
  n <- nrow(df)
  catalogo <- .explorador_catalogo(var, instrumento)
  dm <- .explorador_dummies(df, var)
  por_codigo <- list()
  if (length(dm$cols)) {
    for (i in seq_along(dm$cols)) por_codigo[[dm$codes[i]]] <- .explorador_es_marca(df[[dm$cols[i]]])
  } else if (var %in% names(df)) {
    raw <- as.character(df[[var]])
    raw[.explorar_is_missing_value(df[[var]])] <- ""
    toks <- strsplit(trimws(raw), "\\s+")
    codes <- unique(unlist(toks, use.names = FALSE))
    codes <- codes[!is.na(codes) & nzchar(codes) & codes != "NA"]
    for (cd in codes) por_codigo[[cd]] <- vapply(toks, function(z) cd %in% z, logical(1))
  }
  marcados <- vapply(names(por_codigo), function(cd) sum(por_codigo[[cd]]), numeric(1))
  observados <- rep(names(por_codigo), times = as.integer(marcados))
  niveles <- .explorador_niveles(catalogo, observados)
  # Una opción con dummy pero sin marcas (y fuera de la lista) también es un nivel observado de la base.
  sin_marca <- setdiff(names(por_codigo), niveles$codigo)
  if (length(sin_marca)) {
    niveles <- rbind(niveles, data.frame(codigo = sin_marca, etiqueta = sin_marca, en_lista = FALSE,
                                         stringsAsFactors = FALSE))
  }
  mat <- matrix(FALSE, nrow = n, ncol = nrow(niveles), dimnames = list(NULL, niveles$codigo))
  for (cd in intersect(names(por_codigo), niveles$codigo)) mat[, cd] <- por_codigo[[cd]]
  list(mat = mat, niveles = niveles)
}

#' Fecha ISO de una columna (Date, POSIXct o texto «AAAA-MM-DD…»); lo que no se lee queda NA
#' @keywords internal
.explorador_fecha <- function(x, n = length(x)) {
  if (is.null(x)) return(rep(as.Date(NA), n))
  if (inherits(x, "Date")) return(as.Date(x))
  if (inherits(x, "POSIXt")) return(as.Date(format(x, "%Y-%m-%d")))
  if (is.numeric(x)) return(rep(as.Date(NA), length(x)))
  s <- substr(trimws(as.character(x)), 1L, 10L)
  suppressWarnings(as.Date(s, format = "%Y-%m-%d"))
}

#' Lectura por fila de una variable (ver encabezado del archivo)
#' @keywords internal
.explorador_leer <- function(df, var, instrumento, tipo = NULL) {
  tipo <- tipo %||% .explorador_tipo(var, instrumento, df)
  n <- nrow(df)
  raw <- if (var %in% names(df)) df[[var]] else NULL
  out <- list(var = var, tipo = tipo, label = .explorar_label_var(var, instrumento), n = n)
  if (identical(tipo, "sm")) {
    sm <- .explorador_matriz_sm(df, var, instrumento)
    out$mat <- sm$mat
    out$niveles <- sm$niveles
    out$valido <- if (ncol(sm$mat)) rowSums(sm$mat) > 0 else rep(FALSE, n)
  } else if (identical(tipo, "so")) {
    cod <- if (is.null(raw)) rep(NA_character_, n) else trimws(as.character(raw))
    if (!is.null(raw)) cod[.explorar_is_missing_value(raw) | !nzchar(cod)] <- NA_character_
    out$codigo <- cod
    out$niveles <- .explorador_niveles(.explorador_catalogo(var, instrumento, raw), cod)
    out$valido <- !is.na(cod)
  } else if (identical(tipo, "num")) {
    v <- if (is.null(raw)) rep(NA_real_, n) else if (is.numeric(raw)) as.numeric(raw) else
      suppressWarnings(as.numeric(as.character(raw)))
    out$valor <- v
    out$valido <- is.finite(v)
  } else if (identical(tipo, "fecha")) {
    v <- .explorador_fecha(raw, n)
    out$valor <- v
    out$valido <- !is.na(v)
  } else {
    v <- if (is.null(raw)) rep(NA_character_, n) else trimws(as.character(raw))
    if (!is.null(raw)) v[.explorar_is_missing_value(raw)] <- NA_character_
    v[!is.na(v) & !nzchar(v)] <- NA_character_
    out$valor <- v
    out$valido <- !is.na(v)
  }
  out
}

#' Pertenencia por categoría de una variable so/sm: lista de {codigo, etiqueta, idx} sobre las filas `filas`
#'
#' En so, `idx` es «la fila está en esa categoría»; en sm, «la fila marca esa opción». Se omiten las categorías sin
#' casos en `filas`.
#' @keywords internal
.explorador_grupos_cat <- function(lec, filas) {
  out <- list()
  for (i in seq_len(nrow(lec$niveles))) {
    cd <- lec$niveles$codigo[i]
    idx <- if (identical(lec$tipo, "sm")) lec$mat[, cd] else (!is.na(lec$codigo) & lec$codigo == cd)
    idx <- idx & filas
    if (!any(idx)) next
    out[[length(out) + 1L]] <- list(codigo = cd, etiqueta = lec$niveles$etiqueta[i], idx = idx)
  }
  out
}

#' Resumen de caja (cuartiles tipo 7 y atípicos por 1.5 × IQR); NULL sin valores finitos
#' @keywords internal
.explorador_caja <- function(x, etiqueta) {
  x <- as.numeric(x)
  x <- x[is.finite(x)]
  if (!length(x)) return(NULL)
  q <- stats::quantile(x, c(0.25, 0.5, 0.75), names = FALSE)
  iqr <- q[3] - q[1]
  list(
    etiqueta = as.character(etiqueta), n = length(x), min = min(x), p25 = q[1], mediana = q[2], p75 = q[3],
    max = max(x), n_atipicos = as.integer(sum(x < q[1] - 1.5 * iqr | x > q[3] + 1.5 * iqr))
  )
}

#' Clave de agrupación de un texto abierto: minúsculas, sin tildes y con espacios simples
#' @keywords internal
.explorador_clave_texto <- function(x) {
  x <- gsub("\\s+", " ", trimws(tolower(enc2utf8(as.character(x)))))
  .txt_sin_tildes(x)
}

#' Textos agrupados por su clave: data.frame(texto, n) por n descendente; muestra la forma más frecuente del grupo
#' @keywords internal
.explorador_agrupar_textos <- function(x, top = 50L) {
  x <- as.character(x)
  x <- gsub("\\s+", " ", trimws(x[!is.na(x)]))
  x <- x[nzchar(x)]
  if (!length(x)) return(data.frame(texto = character(0), n = integer(0), stringsAsFactors = FALSE))
  clave <- .explorador_clave_texto(x)
  grupos <- split(x, clave)
  n <- vapply(grupos, length, integer(1))
  forma <- vapply(grupos, function(g) {
    t <- sort(table(g), decreasing = TRUE)
    names(t)[1]
  }, character(1))
  out <- data.frame(texto = unname(forma), n = unname(n), stringsAsFactors = FALSE)
  out <- out[order(-out$n, out$texto), , drop = FALSE]
  rownames(out) <- NULL
  utils::head(out, top)
}

#' Filas de un data.frame(texto, n) como lista de objetos para el JSON
#' @keywords internal
.explorador_textos_json <- function(tb) {
  lapply(seq_len(nrow(tb)), function(i) list(texto = tb$texto[i], n = as.integer(tb$n[i])))
}
