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
  r <- .cm_receta_normalizar(receta)
  if (!nzchar(r$columnas$id)) stop_api(400, "E_BAD_REQUEST", "Elige la columna que identifica a cada persona.")
  if (!r$columnas$id %in% names(datos)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("La columna \"%s\" no está en la base.", r$columnas$id))
  }
  inv <- calc_muestra_marco_invitados(datos, r$columnas$correo, r$reglas)
  df <- datos[inv$incluidos, , drop = FALSE]
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
  nombre <- if (nzchar(seg$nombre)) seg$nombre else seg$fila
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
