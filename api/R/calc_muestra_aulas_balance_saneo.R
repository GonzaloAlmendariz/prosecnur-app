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
