# =============================================================================
# Casos sin dato (NA, vacio, 98/99) en las variables de calibracion.
#
# Dos tratamientos, decididos el 2026-11-04 (ADR 0131 §6):
#   - "excluir" (por defecto): vive en .ponderacion_rake. En el paso de una
#     variable el ajuste toca solo a los casos con categoria valida y la meta se
#     escala a la parte del total que ellos representan; los demas conservan su
#     peso. Es la opcion `exclude` del paquete ipf y la recomendacion de
#     Battaglia, Hoaglin y Frankel (2009).
#   - "imputar": este archivo. Hot-deck dentro de celdas definidas por las otras
#     variables de calibracion, con donante aleatorio reproducible (semilla
#     declarada y guardada). Solo si lo que falta es poco (umbral, 5 % por
#     defecto): la imputacion simple sirve cuando faltan pocos datos. Se imputa
#     una COPIA de la variable, solo para calcular el peso; la base de analisis
#     conserva sus NA.
# =============================================================================

.PONDERACION_SEMILLA_IMPUTACION <- 20261104L
.PONDERACION_UMBRAL_IMPUTACION <- 0.05

# Sin dato = NA, vacio o un codigo de no respuesta (98/99 por defecto) que no
# tiene meta propia. Una categoria valida sin meta ("Otro") no es un faltante:
# se queda fuera del margen pero no se imputa.
.ponderacion_es_faltante <- function(v, categorias, codigos = c("98", "99")) {
  v <- as.character(v)
  limpio <- trimws(v)
  !(v %in% categorias) & (is.na(v) | !nzchar(limpio) | limpio %in% as.character(codigos))
}

# Evalua `expr` con una semilla fija sin alterar el RNG global de la sesion.
.ponderacion_con_semilla <- function(semilla, expr) {
  habia <- exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  if (habia) guardada <- get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  on.exit({
    if (habia) {
      assign(".Random.seed", guardada, envir = .GlobalEnv)
    } else if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
      rm(".Random.seed", envir = .GlobalEnv)
    }
  }, add = TRUE)
  set.seed(semilla)
  force(expr)
}

.ponderacion_pct_txt <- function(x) format(round(100 * x, 1), trim = TRUE, nsmall = 0)

# Imputa por hot-deck las variables de `margins` sobre una copia de `data`.
# Celda del receptor = sus valores validos en las OTRAS variables de calibracion
# (en el orden de los margenes). Regla de colapso declarada: si la celda no
# tiene donantes, se quita la ultima variable de la celda y se repite, hasta
# llegar a toda la muestra. Devuelve list(data, resumen, avisos).
.ponderacion_imputar <- function(data, margins, imputacion = list(), codigos = c("98", "99")) {
  imputacion <- imputacion %||% list()
  umbral <- suppressWarnings(as.numeric(imputacion$umbral %||% .PONDERACION_UMBRAL_IMPUTACION)[1])
  if (!is.finite(umbral) || umbral <= 0 || umbral > 1) umbral <- .PONDERACION_UMBRAL_IMPUTACION
  semilla <- suppressWarnings(as.integer(imputacion$semilla %||% .PONDERACION_SEMILLA_IMPUTACION)[1])
  if (is.na(semilla)) semilla <- .PONDERACION_SEMILLA_IMPUTACION

  n <- nrow(data)
  vars <- vapply(margins, function(m) .ponderacion_scalar(m$var, ""), character(1))
  cats <- lapply(margins, function(m) names(.ponderacion_normalize_targets(m$targets)))
  names(cats) <- vars
  originales <- lapply(vars, function(v) as.character(data[[v]]))
  names(originales) <- vars
  validos <- lapply(vars, function(v) !is.na(originales[[v]]) & originales[[v]] %in% cats[[v]])
  names(validos) <- vars
  faltan <- lapply(vars, function(v) .ponderacion_es_faltante(originales[[v]], cats[[v]], codigos))
  names(faltan) <- vars

  # El umbral se revisa antes de imputar nada: una variable fuera de umbral
  # rechaza toda la imputacion, con la causa y la salida.
  pct <- vapply(vars, function(v) sum(faltan[[v]]) / n, numeric(1))
  exceden <- vars[pct > umbral + 1e-12]
  if (length(exceden)) {
    detalle <- paste(sprintf("faltan %s %% en «%s»", .ponderacion_pct_txt(pct[exceden]), exceden),
                     collapse = "; ")
    stop_api(422, "E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL",
             sprintf("No se puede imputar: %s, más que el %s %% permitido. Usa «dejar fuera del margen» o saca la variable de la calibración.",
                     detalle, .ponderacion_pct_txt(umbral)),
             details = list(umbral = umbral, porcentajes = as.list(pct[exceden])))
  }

  data_cal <- data
  variables <- list()
  valores <- list()
  marca <- list()
  avisos <- list()
  .ponderacion_con_semilla(semilla, {
    for (v in vars) {
      receptores <- which(faltan[[v]])
      if (!length(receptores)) next
      otros <- setdiff(vars, v)
      imputado <- originales[[v]]
      colapsados <- 0L
      celdas_vacias <- character()
      for (i in receptores) {
        clave <- otros[vapply(otros, function(o) isTRUE(validos[[o]][i]), logical(1))]
        clave_inicial <- clave
        repeat {
          donantes <- validos[[v]]
          for (o in clave) donantes <- donantes & validos[[o]] & originales[[o]] == originales[[o]][i]
          donantes <- which(donantes)
          if (length(donantes) || !length(clave)) break
          clave <- clave[-length(clave)]
        }
        if (!identical(clave, clave_inicial)) {
          colapsados <- colapsados + 1L
          celdas_vacias <- c(celdas_vacias, paste(sprintf("%s = %s", clave_inicial,
            vapply(clave_inicial, function(o) originales[[o]][i], character(1))), collapse = ", "))
        }
        if (length(donantes)) imputado[i] <- originales[[v]][donantes[sample.int(length(donantes), 1L)]]
      }
      data_cal[[v]] <- imputado
      marca[[v]] <- faltan[[v]]
      valores[[v]] <- imputado[receptores]
      variables[[v]] <- list(
        imputados = length(receptores),
        pct = pct[[v]],
        colapsados = colapsados,
        celda = otros
      )
      avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
        "info", "imputacion_aplicada",
        sprintf("Se imputaron %d casos sin dato en «%s» (%s %%) por hot-deck dentro de celdas de %s, con semilla %d, sólo para calcular el peso: la variable de la base no cambia.",
                length(receptores), v, .ponderacion_pct_txt(pct[[v]]),
                if (length(otros)) paste(sprintf("«%s»", otros), collapse = " × ") else "toda la muestra",
                semilla),
        var = v, casos = length(receptores)
      )
      if (colapsados > 0L) {
        celdas <- sort(unique(celdas_vacias))
        avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
          "warn", "celda_sin_donantes",
          sprintf("%d casos sin dato en «%s» no tenían donantes en su celda (%s): se tomó el donante quitando variables de la celda desde la última hasta encontrar casos con dato.",
                  colapsados, v, paste(celdas, collapse = "; ")),
          var = v, casos = colapsados, celdas = celdas
        )
      }
    }
  })

  list(
    data = data_cal,
    resumen = list(
      semilla = semilla,
      umbral = umbral,
      metodo = "hot-deck en celdas de las otras variables de calibración",
      variables = variables,
      valores = valores,
      marca = marca
    ),
    avisos = avisos
  )
}
