# **Variable calculada por fórmula.** ADR 0106, regla `formula`.
#
# Una base declara una variable como una expresión aritmética sobre sus propias
# columnas: `2026 - P8`, `P5 + P6`, `(P10 / P11) * 100`. Es la herramienta
# general para construir desde cero una variable (y, agrupada luego en rangos,
# un segmento de cruce) sin una ayuda distinta para cada caso.
#
# La expresión NO se evalúa como código R: se tokeniza y se interpreta con un
# parser propio que sólo conoce números, nombres de columnas, `+ - * /`,
# paréntesis y el signo menos. Nada más llega a ejecutarse.
#
# Sin dato:
#   - una celda vacía o que no es un número;
#   - en una variable con lista de respuestas (select_one del instrumento o
#     calculada con escala), un código especial 80–99 («Otro», «No sabe», «No
#     responde»…): un 88 no es un año ni una cantidad. Esas variables se
#     guardan en `especiales_na` al declarar, para que la regla sea visible y no
#     dependa de releer el instrumento;
#   - una división por cero.
# Una operación con un sin dato da sin dato.

.BASE_VARIABLES_FORMULA_MAX <- 500L

.bv_formula_error <- function(mensaje, expresion = "") {
  stop_api(422, "E_BASE_VARIABLE_FORMULA_INVALIDA", mensaje, list(expresion = expresion))
}

#' Tokens de una expresión: `num`, `var`, `op` (+ - * /), `abre`, `cierra`.
#' @keywords internal
base_variables_formula_tokens <- function(expresion) {
  x <- .origen_externo_chr(expresion)
  if (!nzchar(trimws(x))) .bv_formula_error("Escribe la fórmula: por ejemplo «2026 - P8» o «P5 + P6».", x)
  if (nchar(x) > .BASE_VARIABLES_FORMULA_MAX) {
    .bv_formula_error(sprintf("La fórmula pasa de %d caracteres.", .BASE_VARIABLES_FORMULA_MAX), x)
  }
  # Signos tipográficos que se escriben a mano: × ÷ − (menos) y la coma decimal no.
  x <- gsub("×", "*", x, fixed = TRUE)
  x <- gsub("÷", "/", x, fixed = TRUE)
  x <- gsub("−", "-", x, fixed = TRUE)
  tokens <- list()
  i <- 1L
  n <- nchar(x)
  while (i <= n) {
    resto <- substr(x, i, n)
    ch <- substr(x, i, i)
    if (grepl("^\\s", ch)) { i <- i + 1L; next }
    m <- regmatches(resto, regexpr("^[0-9]+(\\.[0-9]+)?", resto))
    if (length(m)) {
      tokens[[length(tokens) + 1L]] <- list(tipo = "num", valor = m, pos = i)
      i <- i + nchar(m); next
    }
    if (identical(ch, "`")) {
      fin <- regexpr("`", substr(x, i + 1L, n), fixed = TRUE)
      if (fin < 1L) .bv_formula_error(sprintf("Falta cerrar la comilla invertida que abre en la posición %d.", i), x)
      nombre <- substr(x, i + 1L, i + fin - 1L)
      if (!nzchar(trimws(nombre))) .bv_formula_error("Hay un nombre de variable vacío entre comillas invertidas.", x)
      tokens[[length(tokens) + 1L]] <- list(tipo = "var", valor = nombre, pos = i)
      i <- i + fin + 1L; next
    }
    m <- regmatches(resto, regexpr("^[A-Za-z_][A-Za-z0-9_.]*", resto))
    if (length(m)) {
      tokens[[length(tokens) + 1L]] <- list(tipo = "var", valor = m, pos = i)
      i <- i + nchar(m); next
    }
    if (ch %in% c("+", "-", "*", "/")) {
      tokens[[length(tokens) + 1L]] <- list(tipo = "op", valor = ch, pos = i)
      i <- i + 1L; next
    }
    if (identical(ch, "(")) { tokens[[length(tokens) + 1L]] <- list(tipo = "abre", valor = ch, pos = i); i <- i + 1L; next }
    if (identical(ch, ")")) { tokens[[length(tokens) + 1L]] <- list(tipo = "cierra", valor = ch, pos = i); i <- i + 1L; next }
    if (identical(ch, ",")) {
      .bv_formula_error("Usa punto para los decimales (2.5, no 2,5).", x)
    }
    .bv_formula_error(sprintf(
      "«%s» (posición %d) no se puede usar: la fórmula admite números, variables de la base, + - * / y paréntesis.",
      ch, i), x)
  }
  tokens
}

#' Árbol de la expresión. Gramática:
#'   expr   := termino (('+'|'-') termino)*
#'   termino:= factor (('*'|'/') factor)*
#'   factor := '-' factor | número | variable | '(' expr ')'
#' @keywords internal
base_variables_formula_parsear <- function(expresion) {
  tk <- base_variables_formula_tokens(expresion)
  x <- .origen_externo_chr(expresion)
  pos <- 1L
  mira <- function() if (pos <= length(tk)) tk[[pos]] else NULL
  esperado <- function(que) {
    t <- mira()
    if (is.null(t)) .bv_formula_error(sprintf("La fórmula termina antes de tiempo: falta %s.", que), x)
    .bv_formula_error(sprintf("Se esperaba %s en la posición %d y llega «%s».", que, t$pos, t$valor), x)
  }
  factor <- function() {
    t <- mira()
    if (is.null(t)) esperado("un número o una variable")
    if (identical(t$tipo, "op") && identical(t$valor, "-")) {
      pos <<- pos + 1L
      return(list(tipo = "neg", x = factor()))
    }
    if (identical(t$tipo, "num")) { pos <<- pos + 1L; return(list(tipo = "num", valor = as.numeric(t$valor))) }
    if (identical(t$tipo, "var")) { pos <<- pos + 1L; return(list(tipo = "var", nombre = t$valor)) }
    if (identical(t$tipo, "abre")) {
      pos <<- pos + 1L
      e <- expr()
      t2 <- mira()
      if (is.null(t2) || !identical(t2$tipo, "cierra")) esperado("«)»")
      pos <<- pos + 1L
      return(e)
    }
    esperado("un número o una variable")
  }
  termino <- function() {
    izq <- factor()
    repeat {
      t <- mira()
      if (is.null(t) || !identical(t$tipo, "op") || !(t$valor %in% c("*", "/"))) break
      pos <<- pos + 1L
      izq <- list(tipo = "op", op = t$valor, izq = izq, der = factor())
    }
    izq
  }
  expr <- function() {
    izq <- termino()
    repeat {
      t <- mira()
      if (is.null(t) || !identical(t$tipo, "op") || !(t$valor %in% c("+", "-"))) break
      pos <<- pos + 1L
      izq <- list(tipo = "op", op = t$valor, izq = izq, der = termino())
    }
    izq
  }
  arbol <- expr()
  if (pos <= length(tk)) {
    t <- tk[[pos]]
    .bv_formula_error(sprintf("Sobra «%s» en la posición %d: falta un operador o hay un «)» de más.", t$valor, t$pos), x)
  }
  arbol
}

#' Variables que nombra una expresión, en orden de aparición y sin repetir.
#' @keywords internal
base_variables_formula_variables <- function(arbol) {
  rec <- function(a) switch(a$tipo,
    var = a$nombre,
    num = character(0),
    neg = rec(a$x),
    op = c(rec(a$izq), rec(a$der)))
  unique(rec(arbol))
}

# Una columna como número: vacío y texto no numérico, NA; un especial 80–99 de
# una variable con lista de respuestas, NA.
.bv_formula_numero <- function(x, especial_na) {
  if (is.factor(x)) x <- as.character(x)
  v <- suppressWarnings(as.numeric(as.character(unclass(x))))
  if (isTRUE(especial_na)) v[.equiv_bloques_es_especial(v)] <- NA_real_
  v
}

#' Valor por caso de una fórmula sobre `df`.
#' @param especiales_na variables cuyos códigos 80–99 cuentan como sin dato.
#' @keywords internal
base_variables_formula_evaluar <- function(arbol, df, especiales_na = character(0)) {
  n <- nrow(df)
  rec <- function(a) switch(a$tipo,
    num = rep(a$valor, n),
    var = .bv_formula_numero(df[[a$nombre]], a$nombre %in% especiales_na),
    neg = -rec(a$x),
    op = {
      i <- rec(a$izq); d <- rec(a$der)
      switch(a$op, "+" = i + d, "-" = i - d, "*" = i * d, "/" = i / d)
    })
  out <- rec(arbol)
  out[!is.finite(out)] <- NA_real_
  # Sin ruido de coma flotante: 0.1 + 0.2 se lee 0.3.
  round(out, 10)
}

#' Resumen de una calculada numérica: casos con valor, sin dato, mínimo y máximo.
#' @keywords internal
base_variables_resumen_numerico <- function(valores) {
  v <- valores[!is.na(valores)]
  list(
    por_codigo = list(),
    n_sin_dato = as.integer(sum(is.na(valores))),
    n_total = as.integer(length(valores)),
    n_validos = as.integer(length(v)),
    minimo = if (length(v)) min(v) else NULL,
    maximo = if (length(v)) max(v) else NULL
  )
}
