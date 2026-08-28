# =============================================================================
# Saneo POR COLUMNA de la matriz de balance del cubo
# =============================================================================
#
# Hallazgo J1 (checklist ae8e7845): el sorteo corre POR ESTRATO (facultad ×
# sexo × tamaño) y tres de las cinco balance_vars del diseño son CONSTANTES
# dentro de cada estrato. `model.matrix` falla ENTERO ante un factor de un
# solo nivel («contrasts can be applied only to factors with 2 or more
# levels») y el tryCatch del builder degradaba TODO a intercepto+pik: program
# y level — que sí varían y son lo único balanceable dentro del estrato — se
# perdían junto con las constantes, sin aviso. El «cubo balanceado» del
# diseño vigente quedaba como sorteo pi-only por estrato.
#
# La política aquí: una variable sin variación NO aporta balance (es colineal
# con el intercepto) — se DESCARTA y SE DECLARA en el atributo
# `balance_vars_descartadas` de la matriz, nunca se traga. Las que varían
# sobreviven siempre. El tryCatch queda como red de seguridad para fallas
# que este saneo no anticipa, y si llega a saltar también declara.
#
# Vive en archivo propio porque calc_muestra_aulas.R está congelado a
# crecimiento: el builder de allá delega aquí (y encoge).

# Cota de columnas que llegan al aterrizaje del cubo.
#
# El costo de `landingcube` crece como 2^columnas. Medido sobre 60 aulas con
# cuota 20: 4 columnas 0,1 s · 12 columnas 0,2 s · 16 columnas 1,4 s ·
# 20 columnas 29,2 s · 24 columnas NO TERMINO en 930 s. No lanza error, se
# cuelga, y `withTimeout` no lo interrumpe porque el trabajo ocurre en codigo
# compilado que no atiende interrupciones: la unica guarda posible es previa.
#
# 16 deja el sorteo instantaneo y la certeza —que hace ~200 sorteos por
# candidato— usable. Subirlo a 20 costaria ~100 minutos por candidato.
.CM_AULAS_MAX_BALANCE_COLS <- 16L

#' Las dos razones por las que una variable no llega al balance, en un solo sitio.
#'
#' La matriz y el aviso se calculan por separado —el attr de la matriz muere
#' dentro del sampler— y dos lecturas de la misma regla divergen: cuando la cota
#' por cardinalidad entro, el aviso siguio reportando solo las constantes y
#' callaba el descarte que de verdad cambia el diseno. Esta funcion es la unica
#' lectura; las dos la consumen.
#' @keywords internal
.cm_aulas_balance_descartes <- function(df, vars) {
  vars <- intersect(.cm_aulas_chr_vec(vars), names(df))
  vacio <- list(sin_variacion = character(0), por_cardinalidad = character(0),
                vivas = character(0), niveles = integer(0))
  if (!length(vars)) return(vacio)
  niveles <- vapply(vars, function(nm) {
    valores <- df[[nm]]
    if (is.numeric(valores)) return(length(unique(valores[is.finite(valores)])))
    valores <- .cm_aulas_values(df, nm, "sin_dato")
    valores[!nzchar(valores)] <- "sin_dato"
    length(unique(valores))
  }, integer(1))
  sin_variacion <- vars[niveles < 2L]
  vivas <- setdiff(vars, sin_variacion)
  # Una numerica aporta UNA columna sea cual sea su rango; una categorica aporta
  # tantas como niveles menos uno.
  costo <- function(nm) if (is.numeric(df[[nm]])) 1L else max(1L, niveles[[nm]] - 1L)
  por_cardinalidad <- character(0)
  while (length(vivas) && sum(vapply(vivas, costo, integer(1))) > .CM_AULAS_MAX_BALANCE_COLS) {
    caras <- vapply(vivas, costo, integer(1))
    peor <- vivas[[which.max(caras)]]
    por_cardinalidad <- c(por_cardinalidad, peor)
    vivas <- setdiff(vivas, peor)
  }
  list(sin_variacion = sin_variacion, por_cardinalidad = por_cardinalidad,
       vivas = vivas, niveles = niveles)
}

#' Matriz de balance saneada por columna, con las descartadas declaradas.
#' @keywords internal
.cm_aulas_balance_matrix_saneada <- function(df, vars, pik = NULL) {
  vars <- intersect(.cm_aulas_chr_vec(vars), names(df))
  descartadas <- character(0)
  data <- NULL
  if (length(vars)) {
    data <- df[, vars, drop = FALSE]
    for (nm in vars) {
      if (is.numeric(data[[nm]])) {
        columna <- data[[nm]]
        columna[!is.finite(columna)] <- 0
        data[[nm]] <- columna
      } else {
        values <- .cm_aulas_values(data, nm, "sin_dato")
        values[!nzchar(values)] <- "sin_dato"
        data[[nm]] <- factor(values)
      }
      if (length(unique(data[[nm]])) < 2L) {
        descartadas <- c(descartadas, nm)
        data[[nm]] <- NULL
      }
    }
    # Una variable que aporta mas columnas de las que el aterrizaje puede
    # recorrer no balancea nada: cae en la misma categoria que una constante y
    # se trata igual. La decision la toma `.cm_aulas_balance_descartes`, que es
    # tambien la que lee el aviso, para que no haya dos lecturas de la regla.
    for (nm in .cm_aulas_balance_descartes(df, names(data))$por_cardinalidad) {
      descartadas <- c(descartadas, nm)
      data[[nm]] <- NULL
    }
  }
  intercepto <- function() {
    matrix(1, nrow = nrow(df), ncol = 1, dimnames = list(NULL, "intercept"))
  }
  out <- if (is.null(data) || !ncol(data)) {
    intercepto()
  } else {
    mm <- tryCatch(stats::model.matrix(~ . - 1, data = data), error = function(e) NULL)
    if (is.null(mm) || !nrow(mm)) {
      # Red de seguridad para lo no anticipado: degrada, pero DICIENDO qué cayó.
      descartadas <- union(descartadas, names(data))
      intercepto()
    } else {
      cbind(intercept = 1, mm)
    }
  }
  # D2 (Deville-Tille): pik como PRIMERA columna fija el tamano de muestra del
  # cube (sum sobre la muestra de pik_k/pik_k = n); sin ella samplecube/lcube
  # pueden entregar n != cuota y el ajuste posterior altera la muestra.
  if (!is.null(pik)) out <- cbind(pik = as.numeric(pik), out)
  attr(out, "balance_vars_descartadas") <- unique(descartadas)
  out
}

#' Warning declarable cuando el balance del cubo perdió variables en el estrato.
#'
#' Se recalcula barato (conteo de valores únicos, sin model.matrix) porque el
#' attr de la matriz muere dentro del sampler. El mensaje NO nombra el estrato
#' a propósito: con ~80 estratos que descartan el mismo set (las vars que los
#' definen), mensajes idénticos colapsan en el unique() del caller y viaja UNO.
#' @keywords internal
.cm_aulas_balance_descartadas_warning <- function(df, selector, engine_used) {
  if (!engine_used %in% c("cube_balanceado", "local_pivotal_balanceado")) {
    return(character(0))
  }
  vars <- unique(c(
    .cm_aulas_chr_vec(selector$spread_vars), .cm_aulas_chr_vec(selector$balance_vars)
  ))
  d <- .cm_aulas_balance_descartes(df, vars)
  if (!length(d$sin_variacion) && !length(d$por_cardinalidad)) return(character(0))
  partes <- character(0)
  if (length(d$sin_variacion)) {
    partes <- c(partes, sprintf(
      "%s sin variacion dentro del estrato (definen la estratificacion o son constantes)",
      paste(d$sin_variacion, collapse = ", ")))
  }
  # El descarte por cardinalidad cambia el diseno que el usuario declaro, asi
  # que el aviso dice la CAUSA con su cifra: cuantos niveles trae la variable y
  # contra que cota se midio. Un aviso que solo diga el hecho obliga a
  # adivinar por que.
  if (length(d$por_cardinalidad)) {
    detalle <- vapply(d$por_cardinalidad, function(nm) sprintf(
      "%s (%s niveles)", nm, format(d$niveles[[nm]], big.mark = " ")), character(1))
    partes <- c(partes, sprintf(
      "%s con demasiados niveles para el aterrizaje del cubo, que admite %d columnas",
      paste(detalle, collapse = ", "), .CM_AULAS_MAX_BALANCE_COLS))
  }
  sprintf(
    "Balance del sorteo: %s; se balancea con %s.",
    paste(partes, collapse = "; y "),
    if (length(d$vivas)) paste(d$vivas, collapse = ", ") else "solo las probabilidades de inclusion"
  )
}
