# =============================================================================
# Helpers de la familia indicador (internos + API publica)
# =============================================================================

# -----------------------------------------------------------------------------
# Internos compartidos
# -----------------------------------------------------------------------------

.ind_or <- function(x, y) if (!is.null(x)) x else y

.ind_validate_data_frame <- function(data, caller = "familia indicador") {
  if (!is.data.frame(data)) {
    stop(caller, ": `data` debe ser un data.frame o tibble.", call. = FALSE)
  }
  invisible(TRUE)
}

.ind_resolve_instrumento <- function(
    data,
    instrumento = NULL,
    caller = "familia indicador",
    required = TRUE
) {
  instrumento <- .ind_or(instrumento, attr(data, "instrumento_reporte", exact = TRUE))

  if (is.null(instrumento)) {
    if (isTRUE(required)) {
      stop(
        caller,
        ": no se pudo resolver `instrumento`. Pasalo explicitamente o usa salida de `reporte_data()`.",
        call. = FALSE
      )
    }
    return(NULL)
  }

  if (!is.list(instrumento)) {
    stop(caller, ": `instrumento` debe ser una lista.", call. = FALSE)
  }

  instrumento
}

.ind_as_named_chr <- function(x) {
  if (is.null(x)) return(stats::setNames(character(0), character(0)))
  v <- as.character(unlist(x, use.names = TRUE))
  n <- names(v)
  if (is.null(n)) return(stats::setNames(character(0), character(0)))
  ok <- !is.na(n) & nzchar(trimws(n)) & !is.na(v) & nzchar(trimws(v))
  stats::setNames(v[ok], n[ok])
}

.ind_nm_get <- function(x, key) {
  key <- as.character(.ind_or(key, ""))[1]
  if (!nzchar(key)) return(NULL)
  nms <- names(x)
  if (is.null(nms)) return(NULL)
  i <- match(key, nms)
  if (is.na(i)) return(NULL)
  as.character(x[i])[1]
}

.ind_pretty_label <- function(x) {
  x <- as.character(.ind_or(x, ""))
  x <- gsub("^idx_", "", x)
  x <- gsub("^sub_", "", x)
  x <- gsub("^r100_", "", x)
  x <- gsub("[_\\.]+", " ", x)
  x <- trimws(x)
  if (!nzchar(x)) return("Variable")
  paste0(toupper(substring(x, 1, 1)), substring(x, 2))
}

.ind_norm_token <- function(x) {
  y <- as.character(x)
  y <- iconv(y, from = "", to = "ASCII//TRANSLIT")
  y <- tolower(trimws(y))
  y <- gsub("\\s+", " ", y)
  y
}

.ind_cfg_by_list <- function(cfg, list_name) {
  if (is.null(cfg)) return(character(0))
  if (is.list(cfg)) {
    nms <- names(cfg)
    if (!is.null(nms) && length(nms)) {
      if (!is.na(list_name) && nzchar(list_name) && list_name %in% nms) {
        return(as.character(cfg[[list_name]]))
      }
      if (".default" %in% nms) {
        return(as.character(cfg[[".default"]]))
      }
    }
    return(character(0))
  }
  as.character(cfg)
}

# -----------------------------------------------------------------------------
# Internos de evaluacion logica
# -----------------------------------------------------------------------------

#' @keywords internal
.ind_observado <- function(x) {
  y <- as.character(x)
  !is.na(y) & nzchar(trimws(y)) & y != "NA"
}

#' @keywords internal
.ind_norm_codigos <- function(codigos, arg = "codigos") {
  z <- as.character(codigos)
  z <- trimws(z)
  z <- z[!is.na(z) & nzchar(z)]
  z <- unique(z)
  if (!length(z)) {
    stop("`", arg, "` debe tener al menos un valor no vacio.", call. = FALSE)
  }
  z
}

#' @keywords internal
.ind_logic_inputs <- function(..., fn = "ind_alguna") {
  xs <- list(...)
  if (!length(xs)) {
    stop("`", fn, "()` requiere al menos un argumento logico.", call. = FALSE)
  }

  n <- length(xs[[1]])
  out <- lapply(seq_along(xs), function(i) {
    xi <- as.logical(xs[[i]])
    if (length(xi) != n) {
      stop(
        "`", fn, "()` recibio largos inconsistentes (", n, " vs ", length(xi), ").",
        call. = FALSE
      )
    }
    xi[is.na(xi)] <- FALSE
    xi
  })
  out
}

#' @keywords internal
.ind_group_from_data <- function(name, vars, data) {
  cols <- lapply(vars, function(v) data[[v]])
  out <- list(name = as.character(name)[1], vars = as.character(vars), cols = cols)
  class(out) <- c("prosecnur_grupo_data", "list")
  out
}

#' @keywords internal
.ind_collect_cols <- function(args, fn = "helper") {
  if (!length(args)) {
    stop("`", fn, "()` requiere al menos una variable.", call. = FALSE)
  }

  cols <- list()
  for (i in seq_along(args)) {
    x <- args[[i]]
    if (inherits(x, "prosecnur_grupo_data")) {
      cols <- c(cols, x$cols)
    } else {
      cols[[length(cols) + 1L]] <- x
    }
  }

  if (!length(cols)) {
    stop("`", fn, "()` no pudo resolver variables validas.", call. = FALSE)
  }

  cols
}

# -----------------------------------------------------------------------------
# API estandar: helpers prefijados con ind_
# -----------------------------------------------------------------------------

#' Helpers logicos para definir indicadores (`ind_*`)
#'
#' Estas funciones permiten escribir reglas de niveles en
#' `nivel(cuando = ~ ...)` de forma consistente y legible.
#'
#' El estandar actual del paquete es usar solo helpers con prefijo `ind_`.
#'
#' @section Que evalua esta familia:
#' \itemize{
#'   \item Todas las comparaciones se hacen por codigo usando `as.character(...)`.
#'   \item `NA`, cadena vacia (`""`) y texto `"NA"` se tratan como no observado.
#'   \item Todas retornan un vector logico fila-a-fila.
#'   \item En funciones variadicas, los argumentos deben tener largo consistente.
#' }
#'
#' @section Funciones disponibles:
#' \describe{
#'   \item{`ind_es(x, codigo)`}{Comparacion exacta contra un solo codigo.}
#'   \item{`ind_en(x, codigos)`}{Comparacion contra un conjunto de codigos.}
#'   \item{`ind_alguna(...)`}{OR logico: al menos una condicion es `TRUE`.}
#'   \item{`ind_todas(...)`}{AND logico: todas las condiciones son `TRUE`.}
#'   \item{`ind_ninguna(...)`}{Negacion de OR: equivale a `!ind_alguna(...)`.}
#'   \item{`ind_alguna_en(..., codigos)`}{Al menos una variable esta en `codigos`.}
#'   \item{`ind_todas_en(..., codigos)`}{Todas las variables estan en `codigos`.}
#'   \item{`ind_alguna_obs(...)`}{Al menos una variable tiene dato observado.}
#'   \item{`ind_todas_obs(...)`}{Todas las variables tienen dato observado.}
#' }
#'
#' @section Diferencia clave entre `ind_es` e `ind_en`:
#' \strong{Usa `ind_es` cuando la regla tiene un unico codigo exacto.}
#' Ejemplo: "cumple solo si la respuesta es \code{"1"}".
#'
#' \strong{Usa `ind_en` cuando la regla acepta varios codigos.}
#' Ejemplo: "cumple si la respuesta es \code{"1"} o \code{"2"}".
#'
#' Regla practica:
#' \itemize{
#'   \item Si en tu frase dices "es exactamente X", usa `ind_es`.
#'   \item Si en tu frase dices "esta entre X, Y, Z", usa `ind_en`.
#' }
#'
#' Resultado esperado:
#' \itemize{
#'   \item `ind_es(x, "1")` solo marca `TRUE` cuando `x` es `"1"`.
#'   \item `ind_en(x, c("1","2"))` marca `TRUE` cuando `x` es `"1"` o `"2"`.
#' }
#'
#' @section Combinadores logicos -- `ind_alguna`, `ind_todas`, `ind_ninguna`:
#' Estas tres funciones \strong{no miran variables directamente}; reciben
#' \strong{condiciones ya evaluadas} (vectores logicos) y las combinan.
#'
#' \strong{Usa `ind_alguna` cuando basta con que UNA condicion se cumpla.}
#' Ejemplo: "cumple si respondio \code{"1"} en P17_1 \strong{o} en P17_2".
#'
#' \strong{Usa `ind_todas` cuando TODAS las condiciones deben cumplirse.}
#' Ejemplo: "cumple si respondio \code{"1"} en P17_1 \strong{y} en P17_2".
#'
#' \strong{Usa `ind_ninguna` cuando NINGUNA condicion debe cumplirse.}
#' Ejemplo: "cumple si \strong{no} respondio \code{"1"} en ninguna de las dos".
#'
#' Regla practica:
#' \itemize{
#'   \item Si en tu frase dices "al menos una", usa `ind_alguna`.
#'   \item Si en tu frase dices "todas", usa `ind_todas`.
#'   \item Si en tu frase dices "ninguna", usa `ind_ninguna`.
#' }
#'
#' Resultado esperado:
#' \preformatted{
#' a <- c(TRUE,  FALSE, FALSE)
#' b <- c(FALSE, TRUE,  FALSE)
#'
#' ind_alguna(a, b)
#' # TRUE  TRUE  FALSE       (basta una)
#'
#' ind_todas(a, b)
#' # FALSE FALSE FALSE       (ambas deben ser TRUE)
#'
#' ind_ninguna(a, b)
#' # FALSE FALSE TRUE        (ninguna es TRUE)
#' }
#'
#' Nota: los argumentos deben ser vectores logicos del mismo largo.
#' Para pasar condiciones sobre variables usa `ind_es` o `ind_en` dentro:
#' \preformatted{
#' ind_alguna(ind_es(P17_1, "1"), ind_es(P17_2, "1"))
#' }
#'
#' @section Multi-variable con codigos -- `ind_alguna_en` e `ind_todas_en`:
#' Estas funciones son un atajo: reciben \strong{variables directamente}
#' (no condiciones logicas) y aplican `ind_en` sobre cada una.
#'
#' \strong{Usa `ind_alguna_en` cuando basta con que UNA variable tenga
#' un codigo del conjunto.}
#' Ejemplo: "cumple si en P33_1 \strong{o} P33_2 la respuesta es \code{"1"} o \code{"2"}".
#'
#' \strong{Usa `ind_todas_en` cuando TODAS las variables deben tener
#' un codigo del conjunto.}
#' Ejemplo: "cumple si \strong{tanto} P33_1 \strong{como} P33_2 tienen respuesta
#' \code{"1"} o \code{"2"}".
#'
#' Regla practica:
#' \itemize{
#'   \item Si en tu frase dices "al menos una variable esta en ...", usa `ind_alguna_en`.
#'   \item Si en tu frase dices "todas las variables estan en ...", usa `ind_todas_en`.
#' }
#'
#' Equivalencia con los combinadores simples:
#' \preformatted{
#' # Estas dos lineas hacen lo mismo:
#' ind_alguna_en(P33_1, P33_2, codigos = c("1", "2"))
#' ind_alguna(ind_en(P33_1, c("1","2")), ind_en(P33_2, c("1","2")))
#'
#' # Y estas dos tambien:
#' ind_todas_en(P33_1, P33_2, codigos = c("1", "2"))
#' ind_todas(ind_en(P33_1, c("1","2")), ind_en(P33_2, c("1","2")))
#' }
#'
#' Resultado esperado:
#' \preformatted{
#' P33_1 <- c("1", "2", NA)
#' P33_2 <- c("",  "2", NA)
#'
#' ind_alguna_en(P33_1, P33_2, codigos = "1")
#' # TRUE  FALSE FALSE       (solo P33_1[1] es "1")
#'
#' ind_todas_en(P33_1, P33_2, codigos = c("1", "2"))
#' # FALSE TRUE  FALSE       (solo fila 2 tiene ambas en el conjunto)
#' }
#'
#' @section Observacion de datos -- `ind_alguna_obs` e `ind_todas_obs`:
#' Estas funciones verifican si \strong{hay dato}, sin importar cual es.
#' Un dato se considera \strong{no observado} si es `NA`, cadena vacia (`""`)
#' o el texto literal `"NA"`.
#'
#' \strong{Usa `ind_alguna_obs` cuando basta con que UNA variable tenga dato.}
#' Ejemplo: "cumple si respondio \strong{algo} en P33_1 \strong{o} en P33_2".
#'
#' \strong{Usa `ind_todas_obs` cuando TODAS las variables deben tener dato.}
#' Ejemplo: "cumple si respondio \strong{algo} en P33_1 \strong{y} en P33_2".
#'
#' Regla practica:
#' \itemize{
#'   \item Si en tu frase dices "hay al menos una respuesta", usa `ind_alguna_obs`.
#'   \item Si en tu frase dices "todas tienen respuesta", usa `ind_todas_obs`.
#'   \item Si lo que importa es \strong{que valor} tiene, usa `ind_es`, `ind_en`
#'     o las variantes `_en` en su lugar.
#' }
#'
#' Resultado esperado:
#' \preformatted{
#' P33_1 <- c("1", "2", NA)
#' P33_2 <- c("",  "2", NA)
#'
#' ind_alguna_obs(P33_1, P33_2)
#' # TRUE  TRUE  FALSE       (fila 1: P33_1 tiene dato; fila 3: ninguna)
#'
#' ind_todas_obs(P33_1, P33_2)
#' # FALSE TRUE  FALSE       (solo fila 2 tiene dato en ambas)
#' }
#'
#' @section Como leerlas rapido:
#' \tabular{lll}{
#' \strong{Funcion}          \tab \strong{Que hace}                                        \tab \strong{Cuando usarla}                               \cr
#' `ind_es(x, codigo)`       \tab Compara una variable contra un codigo exacto              \tab "es exactamente X"                                   \cr
#' `ind_en(x, codigos)`      \tab Compara una variable contra un conjunto de codigos         \tab "esta entre X, Y, Z"                                 \cr
#' `ind_alguna(...)`          \tab OR logico de condiciones ya evaluadas                     \tab "al menos una condicion se cumple"                    \cr
#' `ind_todas(...)`           \tab AND logico de condiciones ya evaluadas                    \tab "todas las condiciones se cumplen"                    \cr
#' `ind_ninguna(...)`         \tab Negacion de OR                                            \tab "ninguna condicion se cumple"                         \cr
#' `ind_alguna_en(..., cod)`  \tab Al menos una variable esta en `codigos`                   \tab "al menos una variable tiene un codigo del conjunto"  \cr
#' `ind_todas_en(..., cod)`   \tab Todas las variables estan en `codigos`                    \tab "todas las variables tienen un codigo del conjunto"   \cr
#' `ind_alguna_obs(...)`      \tab Al menos una variable tiene dato observado                \tab "hay al menos una respuesta"                          \cr
#' `ind_todas_obs(...)`       \tab Todas las variables tienen dato observado                 \tab "todas tienen respuesta"                              \cr
#' }
#'
#' Resumen por grupo:
#' \itemize{
#'   \item `ind_es` y `ind_en` comparan \strong{una variable} contra codigos.
#'   \item `ind_alguna`, `ind_todas` e `ind_ninguna` combinan \strong{condiciones logicas}.
#'   \item `ind_alguna_en` e `ind_todas_en` aplican `ind_en` sobre \strong{varias variables} a la vez.
#'   \item `ind_alguna_obs` e `ind_todas_obs` verifican \strong{existencia de dato} en varias variables.
#' }
#'
#' @param x Vector de respuestas de una variable.
#' @param codigo Codigo unico a comparar.
#' @param codigos Uno o varios codigos validos.
#' @param ... Argumentos variadicos.
#'   En `ind_alguna`, `ind_todas` e `ind_ninguna` deben ser vectores logicos.
#'   En `ind_alguna_en`, `ind_todas_en`, `ind_alguna_obs` e `ind_todas_obs`
#'   deben ser variables (vectores) a evaluar fila-a-fila.
#'
#' @return Vector logico fila-a-fila.
#'
#' @examples
#' x <- c("1", "2", "", NA, "NA")
#'
#' # ind_es: un unico codigo exacto
#' ind_es(x, "1")
#'
#' # ind_en: uno o varios codigos permitidos
#' ind_en(x, c("1", "2"))
#'
#' # Comparacion directa (misma base, distinta regla)
#' # ind_es(x, "2") es mas estricto que ind_en(x, c("1", "2"))
#' ind_es(x, "2")
#' ind_en(x, c("1", "2"))
#'
#' a <- c(TRUE, FALSE, FALSE)
#' b <- c(FALSE, TRUE, FALSE)
#' ind_alguna(a, b)
#' ind_todas(a, b)
#' ind_ninguna(a, b)
#'
#' P33_1 <- c("1", "2", NA)
#' P33_2 <- c("",  "2", NA)
#' ind_alguna_en(P33_1, P33_2, codigos = "1")
#' ind_todas_en(P33_1, P33_2, codigos = c("1", "2"))
#' ind_alguna_obs(P33_1, P33_2)
#' ind_todas_obs(P33_1, P33_2)
#'
#' @family indicador
#' @name ind_helpers
NULL

#' @rdname ind_helpers
#' @export
ind_es <- function(x, codigo) {
  code <- .ind_norm_codigos(codigo, arg = "codigo")
  if (length(code) > 1L) {
    stop("`codigo` en `ind_es()` debe ser un unico valor.", call. = FALSE)
  }
  y <- as.character(x)
  .ind_observado(y) & trimws(y) == code[1]
}

#' @rdname ind_helpers
#' @export
ind_en <- function(x, codigos) {
  codes <- .ind_norm_codigos(codigos)
  y <- trimws(as.character(x))
  .ind_observado(y) & y %in% codes
}

#' @rdname ind_helpers
#' @export
ind_alguna <- function(...) {
  xs <- .ind_logic_inputs(..., fn = "ind_alguna")
  Reduce(`|`, xs)
}

#' @rdname ind_helpers
#' @export
ind_todas <- function(...) {
  xs <- .ind_logic_inputs(..., fn = "ind_todas")
  Reduce(`&`, xs)
}

#' @rdname ind_helpers
#' @export
ind_ninguna <- function(...) {
  !ind_alguna(...)
}

#' @rdname ind_helpers
#' @export
ind_alguna_en <- function(..., codigos) {
  if (missing(codigos)) {
    stop("`ind_alguna_en()` requiere `codigos = ...`.", call. = FALSE)
  }
  cols <- .ind_collect_cols(list(...), fn = "ind_alguna_en")
  masks <- lapply(cols, function(x) ind_en(x, codigos = codigos))
  do.call(ind_alguna, masks)
}

#' @rdname ind_helpers
#' @export
ind_todas_en <- function(..., codigos) {
  if (missing(codigos)) {
    stop("`ind_todas_en()` requiere `codigos = ...`.", call. = FALSE)
  }
  cols <- .ind_collect_cols(list(...), fn = "ind_todas_en")
  masks <- lapply(cols, function(x) ind_en(x, codigos = codigos))
  do.call(ind_todas, masks)
}

#' @rdname ind_helpers
#' @export
ind_alguna_obs <- function(...) {
  cols <- .ind_collect_cols(list(...), fn = "ind_alguna_obs")
  masks <- lapply(cols, .ind_observado)
  do.call(ind_alguna, masks)
}

#' @rdname ind_helpers
#' @export
ind_todas_obs <- function(...) {
  cols <- .ind_collect_cols(list(...), fn = "ind_todas_obs")
  masks <- lapply(cols, .ind_observado)
  do.call(ind_todas, masks)
}

# -----------------------------------------------------------------------------
# Compatibilidad deprecada: API antigua
# -----------------------------------------------------------------------------

.ind_group_deprecated_msg <- function() {
  "`grupo()` esta deprecado. Usa `ind_*` listando variables directamente en `nivel(cuando = ~ ...)`."
}

#' Declarar un grupo explicito de variables (DEPRECADO)
#'
#' Esta funcion se mantiene por compatibilidad. La API recomendada
#' ya no requiere `grupo()`.
#'
#' @param ... Nombres de variables explicitas.
#'
#' @return Objeto de clase `"prosecnur_grupo"`.
#' @family indicador
#' @export
grupo <- function(...) {
  .Deprecated(msg = .ind_group_deprecated_msg())

  dots <- as.list(substitute(list(...)))[-1]
  if (!length(dots)) {
    stop("`grupo()` requiere al menos una variable.", call. = FALSE)
  }

  .parse <- function(expr) {
    if (is.symbol(expr)) return(as.character(expr))
    if (is.character(expr)) return(as.character(expr))
    stop("`grupo()` solo admite variables explicitas (ej: grupo(P33_1, P33_2)).", call. = FALSE)
  }

  vars <- unlist(lapply(dots, .parse), use.names = FALSE)
  vars <- trimws(as.character(vars))
  vars <- vars[!is.na(vars) & nzchar(vars)]

  if (!length(vars)) {
    stop("`grupo()` no pudo resolver variables validas.", call. = FALSE)
  }

  out <- list(vars = unique(vars))
  class(out) <- c("prosecnur_grupo", "list")
  out
}
