# =============================================================================
# Recorrido del sorteo sistemático PPS — el orden REAL de la selección
# =============================================================================
#
# POR QUÉ EXISTE
#
# El Relato de la selección (ADR 0067) quiere contar el sorteo como una cadena:
# el marco en gris, y cada curso-horario que sale se pone negro y se ata al
# siguiente. Esa cadena presupone un ORDEN DE SELECCIÓN, y ese orden no estaba
# publicado por ninguna parte. Las dos columnas que lo aparentan no lo son:
# `orden` y `operational_sequence` salen de `selection_slot_id`
# (calc_muestra_aulas_codigos.R) y son el orden de ENTREGA al campo — el número
# con el que el encuestador recibe el aula. Encadenar por ahí dibujaría una
# caminata que nunca ocurrió, que es exactamente lo que la regla 1 del ADR
# prohíbe. De ahí la regla I20: el orden lo publica R o no existe.
#
# QUÉ ES EL RECORRIDO
#
# En un sistemático PPS los cursos-horario se acuestan en una recta donde cada
# uno ocupa un segmento del largo de su probabilidad de inclusión (π): el PPS
# hecho geometría. Cae un arranque al azar en (0,1) y de ahí se avanza con paso
# FIJO de 1, marcando la recta. Cada marca cae dentro de un segmento y ese
# curso-horario entra a la muestra. No hay nada más: el método entero es una
# regla y un punto de partida.
#
# Los que ocupan un segmento de largo >= 1 (π = 1) son CERTEZAS: la marca no
# puede saltarlos, entran sin sorteo. Es el mismo concepto que el Relato ya
# rotula «certeza · sin sorteo», ahora con su razón geométrica a la vista.
#
# POR QUÉ SE REIMPLEMENTA LA CAMINATA EN VEZ DE LEER `sampling::UPsystematic`
#
# Porque UPsystematic devuelve solo el indicador de inclusión: consume el
# arranque y lo tira. Sin arranque no hay recta que animar. Acá se ejecuta la
# MISMA caminata —mismo consumo de RNG, un único `runif(1, 0, 1)`, misma regla
# de cruce por parte fraccionaria— así que la selección es idéntica bit a bit y
# el recorrido queda publicado. La equivalencia no se afirma: la fija un test
# contra el paquete sobre cientos de vectores π aleatorios.
#
# Además deja de depender de `sampling` para este método, que era el fallback
# de todos los demás: sin el paquete, la selección caía a un `sample()` con
# pesos, que NO es un sistemático (misma esperanza, otra varianza y sin recta
# que auditar).

CALC_MUESTRA_AULAS_RECORRIDO_SCHEMA <- "calc_muestra_aulas_recorrido_sistematico_v1"

# Tolerancia con la que se decide qué es certeza y qué es imposible. Es la
# misma de `sampling::UPsystematic`: cambiarla cambiaría qué unidades entran
# sin sorteo, así que se conserva idéntica.
.CM_RECORRIDO_EPS <- 1e-6

#' Caminata sistemática PPS, con su recorrido publicado.
#'
#' @param pik Probabilidades de inclusión, en el ORDEN de la recta (que es el
#'   orden de filas del candidato: el sistemático no reordena).
#' @param ids Identificadores alineados con `pik`; se publican en el recorrido
#'   para que el consumidor no dependa de posiciones.
#' @return `list(indices, recorrido)`. `indices` es lo que consume el sorteo;
#'   `recorrido` es el hecho publicable.
.cm_aulas_recorrido_sistematico <- function(pik, ids = NULL, eps = .CM_RECORRIDO_EPS) {
  pik <- as.numeric(pik)
  n <- length(pik)
  if (!n) {
    return(list(indices = integer(0), recorrido = .cm_aulas_recorrido_vacio()))
  }
  if (is.null(ids)) ids <- as.character(seq_len(n))
  ids <- as.character(ids)

  certezas <- which(pik >= 1 - eps)
  nulas <- which(pik <= eps)
  # La caminata solo recorre lo que no está decidido de antemano.
  en_recta <- setdiff(seq_len(n), union(certezas, nulas))

  if (!length(en_recta)) {
    return(list(
      indices = sort(certezas),
      recorrido = .cm_aulas_recorrido_vacio(
        certezas = ids[certezas],
        motivo = if (length(certezas)) "todas_certeza" else "sin_unidades"
      )
    ))
  }

  pik_recta <- pik[en_recta]
  acumulado <- cumsum(pik_recta)
  # Único consumo de RNG, igual que UPsystematic: si acá se agregara otra
  # llamada, la selección dejaría de coincidir con el histórico.
  arranque <- stats::runif(1, 0, 1)
  fraccion <- (c(0, acumulado) - arranque) %% 1
  # Cruce de entero: la marca cayó dentro de este segmento.
  elegidas_recta <- which(fraccion[seq_len(length(en_recta))] >
                            fraccion[seq_len(length(en_recta)) + 1L])

  inicio <- c(0, utils::head(acumulado, -1))
  unidades <- data.frame(
    classroom_id = ids[en_recta],
    pik = pik_recta,
    inicio = inicio,
    fin = acumulado,
    seleccionada = seq_along(en_recta) %in% elegidas_recta,
    # La k-ésima marca cae en la k-ésima seleccionada, y las marcas están en
    # `arranque + (k-1)`: el paso es 1 por construcción del método.
    marca = NA_integer_,
    marca_posicion = NA_real_,
    stringsAsFactors = FALSE
  )
  if (length(elegidas_recta)) {
    unidades$marca[elegidas_recta] <- seq_along(elegidas_recta)
    unidades$marca_posicion[elegidas_recta] <- arranque + seq_along(elegidas_recta) - 1
  }

  list(
    indices = sort(c(certezas, en_recta[elegidas_recta])),
    recorrido = list(
      schema = CALC_MUESTRA_AULAS_RECORRIDO_SCHEMA,
      aplicable = TRUE,
      motivo = "",
      arranque = arranque,
      paso = 1,
      largo_recta = as.numeric(acumulado[[length(acumulado)]]),
      n_marcas = length(elegidas_recta),
      certezas = ids[certezas],
      unidades = unidades
    )
  )
}

.cm_aulas_recorrido_vacio <- function(certezas = character(0), motivo = "sin_unidades") {
  list(
    schema = CALC_MUESTRA_AULAS_RECORRIDO_SCHEMA,
    aplicable = FALSE,
    motivo = motivo,
    arranque = NA_real_,
    paso = 1,
    largo_recta = 0,
    n_marcas = 0L,
    certezas = as.character(certezas),
    unidades = data.frame(
      classroom_id = character(0), pik = numeric(0),
      inicio = numeric(0), fin = numeric(0), seleccionada = logical(0),
      marca = integer(0), marca_posicion = numeric(0),
      stringsAsFactors = FALSE
    )
  )
}

# El sorteo corre por estrato, así que el recorrido también: una recta por
# estrato, con su propio arranque. Publicarlos aplanados perdería justo lo que
# hace legible la escena —qué caminata produjo qué cuota— y además mezclaría
# rectas de largos distintos.
.cm_aulas_recorrido_por_estrato <- function(acumulador, motivo = "") {
  # Un estrato entra si tuvo caminata O si entregó unidades sin sorteo (todas
  # certeza, o cuota que cubre el estrato). Filtrar solo por `aplicable` dejaba
  # fuera a los segundos, y la escena describía menos titulares de los que la
  # corrida entregó sin poder notarlo: 189 de 196 en el estudio real.
  con_contenido <- function(x) {
    is.list(x) && is.list(x$recorrido) &&
      (isTRUE(x$recorrido$aplicable) || length(x$recorrido$certezas) > 0L)
  }
  estratos <- Filter(con_contenido, acumulador)
  camina <- vapply(estratos, function(x) isTRUE(x$recorrido$aplicable), logical(1))
  list(
    schema = CALC_MUESTRA_AULAS_RECORRIDO_SCHEMA,
    aplicable = any(camina),
    # Por qué no hay caminata. Un `aplicable = FALSE` mudo obliga al consumidor
    # a adivinar si el método no la tiene o si el emisor falló.
    motivo = if (length(estratos)) "" else motivo,
    estratos = unname(lapply(estratos, function(x) {
      c(list(estrato = x$estrato), x$recorrido)
    }))
  )
}

# Por qué un engine no produce recorrido. Se nombra para que la escena pueda
# decirlo en vez de mostrar un hueco sin causa.
#
# `descuento_secuencial` no es una limitación: es que con el descuento activo el
# sistemático DEJA de ser una caminata. Pasa a sortear de a uno recalculando la
# MOS con los elegibles netos de cada paso (PPS sucesivo,
# calc_muestra_aulas_descuento.R), y ese camino ya publica el orden real en
# `discount_step` — que es un orden MEJOR para narrar, porque además trae el
# encogimiento de cada bola.
.cm_aulas_recorrido_motivo <- function(engine, descuento_secuencial) {
  if (isTRUE(descuento_secuencial)) return("descuento_secuencial")
  if (!identical(.cm_aulas_engine_key(engine), "sistematico_pps")) return("engine_sin_recorrido")
  "sin_unidades"
}
