# =============================================================================
# Letras de los cruces: modo simple o bajo el diseño muestral (ADR 0127)
# =============================================================================
#
# Punto de entrada único de las letras de proporciones de una variable de cruce.
# Con la regla del estudio vigente (ADR 0128, que unifica este ADR), las letras
# salen de la misma evaluación que las láminas (`.cruces_comparar_con_regla`):
# una sola regla, una sola familia de BH. Sin ella, `simple` es la z de
# `comparar_columnas_sig()` más la base mínima y `diseno` es la t por par con la
# varianza de diseño de `.sig_contrastes` (graficos_significancia_diseno.R): una
# sola implementación de la linealización, con los grados de libertad del diseño
# (conglomerados menos estratos) que pide el dictamen metodológico.

.CRUCES_SIG_CORRECCIONES <- c("bonferroni", "holm", "BH")

#' Configuración canónica de `analitica_config$cruces$significancia`
#'
#' Valores fuera de dominio caen al valor por defecto: la carga de un `.pulso`
#' nunca falla por este bloque.
#' @keywords internal
.cruces_significancia_normalizar <- function(x = NULL) {
  x <- if (is.list(x)) x else list()
  col_o_null <- function(v) {
    v <- as.character(unlist(v %||% character(0)))[1]
    if (is.na(v) || !nzchar(trimws(v))) NULL else trimws(v)
  }
  entero <- function(v, def, min) {
    v <- suppressWarnings(as.integer(unlist(v %||% def))[1])
    if (is.na(v) || v < min) def else v
  }
  metodo <- as.character(unlist(x$metodo %||% "simple"))[1]
  if (is.na(metodo) || !metodo %in% c("simple", "diseno")) metodo <- "simple"
  correccion <- as.character(unlist(x$correccion %||% "bonferroni"))[1]
  if (identical(tolower(correccion %||% ""), "bh")) correccion <- "BH"
  if (is.na(correccion) || !correccion %in% .CRUCES_SIG_CORRECCIONES) correccion <- "bonferroni"
  list(
    metodo = metodo,
    conglomerado = col_o_null(x$conglomerado),
    estrato = col_o_null(x$estrato),
    correccion = correccion,
    base_minima = entero(x$base_minima, 30L, 0L),
    min_conglomerados = entero(x$min_conglomerados, 8L, 2L)
  )
}

.cruces_sig_nombre_correccion <- function(correccion) {
  switch(correccion %||% "bonferroni",
    holm = "Holm",
    BH = "Benjamini-Hochberg",
    "Bonferroni"
  )
}

# -----------------------------------------------------------------------------
# Diseño de una base
# -----------------------------------------------------------------------------

#' Valida y resuelve el diseño de una base
#'
#' Devuelve `list(ok, reason, psu, estrato, w)`. El estrato es un atributo del
#' conglomerado: si varía dentro de alguno se rechaza (no se reasigna).
#' @keywords internal
.cruces_sig_diseno_base <- function(data, spec, weight_col = "peso") {
  falla <- function(reason) list(ok = FALSE, reason = reason)
  cong <- spec$conglomerado
  if (is.null(cong)) {
    return(falla("El modo bajo el diseño necesita la columna de conglomerado y no está declarada."))
  }
  if (!cong %in% names(data)) {
    return(falla(sprintf("La base no trae la columna de conglomerado «%s».", cong)))
  }
  est_col <- spec$estrato
  if (!is.null(est_col) && !est_col %in% names(data)) {
    return(falla(sprintf("La base no trae la columna de estrato «%s».", est_col)))
  }
  psu <- as.character(data[[cong]])
  psu[!is.na(psu) & !nzchar(trimws(psu))] <- NA_character_
  est <- if (is.null(est_col)) rep("1", nrow(data)) else as.character(data[[est_col]])
  est[!is.na(est) & !nzchar(trimws(est))] <- NA_character_
  if (!is.null(est_col)) {
    ok <- !is.na(psu) & !is.na(est)
    por_psu <- tapply(est[ok], psu[ok], function(z) length(unique(z)))
    no_anidados <- sum(por_psu > 1L, na.rm = TRUE)
    if (no_anidados > 0L) {
      return(falla(sprintf(
        "Estratos no anidados en los conglomerados: «%s» varía dentro de %d conglomerado%s de «%s».",
        est_col, no_anidados, if (no_anidados == 1L) "" else "s", cong
      )))
    }
  }
  w <- get_pesos(data, weight_col)
  list(ok = TRUE, reason = "", psu = psu, estrato = est, w = w)
}

#' Contraste por pares de una fila bajo el diseño
#'
#' `y` es el resultado por persona (NA = no válido para la fila), `dom` la
#' columna a la que pertenece. Devuelve estimaciones, conteos y, por par, el
#' valor p sin ajustar (NA si el par no se prueba). La varianza y los grados de
#' libertad son los de `.sig_contrastes`, la misma prueba de las láminas.
#' @keywords internal
.cruces_sig_diseno_fila <- function(y, dom, niveles, diseno, base_minima = 30L,
                                    min_conglomerados = 8L, proporcion = TRUE) {
  K <- length(niveles)
  w <- diseno$w; psu <- diseno$psu; est <- diseno$estrato
  # Como en las láminas (`.sig_conglomerado_ultimo`): un caso sin conglomerado es su propio conglomerado y no se
  # descarta, para que la tabla y la lámina prueben sobre los mismos casos.
  en_diseno <- is.finite(w) & w > 0
  yy <- ifelse(en_diseno & !is.na(dom) & dom %in% niveles, y, NA_real_)
  r <- .sig_contrastes(cbind(y = yy[en_diseno]), dom[en_diseno], niveles, cluster = psu[en_diseno],
                       estrato = est[en_diseno], w = w[en_diseno], prueba = "rao_scott")
  ce <- r$celdas
  p <- stats::setNames(ce$p, niveles)
  n_casos <- stats::setNames(ce$n, niveles)
  n_cong <- stats::setNames(ce$conglomerados, niveles)
  W <- stats::setNames(ce$n_ponderado, niveles)
  base_ok <- n_casos >= base_minima & n_cong >= min_conglomerados & W > 0
  extremo <- if (proporcion) is.finite(p) & (p <= 0 | p >= 1) else rep(FALSE, K)
  elegibles <- which(base_ok & !extremo)
  pares <- if (length(elegibles) >= 2L) utils::combn(elegibles, 2L) else matrix(integer(0), 2L, 0L)
  pv <- se_par <- gl_par <- rep(NA_real_, ncol(pares))
  clave <- paste(r$pares$a, r$pares$b)
  for (k in seq_len(ncol(pares))) {
    a <- niveles[pares[1L, k]]; b <- niveles[pares[2L, k]]
    i <- match(c(paste(a, b), paste(b, a)), clave); i <- i[!is.na(i)][1]
    if (is.na(i) || !is.finite(r$pares$se[i]) || r$pares$se[i] <= 0) next
    pv[k] <- r$pares$p[i]; se_par[k] <- r$pares$se[i]; gl_par[k] <- r$gl
  }
  est_cl <- est[en_diseno][!duplicated(psu[en_diseno])]
  solitario <- any(table(est_cl) == 1L)
  list(p = p, n_casos = n_casos, n_cong = n_cong, base_ok = base_ok,
       extremo = extremo, pares = pares, pv = pv, se = se_par, gl = gl_par,
       solitario = solitario)
}

# -----------------------------------------------------------------------------
# Letras
# -----------------------------------------------------------------------------

# Asigna letras de una fila a partir de p ajustados: la letra va en la columna
# mayor y nombra a la menor. `.b` (base insuficiente) gana sobre `.a`.
.cruces_sig_letras_fila <- function(p, pares, padj, alpha, base_ok, extremo) {
  K <- length(p)
  letras <- character(K); sig <- logical(K)
  for (k in seq_len(ncol(pares))) {
    if (!is.finite(padj[k]) || padj[k] >= alpha) next
    a <- pares[1L, k]; b <- pares[2L, k]
    if (p[a] > p[b]) {
      letras[a] <- trimws(paste(letras[a], openxlsx::int2col(b))); sig[a] <- TRUE
    } else if (p[b] > p[a]) {
      letras[b] <- trimws(paste(letras[b], openxlsx::int2col(a))); sig[b] <- TRUE
    }
  }
  letras[extremo & base_ok & !nzchar(letras)] <- ".a"
  letras[!base_ok] <- ".b"
  sig[!base_ok] <- FALSE
  list(letras = letras, sig = sig)
}

.cruces_sig_vacio <- function(codes_row, estratos, method, reason = "") {
  letras <- matrix("", length(codes_row), length(estratos),
                   dimnames = list(as.character(codes_row), as.character(estratos)))
  list(letras = letras,
       sig = matrix(FALSE, nrow(letras), ncol(letras), dimnames = dimnames(letras)),
       method = method, reason = as.character(reason %||% ""),
       solitario = FALSE)
}

#' Letras de proporciones de una variable de cruce (ADR 0127)
#'
#' @param data Base de la tabla (con `weight_col` si hay ponderación).
#' @param spec Salida de `.cruces_significancia_normalizar()`.
#' @param repeat_design Diseño repeat de la base o NULL.
#' @return `list(letras, sig, method, reason, solitario)`. `method` es
#'   `"z_simple"`, `"diseno"`, `"cluster_robust"` o `"descriptivo"`.
#' @keywords internal
.cruces_sig_comparar <- function(data, var, codes_row, estratos, var_estrato, tp,
                                 spec = .cruces_significancia_normalizar(),
                                 alpha = 0.05, weight_col = "peso",
                                 repeat_design = NULL, opciones = NULL) {
  spec <- .cruces_significancia_normalizar(spec)
  codes_row <- as.character(codes_row); estratos <- as.character(estratos)
  diseno_activo <- identical(spec$metodo, "diseno")
  usa_cong_estudio <- diseno_activo && !is.null(spec$conglomerado) &&
    spec$conglomerado %in% names(data)
  ctx <- .sig_informe_vigente()
  usa_regla <- !is.null(ctx) && !(is.list(repeat_design) && !usa_cong_estudio)
  if (usa_regla) {
    # ADR 0128: la regla del estudio y su familia de BH, como en las láminas.
    return(.cruces_comparar_con_regla(data, var, opciones %||% codes_row, codes_row, estratos, var_estrato, tp,
                                      weight_col, ctx$regla, ctx$familia))
  }

  if (is.list(repeat_design) && !usa_cong_estudio) {
    # Repeat sin conglomerado del estudio: contraste por persona de siempre.
    return(.repeat_compare_columns_cluster(
      data = data, var = var, codes_row = codes_row, estratos = estratos,
      var_estrato = var_estrato, tp = tp, weight_col = weight_col,
      repeat_design = repeat_design, alpha = alpha
    ))
  }

  # Casos válidos sin ponderar por columna: la base mínima cuenta personas.
  casos <- nN_para_sig_simple(
    data = data, var = var, opciones_labels = codes_row, codes_row = codes_row,
    estratos = estratos, var_estrato = var_estrato, tp = tp, weight_col = NULL
  )$N_vec

  if (!diseno_activo) {
    nn <- nN_para_sig_simple(
      data = data, var = var, opciones_labels = codes_row, codes_row = codes_row,
      estratos = estratos, var_estrato = var_estrato, tp = tp, weight_col = weight_col
    )
    chica <- casos < spec$base_minima
    nn$n_mat[, chica] <- 0
    nn$N_vec[chica] <- 0
    cmp <- comparar_columnas_sig(nn$n_mat, nn$N_vec, alpha = alpha,
                                 correccion = spec$correccion)
    cmp$letras[, chica] <- ".b"
    cmp$sig[, chica] <- FALSE
    cmp$method <- "z_simple"
    cmp$reason <- ""
    cmp$solitario <- FALSE
    return(cmp)
  }

  dis <- .cruces_sig_diseno_base(data, spec, weight_col = weight_col)
  if (!isTRUE(dis$ok)) return(.cruces_sig_vacio(codes_row, estratos, "descriptivo", dis$reason))

  out <- .cruces_sig_vacio(codes_row, estratos, "diseno")
  dom <- as.character(data[[var_estrato]])
  for (i in seq_along(codes_row)) {
    y <- .repeat_outcome_for_code(data, var, codes_row[[i]], codes_row, tp)
    f <- .cruces_sig_diseno_fila(
      y, dom, estratos, dis,
      base_minima = spec$base_minima, min_conglomerados = spec$min_conglomerados
    )
    out$solitario <- out$solitario || f$solitario
    padj <- if (length(f$pv)) stats::p.adjust(f$pv, method = spec$correccion) else numeric(0)
    lf <- .cruces_sig_letras_fila(f$p, f$pares, padj, alpha, f$base_ok, f$extremo)
    out$letras[i, ] <- lf$letras
    out$sig[i, ] <- lf$sig
  }
  out
}

#' Letras de medias de una fila (cruces de dimensiones)
#'
#' `masks` es una lista con la máscara de filas de cada columna; `x` los valores
#' por persona. Simple: Welch de `comparar_medias_sig()` con base mínima.
#' Diseño: el mismo contraste que las proporciones, con `y` numérica.
#' `dis` es la salida de `.cruces_sig_diseno_base()` (solo en modo diseño).
#' @return `list(letras, method, reason, solitario)`; `letras` de largo K.
#' @keywords internal
.cruces_sig_medias <- function(x, w, masks, medias, ns, sds, spec, dis = NULL,
                               alpha = 0.05) {
  spec <- .cruces_significancia_normalizar(spec)
  K <- length(masks)
  x <- suppressWarnings(as.numeric(x))
  casos <- vapply(masks, function(m) sum(as.logical(m) & is.finite(x) &
                                           is.finite(w) & w > 0, na.rm = TRUE), numeric(1))
  if (!identical(spec$metodo, "diseno")) {
    chica <- casos < spec$base_minima
    med <- matrix(as.numeric(medias), nrow = 1)
    med[1, chica] <- NA_real_
    cmp <- comparar_medias_sig(med, matrix(as.numeric(ns), nrow = 1),
                               matrix(as.numeric(sds), nrow = 1),
                               alpha = alpha, correccion = spec$correccion)
    letras <- as.character(cmp$letras[1, ])
    letras[chica] <- ".b"
    return(list(letras = letras, method = "welch", reason = "", solitario = FALSE))
  }
  if (!is.list(dis) || !isTRUE(dis$ok)) {
    return(list(letras = character(K), method = "descriptivo",
                reason = (dis %||% list())$reason %||% "", solitario = FALSE))
  }
  dom <- rep(NA_character_, length(x))
  for (k in seq_len(K)) dom[as.logical(masks[[k]]) & is.na(dom)] <- as.character(k)
  niveles <- as.character(seq_len(K))
  f <- .cruces_sig_diseno_fila(
    x, dom, niveles, dis, base_minima = spec$base_minima,
    min_conglomerados = spec$min_conglomerados, proporcion = FALSE
  )
  padj <- if (length(f$pv)) stats::p.adjust(f$pv, method = spec$correccion) else numeric(0)
  lf <- .cruces_sig_letras_fila(f$p, f$pares, padj, alpha, f$base_ok, f$extremo)
  list(letras = lf$letras, method = "diseno", reason = "", solitario = f$solitario)
}

# -----------------------------------------------------------------------------
# Nota al pie
# -----------------------------------------------------------------------------

#' Nota de la subtabla de letras, generada desde la configuración
#'
#' @param metodos Vector de `method` de los bloques de la tabla.
#' @param razones Motivos de abstención de los bloques.
#' @param etiquetas Función `nombre -> etiqueta` para conglomerado y estrato.
#' @param tipo `"proporcion"` (cruces) o `"media"` (dimensiones).
#' @keywords internal
.cruces_sig_nota <- function(spec, alpha = 0.05, metodos = character(0),
                             razones = character(0), solitario = FALSE,
                             etiquetas = function(x) x, ponderado = FALSE,
                             tipo = c("proporcion", "media")) {
  tipo <- match.arg(tipo)
  spec <- .cruces_significancia_normalizar(spec)
  a <- .notas_pie_alpha(alpha)
  corr <- .cruces_sig_nombre_correccion(spec$correccion)
  razones <- unique(Filter(nzchar, as.character(razones)))
  metodos <- unique(as.character(metodos))
  cierre <- function(x) sub("\\.?$", ".", x)
  if (!length(metodos) || all(metodos == "descriptivo")) {
    if (!length(razones)) razones <- "el diseño no permite la prueba"
    return(paste0("No se asignan letras: ", paste(cierre(razones), collapse = " ")))
  }
  if (all(metodos == "cluster_robust")) {
    return(.notas_pie_significancia("cluster", alpha))
  }
  objeto <- if (identical(tipo, "media")) "media" else "proporción"
  prueba <- if (identical(spec$metodo, "diseno")) {
    paste0(
      "prueba t de diferencia de ", if (identical(tipo, "media")) "medias" else "proporciones",
      " bajo el diseño muestral, con conglomerado ", etiquetas(spec$conglomerado),
      if (!is.null(spec$estrato)) paste0(", estrato ", etiquetas(spec$estrato)) else " sin estrato",
      if (isTRUE(ponderado)) " y peso de Ponderación" else " y sin ponderación",
      ", varianza por linealización sin corrección por población finita, grados de libertad ",
      "según los conglomerados de cada par y corrección de ", corr
    )
  } else if (identical(tipo, "media")) {
    paste0("prueba t de Welch con corrección de ", corr)
  } else {
    paste0("prueba z de diferencia de proporciones con corrección de ", corr)
  }
  minimo <- if (identical(spec$metodo, "diseno")) {
    sprintf("menos de %d casos o de %d conglomerados", spec$base_minima, spec$min_conglomerados)
  } else {
    sprintf("menos de %d casos", spec$base_minima)
  }
  txt <- paste0(
    "Las letras comparan las columnas de una misma variable de cruce. ",
    "Una letra en una celda indica que esa ", objeto, " es significativamente mayor ",
    "que la de la columna identificada con esa letra (", prueba,
    ", nivel de significancia de ", a, "). ",
    if (!identical(spec$metodo, "diseno")) "La prueba supone muestreo aleatorio simple. " else "",
    if (identical(tipo, "proporcion")) {
      "\".a\" indica una columna excluida de la comparación porque su proporción es 0 % o 100 %. "
    } else "",
    "\".b\" indica una columna con ", minimo, ", que no se compara."
  )
  if (isTRUE(solitario)) {
    txt <- paste0(txt, " Los estratos con un solo conglomerado se centran en la media general.")
  }
  if (length(razones)) {
    txt <- paste0(txt, " Sin letras en parte de la tabla: ", paste(cierre(razones), collapse = " "))
  }
  txt
}

# La nota dice «peso de Ponderación» solo si la base trae un peso que no es
# constante: un peso de 1 en todas las filas no pondera.
.cruces_sig_ponderado <- function(data, weight_col = "peso") {
  if (is.null(weight_col) || !weight_col %in% names(data)) return(FALSE)
  w <- suppressWarnings(as.numeric(data[[weight_col]]))
  w <- w[is.finite(w) & w > 0]
  length(w) > 0L && (max(w) - min(w)) > 1e-9
}

# Línea de la ficha técnica del XLSX («Significancia estadistica»), de la misma
# configuración que la nota.
.cruces_sig_ficha <- function(spec, alpha = 0.05) {
  spec <- .cruces_significancia_normalizar(spec)
  corr <- .cruces_sig_nombre_correccion(spec$correccion)
  if (identical(spec$metodo, "diseno")) {
    return(paste0(
      "Bajo el diseño muestral (conglomerado ", spec$conglomerado %||% "sin declarar",
      if (!is.null(spec$estrato)) paste0(", estrato ", spec$estrato) else "",
      "); corrección de ", corr, "; alpha = ", alpha,
      "; base mínima ", spec$base_minima, " casos y ", spec$min_conglomerados, " conglomerados"
    ))
  }
  paste0("Muestreo aleatorio simple; corrección de ", corr, "; alpha = ", alpha,
         "; base mínima ", spec$base_minima, " casos")
}
