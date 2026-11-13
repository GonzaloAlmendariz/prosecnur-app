# Receta del marco de un público (D6 y D7 del rediseño de Cálculo de muestra):
# lo que el recorrido del marco en Actores decide sobre el archivo del cliente.
#
#   receta = list(
#     columnas = list(id, correo),               # identificador y correo de envío
#     usos     = list(<columna> = <uso>),        # lo que el usuario confirmó por columna
#     reglas   = list(...),                      # excluir_valores, excluir_sin_correo
#     segmento = list(nombre, fila, columna, grupos)
#   )
#
# Declarar el marco con receta aplica las reglas, etiqueta a cada persona con su
# segmento y declara el marco como cualquier otro (calc_muestra_general_declarar_marco):
# el actor recibe su N y un estrato por segmento, que es lo que reparte la meta.
# La receta se guarda junto al marco y viaja en el .pulso con él; la selección
# la vuelve a aplicar sobre el mismo archivo para sortear el mismo marco.
#
# La regla "una_por_persona" no entra en la receta: en la propuesta el cruce
# entre públicos se muestra sin descontarse (D9) y la asignación se decide en
# el listado de envío.

.CM_RECETA_REGLAS <- c("excluir_valores", "excluir_sin_correo")

#' Rótulos corregidos por columna: list(<columna> = list(<valor> = <rótulo>)).
#' Vacíos o iguales al valor no se guardan.
.cm_receta_rotulos <- function(rotulos) {
  if (!is.list(rotulos) || !length(rotulos) || is.null(names(rotulos))) return(list())
  out <- lapply(rotulos, function(m) {
    if (!is.list(m) || is.null(names(m))) return(list())
    m <- lapply(m, function(x) trimws(calc_str(x, "")))
    m[nzchar(names(m)) & nzchar(unlist(m)) & names(m) != unlist(m)]
  })
  out[lengths(out) > 0]
}

#' Aplica los rótulos a la base: cada valor con rótulo se reemplaza por él. Va
#' después de las reglas (que miran el valor original) y antes de armar
#' segmentos y cruces, que salen así con el nombre corregido.
.cm_receta_rotular <- function(df, rotulos) {
  for (col in intersect(names(rotulos), names(df))) {
    m <- unlist(rotulos[[col]])
    original <- as.character(df[[col]])
    v <- trimws(original)
    usa <- !is.na(v) & v %in% names(m)
    if (!any(usa)) next
    # Solo se reescriben los valores con rótulo; el resto de la columna queda como venía.
    original[usa] <- unname(m[v[usa]])
    df[[col]] <- original
  }
  df
}

.cm_receta_normalizar <- function(receta) {
  r <- if (is.list(receta)) receta else list()
  cols <- if (is.list(r$columnas)) r$columnas else list()
  seg <- if (is.list(r$segmento)) r$segmento else list()
  reglas <- Filter(function(x) is.list(x) && calc_str(x$tipo, "") %in% .CM_RECETA_REGLAS, r$reglas %||% list())
  if (length(reglas) != length(r$reglas %||% list())) {
    stop_api(400, "E_BAD_REQUEST", "La receta del marco solo admite las reglas excluir_valores y excluir_sin_correo.")
  }
  usos <- if (is.list(r$usos)) lapply(r$usos, function(u) calc_str(u, "no")) else list()
  list(
    columnas = list(id = calc_str(cols$id, ""), correo = calc_str(cols$correo, "")),
    usos = usos,
    reglas = lapply(reglas, function(x) list(tipo = calc_str(x$tipo, ""), columna = calc_str(x$columna, ""),
                                             valores = as.list(as.character(unlist(x$valores %||% list()))))),
    rotulos = .cm_receta_rotulos(r$rotulos),
    segmento = list(
      nombre = calc_str(seg$nombre, ""), fila = calc_str(seg$fila, ""), columna = calc_str(seg$columna, ""),
      grupos = seg$grupos %||% list()
    )
  )
}

#' Aplica la receta a la base: deja a quienes se invitan y agrega la columna
#' del segmento.
#'
#' @return list(datos, columna_segmento, invitados (embudo), receta).
calc_muestra_marco_aplicar_receta <- function(datos, receta) {
  if (identical(calc_str(receta$tipo, ""), "conteos")) {
    stop_api(400, "E_BAD_REQUEST", "El marco de este actor es una tabla de conteos. Alcanza para la propuesta y las cuotas, pero el listado de envío necesita la base con una fila por persona.")
  }
  r <- .cm_receta_normalizar(receta)
  if (!nzchar(r$columnas$id)) stop_api(400, "E_BAD_REQUEST", "Elige la columna que identifica a cada persona.")
  if (!r$columnas$id %in% names(datos)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("La columna \"%s\" no está en la base.", r$columnas$id))
  }
  inv <- calc_muestra_marco_invitados(datos, r$columnas$correo, r$reglas)
  df <- .cm_receta_rotular(datos[inv$incluidos, , drop = FALSE], r$rotulos)
  seg <- r$segmento
  if (!nzchar(seg$fila)) return(list(datos = df, columna_segmento = "", invitados = inv, receta = r))
  if (!nrow(df)) stop_api(400, "E_BAD_REQUEST", "No queda nadie a quien invitar: las reglas dejaron la base vacía.")
  cruce <- calc_muestra_segmento_cruce(df, seg$fila, seg$columna)
  vf <- .cm_seg_categorias(df[[seg$fila]])
  vc <- if (nzchar(seg$columna)) .cm_seg_categorias(df[[seg$columna]]) else rep("Total", nrow(df))
  etiqueta <- if (length(seg$grupos)) {
    ag <- calc_muestra_segmento_agrupar(cruce, seg$grupos)
    if (length(ag$sin_grupo)) {
      libres <- vapply(ag$sin_grupo, function(x) if (identical(x$columna, "Total")) x$fila else paste(x$fila, x$columna, sep = ", "), "")
      stop_api(400, "E_BAD_REQUEST", sprintf("Quedan celdas sin grupo: %s.", paste(utils::head(libres, 5L), collapse = "; ")))
    }
    clave <- character(0); grupo <- character(0)
    for (g in ag$grupos) for (c in g$celdas) { clave <- c(clave, paste(c$fila, c$columna, sep = "\r")); grupo <- c(grupo, g$nombre) }
    unname(setNames(grupo, clave)[paste(vf, vc, sep = "\r")])
  } else if (nzchar(seg$columna)) {
    paste(vf, vc, sep = ", ")
  } else vf
  # Sin nombre, el de sus columnas: "CAT_DESCRI por DEDICACION" no choca con una columna de la base.
  nombre <- if (nzchar(seg$nombre)) seg$nombre else if (nzchar(seg$columna)) paste(seg$fila, "por", seg$columna) else paste("Segmento por", seg$fila)
  col <- nombre
  k <- 2L
  while (col %in% names(df)) { col <- paste0(nombre, " (", k, ")"); k <- k + 1L }
  df[[col]] <- etiqueta
  list(datos = df, columna_segmento = col, invitados = inv, receta = r)
}

#' Declara el marco de un actor con su receta.
calc_muestra_marco_publico_declarar <- function(estudio, estado, componente_id, datos, file_id, hoja = "", receta) {
  ap <- calc_muestra_marco_aplicar_receta(datos, receta)
  out <- calc_muestra_general_declarar_marco(
    estudio, estado, componente_id, ap$datos, file_id = file_id, hoja = hoja,
    columnas = list(id = ap$receta$columnas$id, estrato = ap$columna_segmento)
  )
  inv <- ap$invitados
  inv$incluidos <- NULL
  out$estado$marcos[[componente_id]]$receta <- ap$receta
  out$estado$marcos[[componente_id]]$invitados <- inv
  out$marco <- out$estado$marcos[[componente_id]]
  out
}

#' Cuotas de un actor sobre su marco guardado: las filas son sus segmentos (la
#' columna que agregó la receta) y, si se pide, las columnas son otra variable
#' de la base marcada "Para cuotas" (por ejemplo SEXO). La meta se reparte con
#' `calc_muestra_cuotas_cruce` (por celda, con control o con mínimo).
#'
#' @param datos la base del actor, leída como en la declaración del marco.
#' @param receta la receta guardada con el marco.
#' @param columna segunda variable; vacía para repartir solo por segmento.
#' @return list(cruce, cuotas, columnas_cuota).
calc_muestra_marco_cuotas <- function(datos, receta, meta, modo = "celda", minimo = 10L, columna = "") {
  ap <- calc_muestra_marco_aplicar_receta(datos, receta)
  if (!nzchar(ap$columna_segmento)) {
    stop_api(400, "E_BAD_REQUEST", "Este actor no tiene segmentos: la meta no se reparte.")
  }
  usos <- ap$receta$usos
  disponibles <- names(usos)[vapply(usos, function(u) identical(u, "cuota"), logical(1))]
  disponibles <- setdiff(disponibles, c(ap$receta$segmento$fila, ap$receta$segmento$columna))
  columna <- calc_str(columna, "")
  if (nzchar(columna) && !columna %in% disponibles) {
    stop_api(400, "E_BAD_REQUEST", sprintf("\"%s\" no es una columna para cuotas de este actor.", columna))
  }
  cruce <- calc_muestra_segmento_cruce(ap$datos, ap$columna_segmento, columna)
  cuotas <- calc_muestra_cuotas_cruce(cruce, meta, modo, minimo)
  list(cruce = cruce, cuotas = cuotas, columnas_cuota = as.list(disponibles))
}

# ---------------------------------------------------------------------------
# Marco desde una tabla de conteos (un público sin base por persona)
# ---------------------------------------------------------------------------

#' Declara el marco de un actor desde una tabla de conteos: la población es el
#' total de la tabla y cada categoría de las filas es un segmento. Alcanza para
#' la propuesta y las cuotas; el listado de envío necesita la base por persona.
#' La receta guarda que es una tabla de conteos y cómo se llama la variable de
#' sus columnas (por ejemplo "Sexo"), para repartir cuotas por el cruce.
calc_muestra_marco_conteos_declarar <- function(estudio, estado, componente_id, df, file_id, hoja = "", columna_variable = "") {
  estado <- .cm_general_estado(estado)
  idx <- .cm_general_buscar_componente(estudio, componente_id)
  lec <- calc_muestra_conteos_leer(df, columna_variable)
  cruce <- lec$cruce
  N_h <- as.integer(round(rowSums(cruce$conteos)))
  N <- sum(N_h)
  if (N <= 0L) stop_api(400, "E_BAD_REQUEST", "La tabla de conteos no suma población.")
  comp <- estudio$componentes[[idx]]
  comp$marco$universo_bruto <- N
  comp$marco$marco_validado <- N
  comp$marco$marco_contactable <- N
  comp$marco$estado <- "validado"
  comp$marco$estratos <- lapply(seq_along(cruce$filas), function(h) list(id = paste0("est-", h), label = cruce$filas[[h]], N = N_h[[h]]))
  comp$resultado <- NULL
  estudio$componentes[[idx]] <- calc_muestra_normalize_componente(comp)
  receta <- list(tipo = "conteos", columna_variable = cruce$columna_variable, categoria = lec$categoria,
                 conteo_columnas = lec$conteo_columnas)
  marco <- list(
    file_id = file_id, hoja = hoja, fuente = "conteos",
    columnas = list(id = lec$categoria, estrato = lec$categoria, tamano = ""),
    marco_hash = digest::digest(list(cruce$filas, cruce$columnas, cruce$conteos)),
    N = N, estratos = lapply(seq_along(cruce$filas), function(h) list(clave = cruce$filas[[h]], N_h = N_h[[h]])),
    receta = receta, avisos = lec$avisos,
    declarado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  estado$marcos[[componente_id]] <- marco
  estado$corridas[[componente_id]] <- NULL
  list(estudio = estudio, estado = estado, marco = marco, componente = estudio$componentes[[idx]])
}

#' Cuotas sobre un marco de conteos: filas por categoría y, si se pide la
#' variable de las columnas, el cruce completo.
calc_muestra_marco_cuotas_conteos <- function(df, receta, meta, modo = "celda", minimo = 10L, columna = "") {
  lec <- calc_muestra_conteos_leer(df, calc_str(receta$columna_variable, ""))
  cruce <- lec$cruce
  variable <- cruce$columna_variable
  disponibles <- if (nzchar(variable)) list(variable) else list()
  columna <- calc_str(columna, "")
  if (nzchar(columna) && !identical(columna, variable)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("\"%s\" no es una columna de la tabla de conteos de este actor.", columna))
  }
  if (!nzchar(columna)) {
    cruce <- .cm_seg_cruce(cruce$fila_variable, "", cruce$filas, "Total", rowSums(cruce$conteos))
  }
  list(cruce = cruce, cuotas = calc_muestra_cuotas_cruce(cruce, meta, modo, minimo), columnas_cuota = disponibles)
}
