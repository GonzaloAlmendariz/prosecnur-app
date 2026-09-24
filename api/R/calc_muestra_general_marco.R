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
  # Los N_h salen del marco; lo que el usuario ya dijo de cada estrato (su p
  # esperada, su margen) se conserva por rótulo: redeclarar el archivo no debe
  # borrar la proporción por estrato que alimenta el n y la asignación.
  previos <- comp$marco$estratos %||% list()
  previo_de <- function(clave) {
    for (e in previos) if (is.list(e) && identical(as.character(e$label %||% ""), clave)) return(e)
    NULL
  }
  comp$marco$estratos <- if (nzchar(columnas$estrato)) {
    nuevos <- lapply(seq_along(claves), function(h) {
      e <- previo_de(claves[[h]]) %||% list()
      e$label <- claves[[h]]
      e$N <- N_h[[h]]
      e$N_a <- NULL; e$N_b <- NULL
      e
    })
    # Ids únicos: un estrato previo puede traer un id («est-1») que la
    # numeración nueva le daría a otro; la tabla usa el id como llave.
    usados <- character(0)
    for (h in seq_along(nuevos)) {
      id <- as.character(nuevos[[h]]$id %||% "")
      if (!nzchar(id) || id %in% usados) {
        i <- h
        repeat { id <- paste0("est-", i); if (!id %in% usados && !id %in% vapply(nuevos, function(x) as.character(x$id %||% ""), "")[-h]) break; i <- i + length(nuevos) }
      }
      nuevos[[h]]$id <- id
      usados <- c(usados, id)
    }
    nuevos
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
  # Qué significa «sortear» depende de la técnica (E5, acreditación):
  #   - diseños de elementos: sorteo probabilístico sobre el n a campo;
  #   - cobertura censal y barrido: la intención es abordar a TODOS, así que
  #     el listado es el marco entero en orden aleatorio de contacto (π = 1);
  #   - cuotas, conveniencia y el resto: no hay probabilidad de inclusión que
  #     publicar, y sortear con π inventaría una.
  modalidad <- if (comp$tecnica %in% .CM_TECNICAS_DE_ELEMENTOS) "probabilistica"
               else if (comp$tecnica %in% c("intencion_censal", "barrido")) "censo"
               else NA_character_
  if (is.na(modalidad)) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_TECNICA",
             sprintf("La técnica «%s» no selecciona unidades con probabilidad conocida: no hay sorteo ni π que publicar.",
                     comp$tecnica))
  }
  if (identical(modalidad, "censo")) {
    n <- as.integer(marco$N)
    metodo <- "mas"
  } else {
    resultado <- comp$resultado %||% calc_muestra_calcular_componente(comp)
    n <- suppressWarnings(as.integer(resultado$n_operativo %||% NA))
  }
  if (is.na(n) || n <= 0L) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_N",
             "El componente no tiene un n a campo calculado; revisa Método.")
  }
  columnas <- .cm_general_columnas(marco$columnas)
  piso <- if (nzchar(columnas$estrato)) as.integer(comp$parametros$n_minimo_estrato %||% 0L) else 0L
  # Con estratos, se sortea el n a campo por estrato que publicó el cálculo
  # (`n_campo`), no un reparto recalculado aquí.
  asignacion <- NULL
  if (identical(modalidad, "probabilistica") && nzchar(columnas$estrato)) {
    dist <- resultado$distribucion_estratos %||% list()
    if (length(dist)) {
      campo <- vapply(dist, function(d) as.integer(d$n_campo %||% NA_integer_), integer(1))
      if (!anyNA(campo)) asignacion <- setNames(campo, vapply(dist, function(d) as.character(d$estrato), ""))
    }
  }
  sorteo <- calc_muestra_general_sortear(
    datos, columnas, metodo = metodo, n = n,
    semilla = semilla %||% .CM_GENERAL_SEMILLA_DEFAULT,
    reservas_por_estrato = reservas_por_estrato, piso = piso, orden_por = orden_por,
    asignacion = asignacion
  )
  if (!identical(sorteo$corrida$marco_hash, marco$marco_hash)) {
    stop_api(409, "E_CALC_MUESTRA_GENERAL_MARCO_CAMBIO",
             "El archivo del marco cambió desde que se declaró: vuelve a declararlo antes de sortear.")
  }
  sorteo$corrida$modalidad <- modalidad
  corrida <- c(sorteo, list(n_fuente = n, componente_id = componente_id,
                            sorteado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")))
  estado$corridas[[componente_id]] <- corrida
  list(estado = estado, corrida = corrida)
}

#' Resumen del estado de Muestra general para /api/calc-muestra/state: los
#' marcos declarados y cada corrida SIN su listado de unidades (el listado va
#' por GET /general/corrida con serialización sin redondeo).
calc_muestra_general_resumen <- function(estado) {
  estado <- .cm_general_estado(estado)
  list(
    marcos = estado$marcos,
    corridas = lapply(estado$corridas, function(c) {
      if (!is.list(c)) return(NULL)
      c$unidades <- NULL
      # Viaja al reporte ya redactada: la plantilla Quarto no debe llamar
      # funciones internas del paquete (el render puede cargar el instalado).
      c$nota_varianza <- .cm_general_nota_varianza(c$corrida$metodo, c$corrida$modalidad)
      c
    })
  )
}
