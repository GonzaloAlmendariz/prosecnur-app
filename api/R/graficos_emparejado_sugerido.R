# =============================================================================
# graficos_emparejado_sugerido.R — revisión del emparejado entre públicos (ADR 0135 §7, enmienda al ADR 0104 en Gráficos)
# =============================================================================
#
# El contraste entre públicos compara la misma pregunta en dos bases. Los pares salen de la matriz de equivalencias
# (filas sin `sugerida`). Una pregunta sin par puede recibir hasta tres candidatas de la otra base por parecido de
# texto y con la misma firma de escala, con su puntaje. Esto es sólo lectura: la UI confirma, cambia o descarta fila por
# fila y guarda lo confirmado en la matriz con los endpoints de equivalencias (GET, unión, POST). Carga › Equivalencias
# sigue sin «Proponer emparejados».
#
#   POST /api/graficos/resumenes/emparejado {bases: [A, B], vars?, scope?} (router_graficos_regla.R)
#     -> {ok, bases, preguntas: [{tema, base, var, etiqueta, estado: "matriz"|"sin_par", par?, sugerencias}]}
#
# El parecido es el índice de Jaccard entre los conjuntos de palabras del enunciado normalizado (sin tildes, en
# minúsculas, sin signos y sin palabras vacías cortas). Es determinista: los empates se resuelven por el orden del
# instrumento de destino.

.EMPAREJADO_VACIAS <- c("a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "le", "les", "lo", "los", "me", "mi",
                        "o", "para", "por", "que", "se", "su", "sus", "te", "tu", "u", "un", "una", "uno", "y", "ya")
.EMPAREJADO_MAX <- 3L
.EMPAREJADO_MINIMO <- 0.2

#' Palabras de un enunciado para compararlo: sin tildes, minúsculas, sin signos ni palabras vacías cortas
#' @return Lista de vectores de palabras únicas, alineada con `x`.
#' @keywords internal
.equiv_sugerir_tokens <- function(x) {
  x <- as.character(x); x[is.na(x)] <- ""
  x <- chartr("áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ", "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC", x)
  x <- gsub("[^a-z0-9]+", " ", tolower(x))
  lapply(strsplit(trimws(x), "\\s+"), function(t) {
    t <- t[nzchar(t) & !t %in% .EMPAREJADO_VACIAS]
    unique(t)
  })
}

#' Candidatas por parecido de texto para cada pregunta de origen (función pura)
#'
#' @param etiquetas_origen Enunciados de las preguntas sin par, con nombres = variable.
#' @param etiquetas_destino Enunciados de las preguntas de la otra base que pueden recibir un par, nombres = variable,
#'   en el orden del instrumento.
#' @param firmas `list(origen = c(var = firma), destino = c(var = firma))`: sólo se proponen las de la misma firma de
#'   escala. Una firma vacía no casa con nada.
#' @param max Candidatas por pregunta (3).
#' @param minimo Puntaje mínimo (0.2): por debajo no se propone.
#' @return Lista con nombres = variable de origen; cada elemento, `data.frame(var, etiqueta, puntaje)` ordenado por puntaje
#'   (de mayor a menor) y, a igual puntaje, por el orden de destino. Puntaje en [0, 1] con tres decimales.
#' @keywords internal
.equiv_sugerir_pares <- function(etiquetas_origen, etiquetas_destino, firmas, max = .EMPAREJADO_MAX,
                                 minimo = .EMPAREJADO_MINIMO) {
  vacio <- data.frame(var = character(0), etiqueta = character(0), puntaje = numeric(0), stringsAsFactors = FALSE)
  vo <- names(etiquetas_origen) %||% character(0); vd <- names(etiquetas_destino) %||% character(0)
  fo <- as.character((firmas$origen %||% character(0))[vo]); fd <- as.character((firmas$destino %||% character(0))[vd])
  fo[is.na(fo)] <- ""; fd[is.na(fd)] <- ""
  to <- .equiv_sugerir_tokens(etiquetas_origen); td <- .equiv_sugerir_tokens(etiquetas_destino)
  out <- lapply(seq_along(vo), function(i) {
    if (!nzchar(fo[i]) || !length(to[[i]]) || !length(vd)) return(vacio)
    cand <- which(fd == fo[i])
    if (!length(cand)) return(vacio)
    p <- vapply(cand, function(j) {
      u <- length(union(to[[i]], td[[j]]))
      if (!u) 0 else length(intersect(to[[i]], td[[j]])) / u
    }, numeric(1))
    p <- round(p, 3)
    keep <- p >= minimo
    cand <- cand[keep]; p <- p[keep]
    if (!length(cand)) return(vacio)
    o <- order(-p, cand)[seq_len(min(max, length(cand)))]
    data.frame(var = vd[cand[o]], etiqueta = unname(as.character(etiquetas_destino[cand[o]])), puntaje = p[o],
               stringsAsFactors = FALSE)
  })
  stats::setNames(out, vo)
}

#' Pares que la matriz declara entre dos bases: filas sin `sugerida` con variable (no expresión) en las dos
#' @return `data.frame(a, b, tema)`.
#' @keywords internal
.emparejado_pares_matriz <- function(equiv, base_a, base_b) {
  filas <- (equiv %||% list())$filas %||% list()
  out <- lapply(filas, function(f) {
    if (isTRUE(f$sugerida)) return(NULL)
    v <- f$variables %||% list()
    a <- as.character(v[[base_a]] %||% "")[1]; b <- as.character(v[[base_b]] %||% "")[1]
    if (is.na(a) || is.na(b) || !nzchar(a) || !nzchar(b)) return(NULL)
    if (!is.null(.equiv_deriv_entrada(f, base_a)) || !is.null(.equiv_deriv_entrada(f, base_b))) return(NULL)
    data.frame(a = a, b = b, tema = as.character(f$etiqueta_estandar %||% "")[1], stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, Filter(Negate(is.null), out))
  if (is.null(out)) data.frame(a = character(0), b = character(0), tema = character(0), stringsAsFactors = FALSE) else out
}

#' Revisión del emparejado entre dos bases (lo que responde el endpoint)
#'
#' Universo: las preguntas de escala de cada base (`.regla_preguntas_de_base`, como `base$*`), o las de `vars` si se
#' declaran (`base$var`). Primero las de la base A: con par de la matriz o sin par con sus candidatas de B; después las
#' de B que quedan sin par, con candidatas de A. Las candidatas excluyen las preguntas que ya tienen par en la matriz.
#' @param equiv `s$equivalencias_publicos`.
#' @param sources Fuentes del estudio (`data_sources`, `inst_sources`).
#' @param bases Las dos bases, en su orden.
#' @param vars Referencias `base$var` que acotan el universo; `NULL` = todas las de escala.
#' @keywords internal
.graficos_emparejado <- function(equiv, sources, bases, vars = NULL) {
  bases <- trimws(as.character(unlist(bases %||% character(0))))
  if (length(bases) != 2L || anyDuplicated(bases) || any(!nzchar(bases))) {
    stop_api(400, "E_EMPAREJADO_INVALIDO", "El emparejado se revisa entre dos bases distintas.")
  }
  faltan <- setdiff(bases, names(sources$inst_sources %||% list()))
  if (length(faltan)) stop_api(400, "E_EMPAREJADO_INVALIDO", sprintf("La base «%s» no está en el estudio.", faltan[1]))
  refs <- trimws(as.character(unlist(vars %||% character(0))))
  universo <- lapply(bases, function(b) {
    vs <- .regla_preguntas_de_base(b, character(0), sources) %||% character(0)
    if (length(refs)) {
      propias <- sub(paste0("^", b, "\\$"), "", refs[startsWith(refs, paste0(b, "$"))])
      vs <- vs[vs %in% propias]
    }
    vs
  })
  names(universo) <- bases
  inst <- lapply(bases, function(b) sources$inst_sources[[b]]); names(inst) <- bases
  etq <- function(b, vs) stats::setNames(vapply(vs, function(v) .regla_preguntas_rotulo(inst[[b]], v), ""), vs)
  firma <- function(b, vs) stats::setNames(vapply(vs, function(v) .equiv_firma_escala(inst[[b]], v), ""), vs)
  pares <- .emparejado_pares_matriz(equiv, bases[1], bases[2])
  pares <- pares[pares$a %in% universo[[1]] | pares$b %in% universo[[2]], , drop = FALSE]
  libres <- list(setdiff(universo[[1]], pares$a), setdiff(universo[[2]], pares$b))
  preguntas <- list()
  fila <- function(b, v, estado, tema, par = NULL, sug = NULL) {
    out <- list(tema = tema, base = b, var = v, etiqueta = unname(etq(b, v)), estado = estado)
    if (!is.null(par)) out$par <- par
    out$sugerencias <- if (is.null(sug) || !nrow(sug)) list() else lapply(seq_len(nrow(sug)), function(i) {
      list(base = sug$base[i], var = sug$var[i], etiqueta = sug$etiqueta[i], puntaje = sug$puntaje[i])
    })
    out
  }
  sugerir <- function(desde, hacia) {
    o <- libres[[desde]]; d <- libres[[hacia]]
    s <- .equiv_sugerir_pares(etq(bases[desde], o), etq(bases[hacia], d),
                              list(origen = firma(bases[desde], o), destino = firma(bases[hacia], d)))
    lapply(s, function(x) { x$base <- rep(bases[hacia], nrow(x)); x })
  }
  sug_a <- sugerir(1L, 2L)
  for (v in universo[[1]]) {
    i <- match(v, pares$a)
    if (!is.na(i)) {
      tema <- if (nzchar(pares$tema[i])) pares$tema[i] else unname(etq(bases[1], v))
      preguntas[[length(preguntas) + 1L]] <- fila(bases[1], v, "matriz", tema,
                                                  par = list(base = bases[2], var = pares$b[i], etiqueta = unname(etq(bases[2], pares$b[i]))))
    } else {
      preguntas[[length(preguntas) + 1L]] <- fila(bases[1], v, "sin_par", unname(etq(bases[1], v)), sug = sug_a[[v]])
    }
  }
  sug_b <- sugerir(2L, 1L)
  for (v in libres[[2]]) preguntas[[length(preguntas) + 1L]] <- fila(bases[2], v, "sin_par", unname(etq(bases[2], v)), sug = sug_b[[v]])
  list(ok = TRUE, bases = as.list(bases), preguntas = preguntas)
}
