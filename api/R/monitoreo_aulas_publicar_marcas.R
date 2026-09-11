# El TRANSPORTE de la excepcion acotada: llevar «REFUERZO POR CONTACTAR» a la
# hoja de agendacion del equipo, celda a celda.
#
# Gonzalo, 2026-09-11: «¿y se puede ver en el Sheets de agendacion para que el
# agendador sepa cual es?»; y al saber que esa hoja es del equipo: «¿pero no se
# puede hacer una excepcion para esos casos?». Dio la palabra para publicar SOLO
# este caso.
#
# `monitoreo_aulas_marcas_sheets.R` decide QUE celdas son escribibles y por que
# las demas no; este archivo es el unico que habla con la red, y respeta las
# cuatro garantias de aquel:
#
#   1. Una sola columna: STATUS MUESTRA.
#   2. Solo las filas que la app marco como `refuerzo_por_contactar`.
#   3. Solo si la celda remota esta LIBRE («», «EN RESERVA», «SIN CONTACTAR»).
#   4. Nunca borra: sin fila que marcar no sale un solo request.
#
# **Dos hojas, no una.** Los codigos `EXTRA *` no viven en «Aulas Agendadas»
# sino en «Aulas Agendadas (Extra)», y el reparto del techo elige sobre todo
# extras. Publicar solo en la primera dejaria fuera justo a la mayoria.

.mapm_txt <- function(v) {
  v <- as.character(v %||% "")
  v[is.na(v)] <- ""
  trimws(v)
}

#' Las hojas de agendacion donde puede vivir un curso-horario marcado.
#' @keywords internal
MONITOREO_AULAS_HOJAS_DE_AGENDA <- c("Aulas Agendadas", "Aulas Agendadas (Extra)")

#' Columna en letras A1 («12» → «L»).
#' @keywords internal
.mapm_letra <- function(n) {
  s <- ""
  n <- as.integer(n)
  while (n > 0L) {
    r <- (n - 1L) %% 26L
    s <- paste0(LETTERS[[r + 1L]], s)
    n <- (n - 1L) %/% 26L
  }
  s
}

#' Encuentra la fila de encabezado que trae las DOS columnas que hacen falta.
#'
#' **Se busca, no se asume.** El libro del operativo lleva bloques con banda de
#' titulo encima, asi que la fila 1 no siempre es el encabezado; y anclar por
#' numero fijo es exactamente como se pisa la celda de otro. Si ninguna fila trae
#' las dos columnas, esta hoja no participa.
#'
#' @param valores `values` crudos de la pestaña (lista de filas).
#' @param col_codigo,col_estado rotulos a encontrar.
#' @return lista `{fila, col_codigo, col_estado}` en base 1, o `NULL`.
#' @keywords internal
.mapm_encabezado <- function(valores, col_codigo = "CURSO-HORARIO",
                             col_estado = "STATUS MUESTRA") {
  if (!length(valores)) return(NULL)
  tope <- min(length(valores), 20L)
  for (i in seq_len(tope)) {
    celdas <- toupper(.mapm_txt(unlist(valores[[i]], use.names = FALSE)))
    ic <- which(celdas == toupper(col_codigo))
    ie <- which(celdas == toupper(col_estado))
    if (length(ic) && length(ie)) {
      return(list(fila = i, col_codigo = ic[[1]], col_estado = ie[[1]]))
    }
  }
  NULL
}

#' Arma el `remoto` de dos columnas que espera el motor de la excepcion.
#' @keywords internal
.mapm_remoto <- function(valores, enc) {
  cuerpo <- if (length(valores) > enc$fila) valores[(enc$fila + 1L):length(valores)] else list()
  celda <- function(fila, j) {
    v <- unlist(fila, use.names = FALSE)
    if (length(v) >= j) .mapm_txt(v[[j]]) else ""
  }
  data.frame(
    `CURSO-HORARIO` = vapply(cuerpo, celda, character(1), j = enc$col_codigo),
    `STATUS MUESTRA` = vapply(cuerpo, celda, character(1), j = enc$col_estado),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

#' Publica «REFUERZO POR CONTACTAR» en las celdas libres de la hoja de agenda.
#'
#' @param spreadsheet_id id del libro del operativo.
#' @param plan lista de filas del plan, con `sample_status` normalizado.
#' @param hojas nombres de las pestañas de agendacion a recorrer.
#' @param aplicar `FALSE` para un ENSAYO: calcula y no escribe una sola celda.
#' @return lista con `escritas`, `respetadas`, `sin_fila`, `por_hoja` y `mensaje`.
#' @export
monitoreo_aulas_publicar_marcas <- function(spreadsheet_id, plan = list(),
                                            hojas = MONITOREO_AULAS_HOJAS_DE_AGENDA,
                                            aplicar = TRUE) {
  id <- .mapm_txt(spreadsheet_id)[1]
  if (!nzchar(id)) {
    stop_api(400, "E_AULAS_SHEETS_SIN_ID",
             "Falta el identificador del Google Sheets del libro de aulas.")
  }
  marcadas <- Filter(function(r) {
    identical(.mapm_txt(r$sample_status), "refuerzo_por_contactar")
  }, plan %||% list())
  if (!length(marcadas)) {
    stop_api(409, "E_MARCAS_SIN_NADA_QUE_PUBLICAR",
             "No hay ningun curso-horario marcado como refuerzo por contactar.")
  }

  pendientes <- vapply(marcadas, function(r) .mapm_txt(r$operational_code), character(1))
  escritas <- list()
  respetadas <- list()
  por_hoja <- list()

  for (hoja in hojas) {
    if (!length(pendientes)) break
    valores <- tryCatch(.cads_valores_de_pestana(id, hoja), error = function(e) NULL)
    # Una pestaña que no existe NO es un error: el libro de un operativo sin
    # extras no la tiene, y fallar obligaria a crearla vacia.
    if (is.null(valores) || !length(valores)) next
    enc <- .mapm_encabezado(valores)
    if (is.null(enc)) next

    # Solo lo que sigue pendiente: un codigo ya resuelto en la primera hoja no
    # se vuelve a buscar ni a escribir en la segunda.
    aun <- Filter(function(r) .mapm_txt(r$operational_code) %in% pendientes, marcadas)
    out <- monitoreo_aulas_marcas_por_publicar(aun, .mapm_remoto(valores, enc))

    datos <- list()
    for (e in out$escribibles) {
      # Fila absoluta = encabezado + posicion en el cuerpo. La columna es la que
      # trajo el propio encabezado: nunca una letra fija.
      fila_abs <- enc$fila + e$fila
      datos[[length(datos) + 1L]] <- list(
        range = sprintf("'%s'!%s%d", gsub("'", "''", hoja),
                        .mapm_letra(enc$col_estado), fila_abs),
        values = list(list(e$texto))
      )
      escritas[[length(escritas) + 1L]] <- list(
        codigo = e$codigo, hoja = hoja, fila = fila_abs)
    }
    for (r in out$respetadas) {
      respetadas[[length(respetadas) + 1L]] <- list(
        codigo = r$codigo, hoja = hoja, habia = r$habia)
    }

    celdas <- 0L
    if (aplicar && length(datos)) {
      r <- .monitoreo_google_api(
        paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"),
        method = "POST",
        # **RAW y nunca USER_ENTERED.** La trampa que ya costo reescribir 50.286
        # celdas: lo que USER_ENTERED interpreta deja de ser el texto que el
        # equipo lee.
        body = list(valueInputOption = "RAW", data = datos)
      )
      celdas <- as.integer(.monitoreo_scalar(r$totalUpdatedCells, length(datos)))
    }
    por_hoja[[length(por_hoja) + 1L]] <- list(
      hoja = hoja, escribibles = length(datos), celdas = celdas,
      respetadas = length(out$respetadas))

    resueltos <- c(
      vapply(out$escribibles, function(e) e$codigo, character(1)),
      vapply(out$respetadas, function(r) r$codigo, character(1))
    )
    pendientes <- setdiff(pendientes, resueltos)
  }

  out <- list(escritas = escritas, respetadas = respetadas,
              sin_fila = pendientes, por_hoja = por_hoja, aplicado = isTRUE(aplicar))
  out$mensaje <- monitoreo_aulas_publicar_marcas_texto(out)
  out
}

#' La frase de una publicacion de marcas, con sus tres cifras y su base.
#' @param out salida de `monitoreo_aulas_publicar_marcas()`.
#' @return texto.
#' @export
monitoreo_aulas_publicar_marcas_texto <- function(out) {
  n_esc <- length(out$escritas %||% list())
  n_res <- length(out$respetadas %||% list())
  n_sin <- length(out$sin_fila %||% character(0))
  verbo <- if (isTRUE(out$aplicado)) "Se pintaron" else "Se pintarian"
  partes <- sprintf("%s %d %s en la hoja de agendacion", verbo, n_esc,
                    if (n_esc == 1) "celda" else "celdas")
  if (n_res) {
    partes <- paste0(partes, sprintf("; %d %s porque el equipo ya escribio ahi",
                                     n_res, if (n_res == 1) "se respeto" else "se respetaron"))
  }
  if (n_sin) {
    partes <- paste0(partes, sprintf("; %d sin fila en el libro (%s)", n_sin,
                                     paste(utils::head(out$sin_fila, 5L), collapse = ", ")))
  }
  paste0(partes, ".")
}
