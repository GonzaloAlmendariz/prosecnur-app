# =============================================================================
# graficos_tarjetas_publicos.R — tarjetas de diferencias entre públicos (ADR 0138)
# =============================================================================
#
# Las tarjetas del ADR 0129 comparan los grupos de un cruce dentro de UNA base. Estas comparan el mismo tema entre
# públicos (bases distintas), con el mismo lenguaje visual. No prueban nada por su cuenta: apilan las bases y usan la
# regla del estudio (`.sig_evaluar` + `.sig_veredictos`, ADR 0128).
#
# Invariantes (revisión metodológica del 2026-11-08):
#   - grano: la fila de cada base. Cada público es un estrato propio (y el estrato de la regla, si la base lo trae, se
#     anida dentro de su público). Los conglomerados se toman de la columna de la regla si la base la trae, prefijados con
#     el nombre de la base; si no, cada caso es su propio conglomerado (muestreo aleatorio simple, sin fpc);
#   - pesos de cada base (`.radar_mb_pesos`, los mismos del gráfico); denominador: respuestas válidas de cada base.
#     Para la base de la z el peso se lleva a media 1 dentro de cada público (la proporción no cambia);
#   - grados de libertad de Rao-Scott: el MÍNIMO del par (conglomerados menos estratos de cada público), no los del
#     apilado entero, que inflarían la confianza del público chico;
#   - pares de públicos, nunca «frente al resto» (el resto lo dominaría el público más grande); sin fila Total;
#   - sólo temas con equivalencia declarada: la matriz (`s$equivalencias_publicos`) o el par explícito que la lámina
#     declara (lo que escribe «Revisar emparejado»). El emparejado por nombre de `base$*` no cuenta;
#   - escalas de tema distinto se abstienen; con el mismo tema y códigos distintos, el Top Two Box se resuelve por
#     posición (graficos_escala_armonizada.R);
#   - abstención honesta con motivo: base mínima, denominador cero, filtro sobre una columna ausente, base repeat, o cifras
#     de la prueba que no cuadran con el gráfico.
#
# La familia de BH entre públicos vive en graficos_significancia_familia_publicos.R y nunca se mezcla con la de una base.

.TPUB_VEREDICTOS <- c("marcada", "fragil", "bajo_umbral", "no_significativa", "no_comparable", "escalas_distintas",
                      "sin_equivalencia", "fuera_de_familia")
.TPUB_CRUCE <- "entre_publicos"
.TPUB_ROTULO <- "Entre públicos"
.TPUB_MAX_LINEAS <- 4L
.TPUB_MOTIVO_NO_CUADRA <- "las cifras de la prueba no cuadran con el gráfico; no se compara"
.TPUB_MOTIVO_ESCALAS <- "escalas distintas, no se compara"
.TPUB_MOTIVO_SIN_EQUIV <- "sin equivalencia declarada entre públicos, no se compara"
.TPUB_MOTIVO_FUERA_FAMILIA <- "la comparación no está en la familia entre públicos del informe; no se marca"

#' Opción de la lámina: NULL si no pide tarjetas entre públicos; si las pide, la lista normalizada
#'
#' `meta.tarjetas_diferencias = {activo, entre_publicos: true, temas?, indicador?, cortos?, max?}`. `temas` restringe
#' los temas del gráfico que pueden llevar tarjeta; `cortos` nombra a cada público («docentes» → «Docentes TC»).
#' @keywords internal
.tpub_opcion <- function(meta) {
  x <- (meta %||% list())$tarjetas_diferencias
  if (!is.list(x) || identical(x$activo, FALSE)) return(NULL)
  if (!isTRUE(as.logical(unlist(x$entre_publicos %||% FALSE))[1])) return(NULL)
  mx <- suppressWarnings(as.integer(unlist(x$max %||% .TARJETAS_MAX))[1])
  if (is.na(mx) || mx < 1L) mx <- .TARJETAS_MAX
  cortos <- x$cortos %||% list()
  cortos <- if (length(cortos) && !is.null(names(cortos))) {
    v <- vapply(cortos, function(z) as.character(unlist(z))[1], character(1)); v[!is.na(v) & nzchar(v)]
  } else character(0)
  temas <- trimws(as.character(unlist(x$temas %||% character(0))))
  ind <- trimws(as.character(unlist(x$indicador %||% ""))[1])
  list(activo = TRUE, entre_publicos = TRUE, max = min(mx, 9L), temas = temas[!is.na(temas) & nzchar(temas)],
       indicador = if (is.na(ind) || !nzchar(ind)) NULL else ind, cortos = cortos, todas = FALSE, modo = "panel")
}

# --- Temas y su equivalencia -------------------------------------------------------------------------------------

#' Refs de un tema como vector nombrado base -> variable (NULL si alguna no es `base$var`)
#' @keywords internal
.tpub_refs <- function(refs) {
  refs <- trimws(as.character(unlist(refs)))
  partes <- lapply(refs, .graficos_ref_parts)
  base <- vapply(partes, `[[`, "", "source"); var <- vapply(partes, `[[`, "", "name")
  if (!length(refs) || any(!nzchar(base)) || any(!nzchar(var))) return(NULL)
  stats::setNames(var, base)
}

#' ¿La matriz declara este tema? Cada par de bases del tema tiene que ser una fila confirmada de la matriz
#' @keywords internal
.tpub_en_matriz <- function(refs, equiv) {
  if (is.null(equiv) || length(refs) < 2L) return(FALSE)
  bs <- names(refs)
  for (i in seq_len(length(bs) - 1L)) for (j in (i + 1L):length(bs)) {
    pm <- .emparejado_pares_matriz(equiv, bs[i], bs[j])
    if (!any(pm$a == refs[[i]] & pm$b == refs[[j]])) return(FALSE)
  }
  TRUE
}

#' Temas del gráfico con su equivalencia
#'
#' @param vars_render Temas que dibuja el gráfico (`tema -> refs`), ya con la regla de preguntas aplicada.
#' @param vars_lamina Temas que la lámina declara (antes de la regla): un tema con refs explícitas es un par confirmado
#'   («Revisar emparejado» escribe así lo que se confirma); uno `base$*` no declara nada.
#' @param equiv `s$equivalencias_publicos`.
#' @return Lista de `list(tema, refs, equivalencia)`; `equivalencia` es «emparejado», «matriz» o NA.
#' @keywords internal
.tpub_temas_declarados <- function(vars_render, vars_lamina = vars_render, equiv = NULL) {
  explicitas <- lapply(vars_lamina %||% list(), function(r) {
    r <- trimws(as.character(unlist(r)))
    if (!length(r) || any(grepl("\\$\\*$|^\\*$", r))) NULL else sort(r)
  })
  explicitas <- Filter(Negate(is.null), explicitas)
  out <- list()
  for (tema in names(vars_render)) {
    crudas <- trimws(as.character(unlist(vars_render[[tema]])))
    refs <- .tpub_refs(crudas)
    eq <- NA_character_
    if (!is.null(refs) && !anyDuplicated(names(refs))) {
      if (any(vapply(explicitas, function(e) identical(e, sort(crudas)), logical(1)))) eq <- "emparejado"
      else if (.tpub_en_matriz(refs, equiv)) eq <- "matriz"
    }
    out[[length(out) + 1L]] <- list(tema = tema, refs = refs, equivalencia = eq)
  }
  out
}

# --- Escala e indicador por base ---------------------------------------------------------------------------------

#' Códigos del indicador en cada base
#'
#' Misma firma de escala: los códigos del corte en todas. Firma distinta: sólo si las dos escalas son del mismo tema
#' (acuerdo con acuerdo) y se alinean por posición (`.escala_arm_motivo`); entonces el corte se traduce por posición
#' entre las opciones sustantivas. Temas distintos (acuerdo frente a satisfacción) o no alineables: «escalas distintas».
#' @return `list(ok, codigos = list(base -> chr), motivo)`.
#' @keywords internal
.tpub_codigos_por_base <- function(refs, corte, sources) {
  corte <- as.character(.radar_mb_codigos(corte))
  bases <- names(refs)
  inst <- lapply(bases, function(b) (sources$inst_sources %||% list())[[b]])
  firmas <- vapply(seq_along(bases), function(i) .equiv_firma_escala(inst[[i]], refs[[i]]) %||% "", character(1))
  todas_iguales <- length(unique(firmas)) == 1L
  if (todas_iguales) return(list(ok = TRUE, codigos = stats::setNames(rep(list(corte), length(bases)), bases), motivo = NULL))
  opciones <- lapply(seq_along(bases), function(i) .equiv_escala_opciones(inst[[i]], refs[[i]]))
  if (any(lengths(opciones) == 0L)) return(list(ok = FALSE, codigos = NULL, motivo = .TPUB_MOTIVO_ESCALAS))
  formas <- lapply(opciones, .escala_arm_forma_opciones)
  # Referencia: la primera base cuya escala trae el corte entero.
  cod_de <- function(op) vapply(op, function(o) as.character(o$codigo)[1], character(1))
  etq_de <- function(op) vapply(op, function(o) as.character(o$etiqueta)[1], character(1))
  ref <- which(vapply(opciones, function(op) all(corte %in% cod_de(op)), logical(1)))[1]
  if (is.na(ref)) return(list(ok = FALSE, codigos = NULL, motivo = .TPUB_MOTIVO_ESCALAS))
  norm <- .escala_etiqueta_normalizada
  pos <- match(norm(etq_de(opciones[[ref]])[match(corte, cod_de(opciones[[ref]]))]), norm(formas[[ref]]$sustantivas))
  if (anyNA(pos)) return(list(ok = FALSE, codigos = NULL, motivo = .TPUB_MOTIVO_ESCALAS))
  out <- list()
  for (i in seq_along(bases)) {
    if (identical(firmas[i], firmas[ref])) { out[[bases[i]]] <- corte; next }
    f <- formas[[i]]; fr <- formas[[ref]]
    mismo_tema <- !is.na(f$tema) && identical(f$tema, fr$tema)
    if (!mismo_tema || !is.null(.escala_arm_motivo(fr, f))) {
      return(list(ok = FALSE, codigos = NULL, motivo = .TPUB_MOTIVO_ESCALAS))
    }
    etq <- f$sustantivas[pos]
    out[[bases[i]]] <- cod_de(opciones[[i]])[match(norm(etq), norm(etq_de(opciones[[i]])))]
  }
  list(ok = TRUE, codigos = out, motivo = NULL)
}

# --- Evaluación de un tema ---------------------------------------------------------------------------------------

#' Intervalo de Wilson de una proporción (dato informativo del inspector; del código retirado del ADR 0137)
#' @keywords internal
.tpub_wilson <- function(x, n, z) {
  p <- x / n; c_ <- (p + z^2 / (2 * n)) / (1 + z^2 / n)
  h <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / (1 + z^2 / n)
  c(c_ - h, c_ + h)
}

#' Intervalo de Newcombe (híbrido de Wilson) de p1 − p2, sin ponderar: informativo, nunca decide la marca
#' @keywords internal
.tpub_newcombe <- function(x1, n1, x2, n2, conf = 0.95) {
  if (!(n1 > 0 && n2 > 0)) return(c(NA_real_, NA_real_))
  z <- stats::qnorm(1 - (1 - conf) / 2); p1 <- x1 / n1; p2 <- x2 / n2
  w1 <- .tpub_wilson(x1, n1, z); w2 <- .tpub_wilson(x2, n2, z); d <- p1 - p2
  c(d - sqrt((p1 - w1[1])^2 + (w2[2] - p2)^2), d + sqrt((w1[2] - p1)^2 + (p2 - w2[1])^2))
}

#' Datos de un público para el tema: indicador, pesos, conglomerado y estrato anidados en su base
#' @return `list(y, w, cl, st, x, n, motivo)`; `motivo` no NULL si la base se abstiene.
#' @keywords internal
.tpub_datos_base <- function(base, var, codigos, sources, regla, filtros = list()) {
  vacio <- function(m) list(y = numeric(0), w = numeric(0), cl = character(0), st = character(0), x = 0, n = 0L, motivo = m)
  ctx <- .graficos_consolidado_ref_context(paste0(base, "$", var), sources)
  if (!isTRUE(ctx$exists)) return(vacio("la pregunta no existe en esta base"))
  if (!identical(.graficos_sig_diseno_de_fuente(ctx$inst, ctx$resolved_variable), "independiente")) {
    return(vacio("cada persona aporta varias respuestas (grupo repetido); no se compara"))
  }
  d <- (sources$data_sources %||% list())[[base]]
  falta <- NULL
  d <- tryCatch(.apply_named_filters(d, filters = filtros %||% list(), arg_name = "filtros", mode = "strict"),
                pulso_filter_missing_column = function(cnd) { falta <<- cnd$variable %||% "?"; NULL })
  if (!is.null(falta)) return(vacio(sprintf("el filtro usa \"%s\", que esta base no tiene; no se compara", falta)))
  x <- trimws(as.character(d[[ctx$resolved_variable]]))
  valido <- !is.na(x) & nzchar(x)
  y <- ifelse(valido, as.numeric(x %in% as.character(codigos)), NA_real_)
  w <- .radar_mb_pesos(d)
  n <- nrow(d)
  cl_col <- regla$conglomerado %||% ""
  cl <- if (identical(regla$prueba, "rao_scott") && nzchar(cl_col) && cl_col %in% names(d)) {
    v <- trimws(as.character(d[[cl_col]])); vac <- is.na(v) | !nzchar(v)
    ifelse(vac, paste0(base, "\r.caso_", seq_len(n)), paste0(base, "\r", v))
  } else paste0(base, "\r.caso_", seq_len(n))
  st_col <- regla$estrato %||% ""
  st <- if (nzchar(st_col) && st_col %in% names(d)) {
    v <- trimws(as.character(d[[st_col]])); ifelse(is.na(v) | !nzchar(v), base, paste0(base, "\r", v))
  } else rep(base, n)
  list(y = y, w = w, cl = cl, st = st, x = sum(y[valido] == 1), n = sum(valido),
       motivo = if (!any(valido)) "sin respuestas válidas en esta base; no se compara" else NULL)
}

#' Grados de libertad de un público: conglomerados con casos en la base del tema menos sus estratos
#' @keywords internal
.tpub_gl_base <- function(dat) {
  ok <- !is.na(dat$y) & dat$w > 0
  if (!any(ok)) return(0L)
  as.integer(length(unique(dat$cl[ok])) - length(unique(dat$st[ok])))
}

#' Evalúa un tema entre sus públicos, sin ajustar el p todavía
#'
#' @param refs Vector nombrado base -> variable, en el orden de los públicos.
#' @param etiquetas Rótulo de cada público (nombrado por base).
#' @return `list(tema, refs, bases, etiquetas, estado, motivo, ev, datos, gl)`. `estado`: «evaluable», «escalas_distintas»,
#'   «sin_equivalencia» o «abstencion» (menos de dos públicos comparables con datos).
#' @keywords internal
.tpub_evaluar_tema <- function(tema, refs, corte, sources, regla, filtros = list(), etiquetas = NULL,
                               equivalencia = "emparejado") {
  bases <- names(refs)
  etiquetas <- etiquetas %||% stats::setNames(.radar_mb_capitalizar(bases), bases)
  out <- list(tema = tema, refs = refs, bases = bases, etiquetas = etiquetas[bases], estado = "evaluable",
              motivo = NA_character_, ev = NULL, datos = list(), gl = integer(0), equivalencia = equivalencia)
  if (is.na(equivalencia)) { out$estado <- "sin_equivalencia"; out$motivo <- .TPUB_MOTIVO_SIN_EQUIV; return(out) }
  cod <- .tpub_codigos_por_base(refs, corte, sources)
  if (!isTRUE(cod$ok)) { out$estado <- "escalas_distintas"; out$motivo <- cod$motivo; return(out) }
  datos <- lapply(bases, function(b) .tpub_datos_base(b, refs[[b]], cod$codigos[[b]], sources, regla, filtros))
  names(datos) <- bases
  out$datos <- datos
  out$gl <- vapply(datos, .tpub_gl_base, integer(1))
  activas <- bases[vapply(datos, function(d) is.null(d$motivo), logical(1))]
  if (length(activas) < 2L) {
    out$estado <- "abstencion"
    out$motivo <- "menos de dos públicos con datos para comparar"
    return(out)
  }
  pila <- function(campo) unlist(lapply(activas, function(b) datos[[b]][[campo]]), use.names = FALSE)
  g <- unlist(lapply(activas, function(b) rep(b, length(datos[[b]]$y))), use.names = FALSE)
  ind <- list(Y = matrix(pila("y"), ncol = 1L, dimnames = list(NULL, tema)), w = pila("w"), tipo = "so")
  r1 <- regla; r1$max_letras <- max(length(activas), as.integer(regla$max_letras %||% 6L))   # pares, nunca frente al resto
  # El peso se lleva a media 1 dentro de cada público: la z no toma la suma de pesos de una base como su n.
  ev <- .sig_evaluar(ind, g, activas, unname(etiquetas[activas]), cluster = pila("cl"), estrato = pila("st"),
                     regla = r1, filas = tema, unidad_pesos = g)
  if (identical(regla$prueba, "rao_scott") && !is.null(ev$pares) && nrow(ev$pares)) {
    # Grados de libertad del par: el mínimo de los dos públicos (los del apilado los inflarían).
    df <- pmax(1L, pmin(out$gl[ev$pares$a], out$gl[ev$pares$b]))
    t <- ev$pares$estadistico
    ev$pares$p <- ifelse(is.finite(t), 2 * stats::pt(-abs(t), df = df), ev$pares$p)
    q <- stats::qt(0.975, df = df)
    ev$pares$ic_lo <- ev$pares$dif - q * ev$pares$se
    ev$pares$ic_hi <- ev$pares$dif + q * ev$pares$se
    ev$pares$gl <- df
  }
  out$ev <- ev
  out
}

#' Los p de un tema que entran a la familia entre públicos (elegibles, de temas con escala comparable)
#' @keywords internal
.tpub_p_familia <- function(te) if (identical(te$estado, "evaluable") && !is.null(te$ev)) .sig_p_para_familia(te$ev) else numeric(0)

#' Ajusta el p y asigna veredictos a los temas evaluados
#'
#' @param familia Tabla de BH entre públicos (`.tpub_familia_tabla`). Con `bh_informe` y sin familia, la familia son
#'   los temas de esta llamada (`familia_local = TRUE`); nunca la de una base. Con la familia del plan, un p que no está
#'   en ella (la vista previa pudo leer otras cifras que las de la familia) no se ajusta con el q de un vecino: queda
#'   `fuera_de_familia`, no se marca y el tema lo dice en su motivo.
#' @keywords internal
.tpub_veredictos <- function(temas, regla, familia = NULL) {
  local <- FALSE
  if (identical(regla$correccion, "bh_informe") && (is.null(familia) || !familia$m)) {
    familia <- .sig_bh_tabla(unlist(lapply(temas, .tpub_p_familia), use.names = FALSE))
    local <- TRUE
  }
  temas <- lapply(temas, function(te) {
    if (identical(te$estado, "evaluable") && !is.null(te$ev)) {
      te$ev <- .sig_veredictos(te$ev, regla, familia, exigir_familia = !local)
      te$fuera_de_familia <- as.integer(te$ev$fuera_de_familia %||% 0L)
      if (te$fuera_de_familia > 0L && is.na(te$motivo)) te$motivo <- .TPUB_MOTIVO_FUERA_FAMILIA
    }
    te$familia_local <- local
    te
  })
  attr(temas, "familia") <- list(m = as.integer(familia$m %||% 0L), local = local)
  temas
}

#' Conciliación con el gráfico: la prueba tiene que ver las mismas cifras que dibuja la lámina
#'
#' @param referencia Vector nombrado base -> valor (0-100) del gráfico para ese tema; NULL no concilia.
#' @return El tema, con estado «abstencion» si alguna cifra no cuadra (tolerancia 1e-6 puntos).
#' @keywords internal
.tpub_conciliar <- function(te, referencia) {
  if (is.null(referencia) || !identical(te$estado, "evaluable") || is.null(te$ev$celdas)) return(te)
  ce <- te$ev$celdas
  graf <- suppressWarnings(as.numeric(referencia[ce$grupo]))
  prueba <- 100 * ce$p
  no_cuadra <- (is.finite(prueba) != is.finite(graf)) | (is.finite(prueba) & is.finite(graf) & abs(prueba - graf) > 1e-6)
  if (!any(no_cuadra)) return(te)
  te$estado <- "abstencion"
  te$motivo <- .TPUB_MOTIVO_NO_CUADRA
  te
}

#' Proporción ponderada de un público (para mostrarla cuando no entra a la prueba)
#' @keywords internal
.tpub_p_base <- function(dat) {
  ok <- !is.na(dat$y) & dat$w > 0
  if (!any(ok)) NA_real_ else sum(dat$w[ok] * dat$y[ok]) / sum(dat$w[ok])
}

#' Grupos de un tema en la forma del contrato: `{base, etiqueta, p, n, comparable, motivo}` (p en 0-100)
#' @keywords internal
.tpub_grupos <- function(te) {
  ce <- te$ev$celdas
  do.call(rbind, lapply(te$bases, function(b) {
    dat <- te$datos[[b]] %||% list()
    k <- if (is.null(ce)) integer(0) else which(ce$grupo == b)
    p <- if (length(k)) ce$p[k[1]] else if (length(dat$y)) .tpub_p_base(dat) else NA_real_
    n <- if (length(k)) ce$n[k[1]] else as.numeric(dat$n %||% 0)
    comparable <- identical(te$estado, "evaluable") && length(k) > 0L && isTRUE(ce$comparable[k[1]])
    motivo <- dat$motivo %||% (if (length(k) && !isTRUE(ce$comparable[k[1]])) ce$motivo[k[1]] else NA_character_)
    if (!identical(te$estado, "evaluable") && is.na(motivo)) motivo <- te$motivo
    data.frame(base = b, etiqueta = unname(te$etiquetas[[b]]), p = 100 * p, n = as.numeric(n), comparable = comparable,
               motivo = motivo %||% NA_character_, stringsAsFactors = FALSE)
  }))
}

#' Pares de un tema en la forma del contrato: todos los pares de públicos, probados o no
#'
#' `a` es el de mayor proporción cuando el par se probó; `dif_pp` es la resta de las cifras que se leen (redondeo
#' mitad hacia arriba). Un par que no se probó lleva el veredicto del tema (o «no_comparable») y p ajustado NA.
#' @keywords internal
.tpub_pares <- function(te, alfa = 0.05) {
  bs <- te$bases
  if (length(bs) < 2L) return(NULL)
  gr <- .tpub_grupos(te)
  pct <- stats::setNames(gr$p, gr$base)
  combos <- utils::combn(length(bs), 2L)
  pr <- te$ev$pares
  veredicto_tema <- switch(te$estado, escalas_distintas = "escalas_distintas", sin_equivalencia = "sin_equivalencia",
                           "no_comparable")
  redondo <- function(x) .pulso_round_half_up(round(x, 6), 0L)
  filas <- lapply(seq_len(ncol(combos)), function(k) {
    i <- bs[combos[1, k]]; j <- bs[combos[2, k]]
    hit <- if (is.null(pr) || !nrow(pr)) integer(0) else which((pr$a == i & pr$b == j) | (pr$a == j & pr$b == i))
    probado <- length(hit) > 0L && identical(te$estado, "evaluable")
    a <- if (probado) pr$a[hit[1]] else i; b <- if (probado) pr$b[hit[1]] else j
    if (!probado && is.finite(pct[[a]]) && is.finite(pct[[b]]) && pct[[b]] > pct[[a]]) { tmp <- a; a <- b; b <- tmp }
    da <- te$datos[[a]] %||% list(); db <- te$datos[[b]] %||% list()
    ic <- .tpub_newcombe(da$x %||% 0, da$n %||% 0, db$x %||% 0, db$n %||% 0, conf = 1 - alfa)
    data.frame(tema = te$tema, a = a, b = b, etiqueta_a = unname(te$etiquetas[[a]]), etiqueta_b = unname(te$etiquetas[[b]]),
               p_a = pct[[a]], p_b = pct[[b]], dif_pp = redondo(pct[[a]]) - redondo(pct[[b]]),
               p = if (probado) pr$p[hit[1]] else NA_real_,
               p_ajustado = if (probado) pr$p_ajustado[hit[1]] %||% NA_real_ else NA_real_,
               veredicto = if (probado) pr$veredicto[hit[1]] %||% "no_comparable" else veredicto_tema,
               newcombe_lo = 100 * ic[1], newcombe_hi = 100 * ic[2], stringsAsFactors = FALSE)
  })
  do.call(rbind, filas)
}

# --- Tarjetas ----------------------------------------------------------------------------------------------------

#' Cifra del público para la línea de un par: «78%»
#' @keywords internal
.tpub_pct <- function(x) ifelse(is.finite(x), paste0(.pulso_round_half_up(round(x, 6), 0L), "%"), "—")

#' Espacio que no se parte: une el público a su cifra y la diferencia a su «pp ▲» al envolver la línea
#' @keywords internal
.TPUB_NBSP <- "\u00a0"

#' Línea de un par marcado: «Docentes 78% frente a Estudiantes 64%: +14 pp ▲» (△ si es frágil)
#'
#' «Estudiantes 64%» y «+14 pp ▲» van unidos con espacios que no se parten (`.TPUB_NBSP`): la línea se envuelve entre
#' esos bloques, nunca dentro. `.lam_lineas_tinta` corta por `\\s+`, que en UTF-8 no casa el espacio duro, así que mide
#' cada bloque como una palabra.
#' @keywords internal
.tpub_linea_par <- function(etq_a, p_a, etq_b, p_b, dif_pp, fragil = FALSE) {
  nb <- .TPUB_NBSP
  sprintf("%s%s%s frente a %s%s%s: %s%s%spp%s%s", etq_a, nb, .tpub_pct(p_a), etq_b, nb, .tpub_pct(p_b),
          if (dif_pp > 0) "+" else "", format(dif_pp, trim = TRUE), nb, nb, if (isTRUE(fragil)) "△" else "▲")
}

#' Pares que se muestran (marcadas y, salvo `fragiles = "ocultar"`, frágiles), en el orden de la tarjeta
#'
#' Primero las del 99 % (marcada), luego por diferencia de mayor a menor; tope de cuatro.
#' @keywords internal
.tpub_pares_visibles <- function(pares, regla, tope = .TPUB_MAX_LINEAS) {
  if (is.null(pares) || !nrow(pares)) return(pares)
  muestra <- pares$veredicto == "marcada" | (pares$veredicto == "fragil" & !identical(regla$fragiles, "ocultar"))
  v <- pares[muestra, , drop = FALSE]
  if (!nrow(v)) return(v)
  v <- v[order(v$veredicto == "fragil", -abs(v$p_a - v$p_b)), , drop = FALSE]
  utils::head(v, tope)
}

#' Tarjeta de un tema con diferencias, o NULL
#'
#' Con dos públicos es la tarjeta de dos grupos del ADR 0129 (`.tarjetas_armar`: los dos con ▲ y ▼), sin fila Total.
#' Con tres o más, una línea por par marcado.
#' @keywords internal
.tpub_tarjeta <- function(te, regla, opt = list(), titulo = "") {
  if (!identical(te$estado, "evaluable")) return(NULL)
  pares <- .tpub_pares(te, regla$alfa %||% 0.05)
  vis <- .tpub_pares_visibles(pares, regla)
  if (is.null(vis) || !nrow(vis)) return(NULL)
  gr <- .tpub_grupos(te)
  fila <- te$tema
  comun <- list(tipo = .TPUB_CRUCE, sin_total = TRUE, total = NA_real_, cifra_total = NA_character_,
                indicador = opt$indicador %||% NULL,
                fila_es_titulo = nzchar(titulo) && .lam_mismo_texto(fila, titulo),
                evaluacion = list(grupos = gr, pares = pares, motivo = te$motivo))
  if (length(te$bases) == 2L) {
    ts <- data.frame(cruce = .TPUB_CRUCE, fila = fila, grupo = vis$a, sube = TRUE, fragil = vis$veredicto == "fragil",
                     dif = abs(vis$p_a - vis$p_b), p_ajustado = vis$p_ajustado, stringsAsFactors = FALSE)
    celdas <- data.frame(cruce = .TPUB_CRUCE, fila = fila, grupo = gr$base, p = gr$p, stringsAsFactors = FALSE)
    grupos <- data.frame(cruce = .TPUB_CRUCE, codigo = gr$base, etiqueta = gr$etiqueta, stringsAsFactors = FALSE)
    t <- .tarjetas_armar(ts, celdas, grupos, stats::setNames(NA_real_, fila))
    t[names(comun)] <- comun
    return(t)
  }
  lineas <- vapply(seq_len(nrow(vis)), function(k) .tpub_linea_par(vis$etiqueta_a[k], vis$p_a[k], vis$etiqueta_b[k],
                                                                    vis$p_b[k], vis$dif_pp[k], vis$veredicto[k] == "fragil"), "")
  t <- list(cruce = .TPUB_CRUCE, fila = fila, grupos = data.frame(codigo = character(), etiqueta = character(), p = numeric(),
                                                                   dir = character(), fragil = logical()),
            lineas = lineas, lineas_fragil = vis$veredicto == "fragil", fragil = all(vis$veredicto == "fragil"),
            brecha = max(abs(vis$p_a - vis$p_b)))
  t[names(comun)] <- comun
  t
}

#' Pie de las tarjetas entre públicos
#'
#' «Diferencias entre públicos (muestras independientes): prueba z, p < 0.05 con corrección de Bonferroni dentro de
#' cada tema, al menos 10 puntos y 30 casos por público. △ Frágil: p ajustado entre 0.01 y 0.05.»
#'
#' Dice el nivel (α), el alcance de la corrección (Bonferroni dentro de cada tema; Benjamini-Hochberg sobre las
#' comparaciones entre públicos del informe, o de esta lámina si el informe no trae su familia) y, si alguna tarjeta
#' muestra una frágil, qué significa △.
#' @param local TRUE si la familia de BH es la de la propia lámina. @param hay_fragiles TRUE si una tarjeta lleva △.
#' @keywords internal
.tpub_texto_pie <- function(regla, local = FALSE, hay_fragiles = FALSE) {
  prueba <- if (identical(regla$prueba, "rao_scott")) paste0("Rao-Scott por ", .sig_nombre_conglomerado(regla$conglomerado)) else "prueba z"
  alfa <- .sig_num(regla$alfa %||% 0.05)
  corr <- if (identical(regla$correccion, "bh_informe")) {
    paste0("corrección de Benjamini-Hochberg sobre las comparaciones entre públicos ",
           if (isTRUE(local)) "de esta lámina" else "del informe")
  } else "corrección de Bonferroni dentro de cada tema"
  umbral <- regla$umbral_puntos %||% 0
  base <- .sig_num(regla$base_minima %||% 30)
  metodo <- sprintf("%s, p < %s con %s", prueba, alfa, corr)
  texto <- if (umbral > 0) {
    sprintf("Diferencias entre públicos (muestras independientes): %s, al menos %s puntos y %s casos por público.",
            metodo, .sig_num(umbral), base)
  } else {
    sprintf("Diferencias entre públicos (muestras independientes): %s y al menos %s casos por público.", metodo, base)
  }
  if (isTRUE(hay_fragiles)) texto <- sprintf("%s △ Frágil: p ajustado entre 0.01 y %s.", texto, alfa)
  texto
}

#' ¿Alguna tarjeta muestra una diferencia frágil (△)?
#' @keywords internal
.tpub_hay_fragiles <- function(tarjetas) {
  any(vapply(tarjetas, function(t) isTRUE(t$fragil) || any(t$lineas_fragil %in% TRUE) ||
               (is.data.frame(t$grupos) && any(t$grupos$fragil %in% TRUE)), logical(1)))
}

#' Calcula las tarjetas entre públicos de un conjunto de temas declarados
#'
#' @param temas Salida de `.tpub_temas_declarados`.
#' @param referencia Cifras del gráfico: lista `tema -> c(base = valor)`; NULL no concilia (sólo la familia).
#' @param familia Tabla de BH entre públicos.
#' @return `list(tarjetas, total, tipo, opcion, temas, rotulos_cruce, regla, nota, familia)`.
#' @keywords internal
.tpub_calcular <- function(temas, corte, sources, regla, opt = list(), familia = NULL, filtros = list(), referencia = NULL,
                           titulo = "") {
  cortos <- opt$cortos %||% character(0)
  if (length(opt$temas)) temas <- Filter(function(x) x$tema %in% opt$temas, temas)
  ev <- lapply(temas, function(x) {
    bs <- names(x$refs %||% character(0))
    etq <- stats::setNames(ifelse(bs %in% names(cortos), unname(cortos[bs]), .radar_mb_capitalizar(bs)), bs)
    if (is.null(x$refs)) {
      return(list(tema = x$tema, refs = NULL, bases = character(0), etiquetas = character(0), estado = "sin_equivalencia",
                  motivo = .TPUB_MOTIVO_SIN_EQUIV, ev = NULL, datos = list(), equivalencia = NA_character_))
    }
    .tpub_evaluar_tema(x$tema, x$refs, corte, sources, regla, filtros = filtros, etiquetas = etq,
                       equivalencia = x$equivalencia)
  })
  ev <- .tpub_veredictos(ev, regla, familia)
  fam <- attr(ev, "familia")
  ev <- lapply(ev, function(te) .tpub_conciliar(te, if (is.null(referencia)) NULL else referencia[[te$tema]] %||% numeric(0)))
  tarjetas <- Filter(Negate(is.null), lapply(ev, .tpub_tarjeta, regla = regla, opt = opt, titulo = titulo))
  if (length(tarjetas)) {
    fr <- vapply(tarjetas, function(t) isTRUE(t$fragil), logical(1))
    br <- vapply(tarjetas, function(t) as.numeric(t$brecha), numeric(1))
    tarjetas <- tarjetas[order(fr, -br)]
  }
  probados <- any(vapply(ev, function(te) identical(te$estado, "evaluable"), logical(1)))
  visibles <- utils::head(tarjetas, opt$max %||% .TARJETAS_MAX)
  nota <- if (probados) .tpub_texto_pie(regla, local = isTRUE(fam$local), hay_fragiles = .tpub_hay_fragiles(visibles)) else NULL
  list(tarjetas = visibles, total = length(tarjetas), tipo = .TPUB_CRUCE,
       opcion = opt, temas = ev, rotulos_cruce = stats::setNames(.TPUB_ROTULO, .TPUB_CRUCE), cruces = .TPUB_CRUCE,
       grupos = NULL, regla = regla, nota = nota, familia = fam)
}

#' Una tarjeta en la forma del contrato del inspector
#'
#' `{tipo, fila, indicador, grupos: [{base, etiqueta, p, n, comparable, motivo}],
#'   pares: [{a, b, p_a, p_b, dif_pp, p_ajustado, veredicto}], nota}`.
#' @keywords internal
.tpub_tema_json <- function(te, regla, nota = NULL, indicador = NULL) {
  gr <- if (length(te$bases)) .tpub_grupos(te) else NULL
  pr <- if (length(te$bases) >= 2L) .tpub_pares(te, regla$alfa %||% 0.05) else NULL
  na <- function(x) if (length(x) && !is.na(x)) x else NA
  redondo <- function(x) if (is.finite(x)) .pulso_round_half_up(round(x, 6), 0L) else NA
  list(
    tipo = .TPUB_CRUCE, fila = te$tema, indicador = indicador %||% NA, estado = te$estado, motivo = na(te$motivo),
    equivalencia = na(te$equivalencia),
    grupos = if (is.null(gr)) list() else lapply(seq_len(nrow(gr)), function(i) list(
      base = gr$base[i], etiqueta = gr$etiqueta[i], p = redondo(gr$p[i]), n = gr$n[i], comparable = isTRUE(gr$comparable[i]),
      motivo = na(gr$motivo[i]))),
    pares = if (is.null(pr)) list() else lapply(seq_len(nrow(pr)), function(i) list(
      a = pr$a[i], b = pr$b[i], p_a = redondo(pr$p_a[i]), p_b = redondo(pr$p_b[i]), dif_pp = na(pr$dif_pp[i]),
      p = if (is.finite(pr$p[i])) signif(pr$p[i], 4) else NA,
      p_ajustado = if (is.finite(pr$p_ajustado[i])) signif(pr$p_ajustado[i], 4) else NA,
      veredicto = pr$veredicto[i],
      ic_newcombe = if (is.finite(pr$newcombe_lo[i])) round(c(pr$newcombe_lo[i], pr$newcombe_hi[i]), 1) else NA)),
    nota = nota %||% NA
  )
}
