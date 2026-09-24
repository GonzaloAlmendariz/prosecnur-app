# El marco declarado de Muestra general y sus corridas de sorteo (ADR 0090).
#
# Estado de sesión propio, `calc_muestra_general`:
#   marcos[[componente_id]]   = {file_id, hoja, columnas, marco_hash, N,
#                                estratos, declarado_at}
#   corridas[[componente_id]] = {corrida, estratos, unidades, n_fuente,
#                                sorteado_at}
# Viaja en el `.pulso` como cualquier clave de sesión; el archivo del marco
# entra a `files/` porque `.pulso_collect_calc_muestra_fids` recolecta los
# file_id de `marcos`.
#
# Declarar el marco ESCRIBE el N y los N_h en el componente: desde ese momento
# la fórmula y el sorteo miran el mismo universo, y el N deja de ser un número
# tecleado. Redeclararlo invalida la corrida anterior de ese componente.

.cm_general_estado <- function(x) {
  x <- if (is.list(x)) x else list()
  list(marcos = x$marcos %||% list(), corridas = x$corridas %||% list())
}

.cm_general_buscar_componente <- function(estudio, componente_id) {
  ids <- vapply(estudio$componentes %||% list(), function(c) c$id %||% "", character(1))
  idx <- match(componente_id, ids)
  if (is.na(idx)) {
    stop_api(404, "E_CALC_MUESTRA_GENERAL_COMPONENTE",
             sprintf("No existe el componente «%s» en el estudio.", componente_id))
  }
  idx
}

.cm_general_columnas <- function(columnas) {
  columnas <- if (is.list(columnas)) columnas else list()
  list(
    id = calc_str(columnas$id, ""),
    estrato = calc_str(columnas$estrato, ""),
    tamano = calc_str(columnas$tamano, "")
  )
}

#' Declara el archivo de marco de un componente y escribe N y estratos.
#'
#' @param datos data.frame ya leído del archivo.
#' @return list(estudio, estado, marco) con el componente actualizado.
calc_muestra_general_declarar_marco <- function(estudio, estado, componente_id, datos,
                                                file_id, hoja = "", columnas) {
  estado <- .cm_general_estado(estado)
  idx <- .cm_general_buscar_componente(estudio, componente_id)
  columnas <- .cm_general_columnas(columnas)
  # Con tamaño declarado se valida como PPS: un tamaño inválido se dice al
  # declarar, no al sortear.
  metodo_validacion <- if (nzchar(columnas$tamano)) "pps" else "mas"
  df <- .cm_general_preparar_marco(datos, columnas, metodo_validacion)
  claves <- sort(unique(df$estrato), method = "radix")
  N_h <- vapply(claves, function(k) sum(df$estrato == k), integer(1))
  marco_hash <- .cm_general_hash_marco(df)

  comp <- estudio$componentes[[idx]]
  N <- nrow(df)
  comp$marco$universo_bruto <- N
  comp$marco$marco_validado <- N
  comp$marco$marco_contactable <- N
  comp$marco$estado <- "validado"
  comp$marco$estratos <- if (nzchar(columnas$estrato)) {
    lapply(seq_along(claves), function(h) list(id = paste0("est-", h), label = claves[[h]], N = N_h[[h]]))
  } else list()
  comp$resultado <- NULL
  estudio$componentes[[idx]] <- calc_muestra_normalize_componente(comp)

  marco <- list(
    file_id = file_id, hoja = hoja, columnas = columnas, marco_hash = marco_hash,
    N = N, estratos = lapply(seq_along(claves), function(h) list(clave = claves[[h]], N_h = N_h[[h]])),
    declarado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  estado$marcos[[componente_id]] <- marco
  estado$corridas[[componente_id]] <- NULL
  list(estudio = estudio, estado = estado, marco = marco,
       componente = estudio$componentes[[idx]])
}

#' Sortea el componente sobre su marco declarado.
#'
#' El n es el n a campo del componente (`n_operativo`, ya inflado por
#' respuesta): si no hay resultado vigente, se calcula antes.
calc_muestra_general_seleccionar <- function(estudio, estado, componente_id, datos,
                                             metodo = "mas", semilla = NULL,
                                             orden_por = NULL, reservas_por_estrato = 0L) {
  estado <- .cm_general_estado(estado)
  idx <- .cm_general_buscar_componente(estudio, componente_id)
  marco <- estado$marcos[[componente_id]]
  if (is.null(marco)) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_SIN_MARCO",
             "Declara primero el archivo de marco de este componente (Marco).")
  }
  comp <- estudio$componentes[[idx]]
  resultado <- comp$resultado %||% calc_muestra_calcular_componente(comp)
  n <- suppressWarnings(as.integer(resultado$n_operativo %||% NA))
  if (is.na(n) || n <= 0L) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_N",
             "El componente no tiene un n a campo calculado; revisa Método.")
  }
  columnas <- .cm_general_columnas(marco$columnas)
  piso <- if (nzchar(columnas$estrato)) as.integer(comp$parametros$n_minimo_estrato %||% 0L) else 0L
  sorteo <- calc_muestra_general_sortear(
    datos, columnas, metodo = metodo, n = n,
    semilla = semilla %||% .CM_GENERAL_SEMILLA_DEFAULT,
    reservas_por_estrato = reservas_por_estrato, piso = piso, orden_por = orden_por
  )
  if (!identical(sorteo$corrida$marco_hash, marco$marco_hash)) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_MARCO_CAMBIO",
             "El archivo del marco cambió desde que se declaró: vuelve a declararlo antes de sortear.")
  }
  corrida <- c(sorteo, list(n_fuente = n, componente_id = componente_id,
                            sorteado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")))
  estado$corridas[[componente_id]] <- corrida
  list(estado = estado, corrida = corrida)
}
