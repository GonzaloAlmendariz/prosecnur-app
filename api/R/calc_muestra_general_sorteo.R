# Sorteo de Muestra general (ADR 0090): del marco declarado a un listado con
# π y peso base por unidad, reproducible en cualquier máquina.
#
# Es el motor puro: recibe el marco ya leído y las columnas declaradas, y no
# sabe de sesiones ni de rutas. Las reglas que lo gobiernan (research R6, R7,
# R10, R11, R12):
#
#   - El marco se ordena por `id` con orden de bytes (`method = "radix"`), que
#     no depende del locale: el mismo archivo barajado da la misma muestra.
#   - El RNG se aísla: se fija `RNGkind` dentro del bloque y se restaura el
#     `.Random.seed` global al salir, para no mover ningún otro sorteo.
#   - La semilla de cada estrato sale de un hash de (semilla, clave del
#     estrato), no de su posición: agregar o reordenar estratos no cambia la
#     muestra de los demás.
#   - La π publicada es la del sorteo ejecutado: n_h/N_h en MAS y sistemático,
#     la de `.cm_aulas_inclusion_probabilities` (con certezas) en PPS.
#   - Las reservas son réplicas: una permutación aleatoria de los no
#     seleccionados del mismo estrato, que se libera en orden. En PPS no se
#     ofrecen en esta versión porque su π al liberarlas no sería exacta.

.CM_GENERAL_METODOS <- c("mas", "sistematico", "pps")
.CM_GENERAL_SEMILLA_DEFAULT <- 20260924L
.CM_GENERAL_RNG_KIND <- c("Mersenne-Twister", "Inversion", "Rejection")
.CM_GENERAL_SIN_ESTRATO <- "(total)"

# Ejecuta `expr` con un RNG propio y deja el global como estaba.
.cm_general_con_semilla <- function(semilla, expr) {
  kind_previo <- RNGkind()
  tenia_seed <- exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  seed_previa <- if (tenia_seed) get(".Random.seed", envir = .GlobalEnv, inherits = FALSE) else NULL
  on.exit({
    suppressWarnings(RNGkind(kind_previo[[1]], kind_previo[[2]], kind_previo[[3]]))
    if (tenia_seed) {
      assign(".Random.seed", seed_previa, envir = .GlobalEnv)
    } else if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
      rm(".Random.seed", envir = .GlobalEnv)
    }
  }, add = TRUE)
  suppressWarnings(RNGkind(.CM_GENERAL_RNG_KIND[[1]], .CM_GENERAL_RNG_KIND[[2]],
                           .CM_GENERAL_RNG_KIND[[3]]))
  set.seed(semilla)
  force(expr)
}

# Semilla entera de un estrato, derivada de su clave.
.cm_general_semilla_estrato <- function(semilla, clave) {
  h <- digest::digest(paste0(semilla, "|", clave), algo = "sha256", serialize = FALSE)
  strtoi(substr(h, 1L, 7L), base = 16L)
}

.cm_general_error_marco <- function(mensaje, detalle = NULL) {
  stop_api(400, "E_CALC_MUESTRA_GENERAL_MARCO", mensaje, details = detalle)
}

# Normaliza el marco a id / estrato / tamano / orden y lo valida. Devuelve
# el data.frame ordenado por id.
.cm_general_preparar_marco <- function(marco, columnas, metodo, orden_por = NULL) {
  if (!is.data.frame(marco) || !nrow(marco)) {
    .cm_general_error_marco("El marco está vacío: no hay unidades que sortear.")
  }
  col_id <- columnas$id %||% ""
  if (!nzchar(col_id) || !col_id %in% names(marco)) {
    .cm_general_error_marco(sprintf("Falta la columna de id declarada («%s») en el marco.", col_id))
  }
  ids <- trimws(as.character(marco[[col_id]]))
  vacios <- is.na(ids) | !nzchar(ids)
  if (any(vacios)) {
    .cm_general_error_marco(sprintf("%d filas del marco no tienen id.", sum(vacios)),
                            list(filas_sin_id = which(vacios)[seq_len(min(20L, sum(vacios)))]))
  }
  duplicados <- unique(ids[duplicated(ids)])
  if (length(duplicados)) {
    .cm_general_error_marco(sprintf("%d ids se repiten en el marco; cada unidad debe aparecer una vez.",
                                    length(duplicados)),
                            list(ids_duplicados = utils::head(duplicados, 20L)))
  }
  col_estrato <- columnas$estrato %||% ""
  estrato <- if (nzchar(col_estrato)) {
    if (!col_estrato %in% names(marco)) {
      .cm_general_error_marco(sprintf("Falta la columna de estrato declarada («%s»).", col_estrato))
    }
    e <- trimws(as.character(marco[[col_estrato]]))
    e[is.na(e) | !nzchar(e)] <- "(sin estrato)"
    e
  } else rep(.CM_GENERAL_SIN_ESTRATO, length(ids))
  tamano <- rep(1, length(ids))
  if (identical(metodo, "pps")) {
    col_tamano <- columnas$tamano %||% ""
    if (!nzchar(col_tamano) || !col_tamano %in% names(marco)) {
      .cm_general_error_marco("El sorteo PPS necesita una columna de tamaño declarada.")
    }
    tamano <- suppressWarnings(as.numeric(marco[[col_tamano]]))
    malos <- !is.finite(tamano) | tamano <= 0
    if (any(malos)) {
      .cm_general_error_marco(sprintf("%d unidades tienen tamaño vacío, no numérico o ≤ 0.", sum(malos)),
                              list(ids = utils::head(ids[malos], 20L)))
    }
  }
  orden <- if (!is.null(orden_por) && nzchar(orden_por)) {
    if (!orden_por %in% names(marco)) {
      .cm_general_error_marco(sprintf("Falta la columna de orden declarada («%s»).", orden_por))
    }
    as.character(marco[[orden_por]])
  } else ids
  df <- data.frame(id = ids, estrato = estrato, tamano = tamano, orden = orden,
                   stringsAsFactors = FALSE)
  df[order(df$id, method = "radix"), , drop = FALSE]
}

# Sorteo dentro de un estrato. `filas` ya viene ordenado por id.
.cm_general_sortear_estrato <- function(filas, n_h, metodo, reservas) {
  N_h <- nrow(filas)
  n_h <- as.integer(min(max(0L, n_h), N_h))
  if (metodo == "sistematico") {
    # Orden declarado (o id), con desempate por id.
    filas <- filas[order(filas$orden, filas$id, method = "radix"), , drop = FALSE]
  }
  pik <- rep(if (N_h) n_h / N_h else 0, N_h)
  seleccion <- integer()
  arranque <- NA_real_
  if (n_h > 0L) {
    if (metodo == "mas") {
      perm <- sample.int(N_h)
      seleccion <- perm[seq_len(n_h)]
    } else if (metodo == "sistematico") {
      k <- N_h / n_h
      arranque <- stats::runif(1) * k
      seleccion <- as.integer(ceiling(arranque + (seq_len(n_h) - 1) * k))
      seleccion[seleccion < 1L] <- 1L
    } else {
      pik <- .cm_aulas_inclusion_probabilities(filas$tamano, n_h)
      acum <- round(c(0, cumsum(pik)), 10)
      arranque <- stats::runif(1)
      cruza <- floor(acum[-1] - arranque) != floor(acum[-length(acum)] - arranque)
      seleccion <- which(cruza | pik >= 1)
    }
  }
  resto <- setdiff(seq_len(N_h), seleccion)
  n_res <- if (metodo == "pps") 0L else as.integer(min(max(0L, reservas), length(resto)))
  reservas_idx <- if (n_res > 0L) resto[sample.int(length(resto), n_res)] else integer()
  list(filas = filas, pik = pik, seleccion = seleccion, reservas = reservas_idx,
       arranque = arranque, n_h = length(seleccion))
}

#' Sortea unidades de un marco declarado (ADR 0090).
#'
#' @param marco data.frame con el marco tal como se leyó del archivo.
#' @param columnas list(id =, estrato = opcional, tamano = opcional).
#' @param metodo "mas" | "sistematico" | "pps".
#' @param n tamaño total de titulares (en general, el n_operativo del
#'   componente). Se reparte entre estratos con `.cm_general_reparto`.
#' @param semilla entero; misma semilla y mismo marco dan el mismo listado.
#' @param reservas_por_estrato réplicas por estrato (no en PPS).
#' @param piso mínimo por estrato para el reparto.
#' @param orden_por columna que ordena el marco para el sistemático.
#' @return list(corrida, estratos, unidades).
calc_muestra_general_sortear <- function(marco, columnas, metodo = "mas", n,
                                         semilla = .CM_GENERAL_SEMILLA_DEFAULT,
                                         reservas_por_estrato = 0L, piso = 0L,
                                         orden_por = NULL) {
  metodo <- calc_enum(metodo, .CM_GENERAL_METODOS, "mas")
  semilla <- calc_int(semilla, .CM_GENERAL_SEMILLA_DEFAULT, min = 1L, max = .Machine$integer.max)
  n <- calc_int(n, 0L, min = 0L)
  if (n <= 0L) {
    stop_api(400, "E_CALC_MUESTRA_GENERAL_N", "El tamaño a sortear debe ser mayor que cero.")
  }
  df <- .cm_general_preparar_marco(marco, columnas, metodo, orden_por)
  claves <- sort(unique(df$estrato), method = "radix")
  N_h <- vapply(claves, function(k) sum(df$estrato == k), integer(1))
  n_h <- .cm_general_reparto(min(n, nrow(df)), N_h, piso)

  marco_hash <- .cm_aulas_hash(list(df$id, df$estrato, df$tamano, df$orden))
  config <- list(metodo = metodo, n = n, piso = as.integer(piso),
                 reservas_por_estrato = as.integer(reservas_por_estrato),
                 orden_por = orden_por %||% "", columnas = columnas[c("id", "estrato", "tamano")])
  config_hash <- .cm_aulas_hash(config)

  por_estrato <- lapply(seq_along(claves), function(h) {
    filas <- df[df$estrato == claves[[h]], , drop = FALSE]
    .cm_general_con_semilla(
      .cm_general_semilla_estrato(semilla, claves[[h]]),
      .cm_general_sortear_estrato(filas, n_h[[h]], metodo, reservas_por_estrato)
    )
  })

  unidades <- do.call(rbind, lapply(seq_along(claves), function(h) {
    s <- por_estrato[[h]]
    f <- s$filas
    tit <- data.frame(
      id = f$id[s$seleccion], estrato = claves[[h]], N_h = N_h[[h]], n_h = s$n_h,
      pi = s$pik[s$seleccion], orden = seq_along(s$seleccion),
      estado = rep("titular", length(s$seleccion)), lote_reserva = NA_integer_,
      stringsAsFactors = FALSE
    )
    res <- data.frame(
      id = f$id[s$reservas], estrato = rep(claves[[h]], length(s$reservas)),
      N_h = rep(N_h[[h]], length(s$reservas)), n_h = rep(s$n_h, length(s$reservas)),
      pi = rep(NA_real_, length(s$reservas)), orden = seq_along(s$reservas),
      estado = rep("reserva", length(s$reservas)), lote_reserva = seq_along(s$reservas),
      stringsAsFactors = FALSE
    )
    rbind(tit, res)
  }))
  unidades$peso_base <- ifelse(is.na(unidades$pi) | unidades$pi <= 0, NA_real_, 1 / unidades$pi)
  rownames(unidades) <- NULL

  estratos <- data.frame(
    clave = claves, N_h = as.integer(N_h),
    n_h = vapply(por_estrato, `[[`, integer(1), "n_h"),
    n_reservas = vapply(por_estrato, function(s) length(s$reservas), integer(1)),
    arranque = vapply(por_estrato, `[[`, numeric(1), "arranque"),
    stringsAsFactors = FALSE
  )
  estratos$pi <- ifelse(metodo == "pps", NA_real_, estratos$n_h / estratos$N_h)

  corrida <- list(
    run_id = substr(.cm_aulas_hash(list(marco_hash, config_hash, semilla)), 1L, 12L),
    semilla = semilla,
    rng_kind = paste(.CM_GENERAL_RNG_KIND, collapse = "/"),
    r_version = R.version.string,
    metodo = metodo,
    marco_hash = marco_hash,
    config_hash = config_hash,
    N = nrow(df),
    n_titulares = sum(unidades$estado == "titular"),
    n_reservas = sum(unidades$estado == "reserva"),
    piso_incumplible = isTRUE(attr(n_h, "piso_incumplible")),
    reservas_omitidas_pps = identical(metodo, "pps") && reservas_por_estrato > 0L
  )
  list(corrida = corrida, estratos = estratos, unidades = unidades)
}
