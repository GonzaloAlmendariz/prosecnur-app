# =============================================================================
# Explorador de variables — la restricción numérica que declara el XLSForm (E8h)
# =============================================================================
# Un «dato imposible» no se adivina por el nombre de la variable: sale de lo que el formulario declara. Se leen sólo
# restricciones que son cotas simples sobre el valor (`. >= 0`, `. > 0 and . <= 95`, `18 <= .`), unidas con `and`.
# Cualquier otra cosa (`or`, funciones, otras variables, `regex()`) no se evalúa: mejor no decir nada que afirmar
# algo que el formulario no dice. Se cuenta sobre TODOS los casos de la base del cruce, no sobre la muestra dibujada.
# Los códigos especiales declarados (etiquetas de valor de la columna: 90 «No aplica», 98 «No sabe»…) no son datos
# imposibles aunque caigan fuera de la cota: se cuentan aparte, en `especiales` (revisión metodológica, 2026-11-03).
# Supuestos:
#   S1. La restricción es la del instrumento actual: si la base mezcla versiones del formulario o una derivada
#       conserva el nombre original, la cota puede no aplicar a todos los casos.
#   S2. Se empareja por nombre (`.explorar_match_row`): una derivada con otro nombre no hereda la cota.
#   S3. Sin etiquetas de valor, todo valor fuera de las cotas se cuenta.
#   S4. La tendencia de la dispersión se ajusta sólo con los casos dentro de las cotas y sin especiales.

.explorador_cota <- function(clausula) {
  t <- trimws(clausula)
  num <- "(-?[0-9]+(?:\\.[0-9]+)?)"
  m <- regmatches(t, regexec(paste0("^\\.\\s*(>=|>|<=|<)\\s*", num, "$"), t))[[1]]
  if (length(m) == 3L) return(list(op = m[2], valor = as.numeric(m[3])))
  m <- regmatches(t, regexec(paste0("^", num, "\\s*(>=|>|<=|<)\\s*\\.$"), t))[[1]]
  if (length(m) == 3L) {
    # «18 <= .» es «. >= 18»: se invierte el operador.
    inv <- c(">=" = "<=", ">" = "<", "<=" = ">=", "<" = ">")
    return(list(op = unname(inv[m[3]]), valor = as.numeric(m[2])))
  }
  NULL
}

#' Cotas de una restricción del XLSForm; NULL si no es una conjunción de cotas simples sobre el valor
#' @keywords internal
.explorador_limites_restriccion <- function(regla) {
  if (is.null(regla) || length(regla) != 1L || is.na(regla) || !nzchar(trimws(regla))) return(NULL)
  clausulas <- strsplit(regla, "\\s+and\\s+", perl = TRUE)[[1]]
  cotas <- lapply(clausulas, .explorador_cota)
  if (!length(cotas) || any(vapply(cotas, is.null, logical(1)))) return(NULL)
  cotas
}

#' Texto corto de las cotas: «≥ 18 y ≤ 95»
#' @keywords internal
.explorador_texto_cotas <- function(cotas) {
  sim <- c(">=" = "≥", ">" = ">", "<=" = "≤", "<" = "<")
  paste(vapply(cotas, function(c) sprintf("%s %s", sim[[c$op]], .fmt_num(c$valor)), ""), collapse = " y ")
}

#' Códigos especiales declarados en la columna: los valores con etiqueta de una numérica (haven / SAV)
#' @keywords internal
.explorador_especiales_declarados <- function(col) {
  labs <- attr(col, "labels", exact = TRUE)
  if (is.null(labs) || !length(labs)) return(numeric(0))
  v <- suppressWarnings(as.numeric(unname(labs)))
  v[!is.na(v)]
}

#' Qué valores quedan fuera de las cotas (NA no cuenta: no responde)
#' @keywords internal
.explorador_fuera_de_cotas <- function(v, cotas) {
  fuera <- rep(FALSE, length(v))
  for (c in cotas) {
    cumple <- switch(c$op, ">=" = v >= c$valor, ">" = v > c$valor, "<=" = v <= c$valor, "<" = v < c$valor)
    fuera <- fuera | (!is.na(cumple) & !cumple)
  }
  fuera
}

#' Las cotas de la restricción de una variable; NULL si no declara una evaluable
#' @keywords internal
.explorador_cotas_de <- function(instrumento, var) {
  surv <- .explorador_ficha_survey(instrumento)
  if (is.null(surv)) return(NULL)
  regla <- .explorador_ficha_celda(surv, .explorar_match_row(surv, var), "constraint")
  cotas <- .explorador_limites_restriccion(regla)
  if (is.null(cotas)) return(NULL)
  list(regla = regla, cotas = cotas)
}

#' La restricción de una numérica y cuántos casos de la base la incumplen (sin contar los especiales declarados)
#' @param r Lo que devuelve `.explorador_cotas_de` (NULL → NULL).
#' @keywords internal
.explorador_restriccion <- function(r, valores, especiales = numeric(0)) {
  if (is.null(r)) return(NULL)
  v <- as.numeric(valores)
  es_especial <- !is.na(v) & v %in% especiales
  # Cada cota con sus propios incumplimientos: el front sombrea sólo el lado que se incumple.
  cotas <- lapply(r$cotas, function(c) list(op = c$op, valor = c$valor,
                                            fuera = as.integer(sum(.explorador_fuera_de_cotas(v, list(c)) & !es_especial))))
  list(
    regla = r$regla,
    texto = .explorador_texto_cotas(r$cotas),
    cotas = cotas,
    fuera = as.integer(sum(.explorador_fuera_de_cotas(v, r$cotas) & !es_especial)),
    especiales = as.integer(sum(es_especial)),
    n = as.integer(sum(!is.na(v)))
  )
}

#' Qué casos entran a la tendencia: dentro de las cotas y sin especiales (TRUE si la variable no declara cotas)
#' @keywords internal
.explorador_dentro <- function(r, valores, especiales = numeric(0)) {
  v <- as.numeric(valores)
  ok <- !(v %in% especiales)
  if (!is.null(r)) ok <- ok & !.explorador_fuera_de_cotas(v, r$cotas)
  ok
}
