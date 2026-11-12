# =============================================================================
# Detector de consistencia, familia (b): combinaciones implausibles
# =============================================================================
# Combinaciones entre dos preguntas que el formulario no prohíbe pero que no
# cuadran. Para no explotar en pares, solo se miran:
#
#   frecuencia × múltiple  (automático) una pregunta de frecuencia o cantidad
#       (select_one con niveles numéricos cuyas OPCIONES hablan de veces, días o
#       frecuencia; o un entero cuyo texto habla de veces o visitas) contra cada
#       select_multiple con al menos 3 opciones de contenido de la MISMA sección
#       del formulario (begin_group; si el formulario no agrupa, todas). El texto
#       de la pregunta no basta para la select_one: "Si en la pregunta 11 respondió
#       Una vez" nombra una frecuencia sin serlo. La combinación
#       que se mira es una sola: el nivel más bajo de la frecuencia junto con
#       "muchas" opciones marcadas (más de la mitad de las opciones de
#       contenido y al menos `muchas_min`).
#   pares pedidos  los que el analista pide: si son frecuencia × múltiple se
#       miran como arriba; si son dos categóricas, se buscan celdas mucho menos
#       frecuentes que lo esperado si las respuestas fueran independientes.
#
# Rareza: observados (O) frente a esperados (E). En frecuencia × múltiple, E es
# lo que darían los del nivel más bajo con la proporción de "muchas" que tienen
# los niveles mayores; en dos categóricas, E = fila × columna / total. Rara si
# E >= `rareza_esperado_min`, O <= `rareza_razon` · E y la cola inferior de
# Poisson P(X <= O | E) < `rareza_p` (en dos categóricas dividida por el número
# de celdas). Una combinación que no es rara solo se publica si sus casos se
# concentran en un recopilador (familia c).
#
# Las opciones marcadas se cuentan con `.vd_sm_count_selected()`, la misma
# función que usa la regla de cantidad de opciones: la regla sugerida marca los
# mismos casos que la sugerencia.

.VDC_TEXTO_FRECUENCIA <- "\\b(vez|veces|frecuencia|frecuentemente|nunca|siempre|diari[oa]s?|diariamente|semanal(mente)?|mensual(mente)?|visitas?)\\b"
.VDC_TEXTO_CANTIDAD <- "\\b(vez|veces|visitas?|frecuencia)\\b"

.vdc_txt <- function(x) tolower(paste(as.character(x), collapse = " "))

# Niveles de una select_one de frecuencia: códigos numéricos sin los de cierre.
.vdc_niveles <- function(choices, lista, especiales) {
  op <- .vdc_opciones(choices, lista)
  if (is.null(op)) return(NULL)
  cod <- suppressWarnings(as.numeric(op$codigo))
  op <- op[!is.na(cod) & !.vdc_es_cierre(op$rotulo, op$codigo, especiales), , drop = FALSE]
  if (!nrow(op)) return(NULL)
  op$valor <- as.numeric(op$codigo)
  op[order(op$valor), , drop = FALSE]
}

#' Preguntas de frecuencia o cantidad del formulario
#' @keywords internal
.vdc_frecuencias <- function(data, pregs, choices, especiales) {
  if (is.null(pregs)) return(list())
  out <- list()
  for (i in seq_len(nrow(pregs))) {
    p <- pregs[i, ]
    if (!p$name %in% names(data)) next
    if (identical(p$tipo, "select_one")) {
      niv <- .vdc_niveles(choices, p$lista, especiales)
      if (is.null(niv) || nrow(niv) < 3L) next
      if (!grepl(.VDC_TEXTO_FRECUENCIA, .vdc_txt(niv$rotulo), perl = TRUE)) next
      out[[length(out) + 1L]] <- list(name = p$name, clase = "select_one", niveles = niv, grupo = p$grupo)
    } else if (p$tipo %in% c("integer", "decimal")) {
      if (!grepl(.VDC_TEXTO_CANTIDAD, .vdc_txt(p$rotulo), perl = TRUE)) next
      out[[length(out) + 1L]] <- list(name = p$name, clase = "numero", niveles = NULL, grupo = p$grupo)
    }
  }
  out
}

.vdc_misma_seccion <- function(fr, mu) {
  a <- fr$grupo %||% NA_character_; b <- mu$grupo %||% NA_character_
  (is.na(a) && is.na(b)) || (!is.na(a) && !is.na(b) && identical(a, b))
}

#' Preguntas de opción múltiple con al menos 3 opciones de contenido
#' @keywords internal
.vdc_multiples <- function(data, pregs, choices, especiales) {
  if (is.null(pregs)) return(list())
  out <- list()
  for (i in which(pregs$tipo == "select_multiple")) {
    p <- pregs[i, ]
    op <- .vdc_opciones(choices, p$lista)
    if (is.null(op)) next
    hay_cols <- p$name %in% names(data) || any(startsWith(names(data), paste0(p$name, "/")))
    if (!hay_cols) next
    contenido <- sum(!.vdc_es_cierre(op$rotulo, op$codigo, especiales))
    if (contenido < 3L) next
    out[[length(out) + 1L]] <- list(name = p$name, n_opciones = nrow(op), n_contenido = contenido, grupo = p$grupo)
  }
  out
}

# ¿Respondió la múltiple? La madre con dato o alguna dummy con dato.
.vdc_respondio_multiple <- function(data, var) {
  ok <- if (var %in% names(data)) .vdc_con_dato(data[[var]]) else rep(FALSE, nrow(data))
  dums <- names(data)[startsWith(names(data), paste0(var, "/"))]
  for (d in dums) ok <- ok | .vdc_con_dato(data[[d]])
  ok
}

.vdc_nivel_rotulo <- function(fr, valor) {
  if (identical(fr$clase, "select_one")) {
    r <- fr$niveles$rotulo[match(valor, fr$niveles$valor)]
    if (!is.na(r) && nzchar(r)) return(r)
  }
  .vdc_fmt_num(valor)
}

#' Una combinación frecuencia × múltiple: nivel más bajo con muchas opciones
#' @keywords internal
.vdc_par_frecuencia <- function(data, fr, mu, pregs, especiales, u = .VDC_UMBRALES) {
  a <- suppressWarnings(as.numeric(as.character(data[[fr$name]])))
  validos <- if (identical(fr$clase, "select_one")) fr$niveles$valor else a[!is.na(a)]
  k <- .vd_sm_count_selected(mu$name, data)
  ok <- !is.na(a) & a %in% validos & !as.character(a) %in% especiales & .vdc_respondio_multiple(data, mu$name)
  if (sum(ok) < u$min_casos) return(NULL)
  t <- as.integer(max(u$muchas_min, floor(mu$n_contenido / 2) + 1L))
  if (t > mu$n_contenido) return(NULL)
  minimo <- min(a[ok])
  bajo <- ok & a == minimo
  resto <- ok & a > minimo
  filas <- which(bajo & k >= t)
  obs <- length(filas)
  if (!obs || !any(resto)) return(NULL)
  n_bajo <- sum(bajo); n_resto <- sum(resto); x_resto <- sum(resto & k >= t)
  esp <- n_bajo * x_resto / n_resto
  p <- if (esp > 0) stats::ppois(obs, esp) else NA_real_
  rara <- esp >= u$rareza_esperado_min && obs <= u$rareza_razon * esp && is.finite(p) && p < u$rareza_p
  nivel <- .vdc_nivel_rotulo(fr, minimo)
  op_gate <- if (identical(fr$clase, "select_one")) "==" else "<="
  mayor <- if (identical(fr$clase, "select_one")) "una frecuencia mayor" else "un número mayor"
  texto <- sprintf(
    "Responden \"%s\" en %s y marcan %d o más de las %d opciones de %s: %d de los %d que responden \"%s\" (%s). Entre quienes responden %s, %d de %d (%s).",
    nivel, fr$name, t, mu$n_opciones, mu$name, obs, n_bajo, nivel, .vdc_pct(obs, n_bajo),
    mayor, x_resto, n_resto, .vdc_pct(x_resto, n_resto))
  if (rara) texto <- paste(texto, sprintf("Con esa proporción se esperarían %s; hay %d.", .vdc_fmt_num(round(esp, 1)), obs))
  list(
    familia = "combinacion", tipo = "frecuencia_multiple", fuerte = rara,
    variables = list(.vdc_pregunta_ref(pregs, fr$name), .vdc_pregunta_ref(pregs, mu$name)),
    titulo = sprintf("%s \"%s\" con %d o más opciones marcadas en %s", fr$name, nivel, t, mu$name),
    texto = texto,
    cifra = list(n_casos = obs, base_n = n_bajo, base = sprintf("casos que responden \"%s\" en %s y responden %s", nivel, fr$name, mu$name),
                 n_resto = n_resto, n_resto_muchas = x_resto, esperados = round(esp, 2),
                 p_rareza = signif(p, 3), umbral_opciones = t),
    filas = filas,
    regla = list(
      tipo = "select_multiple_cardinality", variables = list(mu$name), params = list(max = t - 1L),
      gate_expr = "", gate_conditions = list(list(variable = fr$name, op = op_gate, value = as.character(minimo))),
      nombre = sprintf("%s \"%s\" con %d o más opciones en %s", fr$name, nivel, t, mu$name),
      mensaje = sprintf("Responde \"%s\" en %s y marca %d o más opciones en %s.", nivel, fr$name, t, mu$name),
      severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar", origen = "sembrado",
      semilla = list(origen = "detector_consistencia", n_casos_afectados = as.integer(obs),
                     porque = sprintf("%d de los %d que responden \"%s\" en %s marcan %d o más opciones en %s.",
                                      obs, n_bajo, nivel, fr$name, t, mu$name))
    )
  )
}

#' Celdas raras entre dos preguntas categóricas que el analista pidió cruzar
#' @keywords internal
.vdc_par_categorico <- function(data, a, b, pregs, especiales, u = .VDC_UMBRALES) {
  va <- trimws(as.character(data[[a]])); vb <- trimws(as.character(data[[b]]))
  ok <- .vdc_con_dato(data[[a]]) & .vdc_con_dato(data[[b]]) & !va %in% especiales & !vb %in% especiales
  n_ok <- sum(ok)
  if (n_ok < u$min_casos) return(list())
  tab <- table(va[ok], vb[ok])
  fila <- rowSums(tab); col <- colSums(tab)
  n_celdas <- length(tab)
  out <- list()
  for (i in rownames(tab)) for (j in colnames(tab)) {
    obs <- tab[i, j]
    if (obs < 1) next
    esp <- fila[[i]] * col[[j]] / n_ok
    p <- stats::ppois(obs, esp)
    if (esp < u$rareza_esperado_min || obs > u$rareza_razon * esp || p >= u$rareza_p / n_celdas) next
    filas <- which(ok & va == i & vb == j)
    out[[length(out) + 1L]] <- list(
      familia = "combinacion", tipo = "categorica_pedida", fuerte = TRUE,
      variables = list(.vdc_pregunta_ref(pregs, a), .vdc_pregunta_ref(pregs, b)),
      titulo = sprintf("%s \"%s\" junto con %s \"%s\"", a, i, b, j),
      texto = sprintf("%d %s responden \"%s\" en %s y \"%s\" en %s; si las dos preguntas fueran independientes se esperarían %s, de %d casos con dato en las dos.",
                      as.integer(obs), .vdc_plural(obs, "caso", "casos"), i, a, j, b, .vdc_fmt_num(round(esp, 1)), n_ok),
      cifra = list(n_casos = as.integer(obs), base_n = n_ok, base = sprintf("casos con dato en %s y %s", a, b),
                   esperados = round(esp, 2), p_rareza = signif(p, 3)),
      filas = filas,
      regla = list(
        tipo = "condiciones", variables = list(a, b),
        params = list(modo = "todas", condiciones = list(list(variable = a, op = "==", valor = i),
                                                        list(variable = b, op = "==", valor = j))),
        nombre = sprintf("%s \"%s\" junto con %s \"%s\"", a, i, b, j),
        mensaje = sprintf("Responde \"%s\" en %s y \"%s\" en %s.", i, a, j, b),
        severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar", origen = "sembrado",
        semilla = list(origen = "detector_consistencia", n_casos_afectados = as.integer(obs),
                       porque = sprintf("Se esperaban %s casos con esa combinación y hay %d.", .vdc_fmt_num(round(esp, 1)), as.integer(obs)))
      )
    )
  }
  out
}

#' Familia (b): combinaciones implausibles entre preguntas
#'
#' @param pares lista de pares `c(a, b)` pedidos por el analista. Un par con
#'   una pregunta que no está en la base corta con `E_BAD_REQUEST`.
#' @keywords internal
.vdc_familia_combinaciones <- function(data, pregs, choices, especiales, pares = list(), u = .VDC_UMBRALES) {
  frs <- .vdc_frecuencias(data, pregs, choices, especiales)
  mus <- .vdc_multiples(data, pregs, choices, especiales)
  out <- list()
  for (fr in frs) for (mu in mus) {
    if (.vdc_misma_seccion(fr, mu)) out[[length(out) + 1L]] <- .vdc_par_frecuencia(data, fr, mu, pregs, especiales, u)
  }
  vistos <- vapply(out, function(s) paste(vapply(s$variables, `[[`, "", "variable"), collapse = "|"), "")
  for (par in pares) {
    par <- as.character(unlist(par))
    if (length(par) != 2L || any(!nzchar(par))) {
      stop_api(400, "E_BAD_REQUEST", "Cada par a cruzar lleva dos preguntas.", list(par = par))
    }
    falta <- par[!par %in% names(data) & !vapply(par, function(v) any(startsWith(names(data), paste0(v, "/"))), logical(1))]
    if (length(falta)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La base no tiene la pregunta %s.", paste(falta, collapse = " ni ")),
               list(preguntas = falta))
    }
    fr <- Filter(function(f) f$name %in% par, .vdc_frecuencias_forzadas(data, pregs, choices, especiales, par))
    mu <- Filter(function(m) m$name %in% par, mus)
    if (length(fr) && length(mu) && !paste(fr[[1]]$name, mu[[1]]$name, sep = "|") %in% vistos) {
      out[[length(out) + 1L]] <- .vdc_par_frecuencia(data, fr[[1]], mu[[1]], pregs, especiales, u)
    } else if (!length(mu)) {
      out <- c(out, .vdc_par_categorico(data, par[1], par[2], pregs, especiales, u))
    } else if (!length(fr)) {
      stop_api(400, "E_BAD_REQUEST",
               sprintf("El par %s y %s no se puede cruzar: una opción múltiple se cruza con una pregunta de opción única o numérica.", par[1], par[2]),
               list(par = par))
    }
  }
  Filter(Negate(is.null), out)
}

# En un par pedido, la pregunta que no es múltiple se mira como frecuencia o
# cantidad aunque su texto no lo diga: el analista ya decidió que el par tiene sentido.
.vdc_frecuencias_forzadas <- function(data, pregs, choices, especiales, par) {
  if (is.null(pregs)) return(list())
  out <- list()
  for (v in par) {
    p <- pregs[match(v, pregs$name), ]
    if (is.na(p$name)) next
    if (identical(p$tipo, "select_one")) {
      niv <- .vdc_niveles(choices, p$lista, especiales)
      if (!is.null(niv) && nrow(niv) >= 2L) out[[length(out) + 1L]] <- list(name = v, clase = "select_one", niveles = niv)
    } else if (p$tipo %in% c("integer", "decimal")) {
      out[[length(out) + 1L]] <- list(name = v, clase = "numero", niveles = NULL)
    }
  }
  out
}
